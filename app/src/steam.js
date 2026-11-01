// Everything that talks to Steam: local install files, registry and the Web API.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const vdf = require('./vdf');

const IS_WIN = process.platform === 'win32';
const STEAM64_BASE = 76561197960265728n;

// Tools, runtimes and redistributables that show up as "installed apps" but aren't games.
const SKIP_IDS = new Set(['228980', '1070560', '1391110', '1628350', '1826330', '1493710', '250820', '1007']);
const SKIP_NAME = /^(steamworks|steam linux runtime|proton|steamvr|steam controller|directx|vcredist|microsoft visual)/i;

function regQuery(key, value) {
  return new Promise((resolve) => {
    if (!IS_WIN) return resolve(null);
    execFile('reg', ['query', key, '/v', value], { windowsHide: true }, (err, out) => {
      if (err) return resolve(null);
      const line = out.split(/\r?\n/).find((l) => l.trim().toLowerCase().startsWith(value.toLowerCase()));
      if (!line) return resolve(null);
      const m = line.trim().match(/^\S+\s+(REG_\w+)\s+(.*)$/);
      if (!m) return resolve(null);
      resolve(m[1] === 'REG_DWORD' ? parseInt(m[2], 16) : m[2].trim());
    });
  });
}

function readVdf(file) {
  try { return vdf.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

async function findSteamPath(override) {
  if (override && fs.existsSync(override)) return override;
  const candidates = [
    await regQuery('HKCU\\Software\\Valve\\Steam', 'SteamPath'),
    await regQuery('HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam', 'InstallPath'),
    await regQuery('HKLM\\SOFTWARE\\Valve\\Steam', 'InstallPath'),
    'C:\\Program Files (x86)\\Steam',
    'C:\\Program Files\\Steam',
  ];
  for (const c of candidates) {
    if (!c) continue;
    const p = path.normalize(c);
    if (fs.existsSync(path.join(p, 'steamapps'))) return p;
  }
  return null;
}

function readUsers(steamPath) {
  const data = readVdf(path.join(steamPath, 'config', 'loginusers.vdf'));
  const users = (data && data.users) || {};
  return Object.entries(users).map(([id, u]) => {
    const avatar = path.join(steamPath, 'config', 'avatarcache', `${id}.png`);
    return {
      steamId: id,
      accountName: u.accountname || '',
      personaName: u.personaname || u.accountname || 'Игрок',
      mostRecent: u.mostrecent === '1',
      timestamp: Number(u.timestamp || 0),
      avatar: fs.existsSync(avatar) ? avatar : null,
    };
  }).sort((a, b) => (b.mostRecent - a.mostRecent) || (b.timestamp - a.timestamp));
}

function libraryFolders(steamPath) {
  const out = new Set([steamPath]);
  const data = readVdf(path.join(steamPath, 'steamapps', 'libraryfolders.vdf'));
  const root = data && (data.libraryfolders || data);
  if (root) {
    for (const v of Object.values(root)) {
      if (typeof v === 'object' && v.path) out.add(path.normalize(v.path));
      else if (typeof v === 'string' && /[\\/]/.test(v)) out.add(path.normalize(v));
    }
  }
  return [...out];
}

function scanInstalled(steamPath) {
  const games = {};
  for (const lib of libraryFolders(steamPath)) {
    const dir = path.join(lib, 'steamapps');
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => /^appmanifest_\d+\.acf$/i.test(f)); } catch { continue; }
    for (const f of files) {
      const st = readVdf(path.join(dir, f));
      const a = st && st.appstate;
      if (!a || !a.appid || !a.name) continue;
      if (SKIP_IDS.has(a.appid) || SKIP_NAME.test(a.name)) continue;
      const flags = Number(a.stateflags || 0);
      games[a.appid] = {
        appid: a.appid,
        name: a.name,
        installed: (flags & 4) === 4,
        lastPlayed: Number(a.lastplayed || 0) * 1000,
        sizeOnDisk: Number(a.sizeondisk || 0),
        flags,
        toDownload: Number(a.bytestodownload || 0),
        downloaded: Number(a.bytesdownloaded || 0),
        toStage: Number(a.bytestostage || 0),
        staged: Number(a.bytesstaged || 0),
        dir: path.join(dir, 'common', a.installdir || ''),
      };
    }
  }
  return games;
}

function steamIdToAccountId(steamId64) {
  try { return (BigInt(steamId64) - STEAM64_BASE).toString(); } catch { return null; }
}

// Playtime Steam keeps locally per user — works without an API key.
function readLocalStats(steamPath, steamId64) {
  const acc = steamIdToAccountId(steamId64);
  if (!acc) return {};
  const data = readVdf(path.join(steamPath, 'userdata', acc, 'config', 'localconfig.vdf'));
  const apps = data?.userlocalconfigstore?.software?.valve?.steam?.apps || {};
  const out = {};
  for (const [id, a] of Object.entries(apps)) {
    if (typeof a !== 'object') continue;
    const playtime = Number(a.playtime || 0);
    const lastPlayed = Number(a.lastplayed || 0) * 1000;
    if (playtime || lastPlayed) out[id] = { playtime, lastPlayed };
  }
  return out;
}

function findInCache(dir, appid, names) {
  // New layout: librarycache/<appid>/[<hash>/]file ; old layout: librarycache/<appid>_file
  const found = [];
  const appDir = path.join(dir, String(appid));
  const tryDir = (d) => {
    for (const nm of names) {
      const p = path.join(d, nm);
      if (fs.existsSync(p)) found.push(p);
    }
  };
  if (fs.existsSync(appDir)) {
    tryDir(appDir);
    try {
      for (const sub of fs.readdirSync(appDir, { withFileTypes: true })) {
        if (sub.isDirectory()) tryDir(path.join(appDir, sub.name));
      }
    } catch { /* ignore */ }
  }
  for (const nm of names) {
    const p = path.join(dir, `${appid}_${nm}`);
    if (fs.existsSync(p)) found.push(p);
  }
  return found;
}

// Ordered lists of image sources: local Steam cache first, then the CDN.
function artFor(steamPath, appid) {
  const cache = steamPath ? path.join(steamPath, 'appcache', 'librarycache') : null;
  const local = (names) => (cache ? findInCache(cache, appid, names) : []);
  const cdn = (file) => [
    `https://shared.steamstatic.com/store_item_assets/steam/apps/${appid}/${file}`,
    `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/${file}`,
  ];
  return {
    cover: [...local(['library_600x900.jpg', 'library_capsule.jpg']), ...cdn('library_600x900_2x.jpg'), ...cdn('library_600x900.jpg')],
    hero: [...local(['library_hero.jpg']), ...cdn('library_hero.jpg')],
    header: [...local(['header.jpg']), ...cdn('header.jpg')],
    logo: [...local(['logo.png']), ...cdn('logo.png')],
  };
}

async function api(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Lobby' } });
  if (res.status === 401 || res.status === 403) throw new Error('Steam отклонил ключ API');
  if (!res.ok) throw new Error(`Steam API: ошибка ${res.status}`);
  return res.json();
}

async function resolveSteamId(key, input) {
  const s = String(input || '').trim();
  if (/^7656119\d{10}$/.test(s)) return s;
  const m = s.match(/profiles\/(7656119\d{10})/);
  if (m) return m[1];
  const vanity = (s.match(/id\/([^/?#]+)/) || [null, s])[1];
  if (!vanity || !key) return null;
  const j = await api(`https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${encodeURIComponent(key)}&vanityurl=${encodeURIComponent(vanity)}`);
  return j?.response?.success === 1 ? j.response.steamid : null;
}

async function ownedGames(key, steamId) {
  const j = await api(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${encodeURIComponent(key)}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1&format=json`);
  const games = j?.response?.games;
  if (!games) throw new Error('Steam не отдал список игр. Проверь, что в настройках приватности профиля «Игры» открыты.');
  return games.map((g) => ({
    appid: String(g.appid),
    name: g.name,
    playtime: g.playtime_forever || 0,
    lastPlayed: (g.rtime_last_played || 0) * 1000,
  }));
}

async function playerSummary(key, steamId) {
  try {
    const j = await api(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(key)}&steamids=${steamId}`);
    const p = j?.response?.players?.[0];
    return p ? { personaName: p.personaname, avatarUrl: p.avatarfull } : null;
  } catch { return null; }
}

async function runningAppId() {
  const v = await regQuery('HKCU\\Software\\Valve\\Steam', 'RunningAppID');
  return v ? String(v) : '0';
}

module.exports = {
  findSteamPath, readUsers, scanInstalled, readLocalStats, artFor,
  resolveSteamId, ownedGames, playerSummary, runningAppId, IS_WIN,
};

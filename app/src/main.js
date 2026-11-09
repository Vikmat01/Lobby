'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, session: eSession, Tray, Menu, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const { pathToFileURL, fileURLToPath } = require('url');
const steam = require('./steam');
const epic = require('./epic');
const guide = require('./guide');
const achievements = require('./achievements');
const updater = require('./updater');
const broMod = require('./bro');

// data lives in %APPDATA%\Lobby; carry it over once from the GameLauncher days
const USER = path.join(app.getPath('appData'), 'Lobby');
const OLD_USER = path.join(app.getPath('appData'), 'GameLauncher');
(function migrate() {
  try {
    if (fs.existsSync(path.join(USER, 'library.json')) || !fs.existsSync(path.join(OLD_USER, 'library.json'))) return;
    fs.mkdirSync(USER, { recursive: true });
    for (const f of ['settings.json', 'library.json', 'epic-auth.bin']) {
      if (fs.existsSync(path.join(OLD_USER, f))) fs.copyFileSync(path.join(OLD_USER, f), path.join(USER, f));
    }
    if (fs.existsSync(path.join(OLD_USER, 'art'))) fs.cpSync(path.join(OLD_USER, 'art'), path.join(USER, 'art'), { recursive: true });
    const lib = JSON.parse(fs.readFileSync(path.join(USER, 'library.json'), 'utf8'));
    const oldArt = path.join(OLD_USER, 'art');
    for (const g of Object.values(lib.games || {})) {
      for (const k of ['cover', 'hero']) if (typeof g[k] === 'string' && g[k].startsWith(oldArt)) g[k] = path.join(USER, 'art', g[k].slice(oldArt.length));
    }
    fs.writeFileSync(path.join(USER, 'library.json'), JSON.stringify(lib, null, 2));
  } catch { /* start fresh if anything goes wrong; the old folder stays untouched */ }
}());
app.setPath('userData', USER);
const ART_DIR = path.join(USER, 'art');
const FILES = { settings: path.join(USER, 'settings.json'), library: path.join(USER, 'library.json'), epic: path.join(USER, 'epic-auth.bin') };
const DEFAULTS = {
  steamKey: '', steamId: '', steamPath: '', accent: '#3FD1A9',
  fullscreen: true, minimizeOnLaunch: true, autostart: false,
  sfxVolume: 50, uiScale: 100, sgdbKey: '',
  background: true, guideButton: true, autoUpdate: true, avatarFrame: 'auto',
  avatarIcon: 'auto', title: 'auto', sfxPack: 'classic', ambient: 'none', focusFx: 'glow', launchFx: true,
  remote: false,
};

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

let win = null;
let settings = { ...DEFAULTS, ...readJson(FILES.settings, {}) };
let library = readJson(FILES.library, { games: {}, profile: null });
let steamPath = null;
let session = null;

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}
const saveLibrary = () => writeJson(FILES.library, library);
const saveSettings = () => writeJson(FILES.settings, settings);
const fileUrl = (p) => (p && !/^https?:/.test(p) ? pathToFileURL(p).href : p);
// what the phone app also hears about
const REMOTE_EVENTS = new Set(['session', 'downloads', 'bro', 'ach-new']);
let remoteSend = null;
const send = (ch, data) => {
  if (win && !win.isDestroyed()) win.webContents.send(ch, data);
  if (remoteSend && REMOTE_EVENTS.has(ch)) remoteSend(ch, data);
};

// ---------- library view for the renderer ----------
function viewGame(g) {
  const art = g.source === 'steam' ? steam.artFor(steamPath, g.appid)
    : g.source === 'epic' ? epicArt(g) : { cover: [], hero: [], header: [], logo: [] };
  const custom = (k) => (g[k] && fs.existsSync(g[k]) ? [g[k]] : []);
  const minutes = (g.steamMinutes || 0) + (g.epicMinutes || 0) + (g.localMinutes || 0);
  return {
    id: g.id, source: g.source, appid: g.appid || null,
    name: g.customName || g.name, originalName: g.name,
    installed: g.source === 'custom' ? true : !!g.installed,
    owned: g.source !== 'epic' || g.owned !== false,
    size: g.size || 0,
    hidden: !!g.hidden, minutes, lastPlayed: g.lastPlayed || 0,
    ach: g.ach && g.ach.t ? g.ach : null,
    exe: g.exe || null, trackExe: g.trackExe || '', args: g.args || '',
    hasCustomCover: !!custom('cover').length, hasCustomHero: !!custom('hero').length,
    art: {
      cover: [...custom('cover'), ...art.cover].map(fileUrl),
      hero: [...custom('hero'), ...art.hero, ...custom('cover')].map(fileUrl),
      wide: [...custom('hero'), ...art.header, ...art.hero, ...custom('cover')].map(fileUrl),
      // square tiles: logo-free hero art crops cleanly to 1:1, the header capsule doesn't
      square: [...custom('hero'), ...art.hero, ...custom('cover'), ...art.header].map(fileUrl),
    },
  };
}
function view() {
  return {
    games: Object.values(library.games).map(viewGame),
    profile: library.profile ? { ...library.profile, avatar: fileUrl(library.profile.avatar) } : null,
    lastSync: library.lastSync || 0,
    epic: { account: epicTok ? epicTok.displayName || 'Epic' : null, launcher: epic.launcherInstalled() },
    session: session ? { gameId: session.gameId, since: session.start, state: session.state } : null,
  };
}

// ---------- Steam sync ----------
async function syncSteam() {
  const warnings = [];
  steamPath = await steam.findSteamPath(settings.steamPath);
  if (!steamPath) warnings.push('Steam не найден на этом ПК. Укажи папку Steam в настройках.');

  const users = steamPath ? steam.readUsers(steamPath) : [];
  let steamId = settings.steamId.trim();
  if (steamId && !/^7656119\d{10}$/.test(steamId)) {
    try { steamId = (await steam.resolveSteamId(settings.steamKey, steamId)) || ''; } catch (e) { warnings.push(e.message); steamId = ''; }
  }
  if (!steamId && users[0]) steamId = users[0].steamId;
  const user = users.find((u) => u.steamId === steamId) || users[0] || null;

  const installed = steamPath ? steam.scanInstalled(steamPath) : {};
  const local = steamPath && steamId ? steam.readLocalStats(steamPath, steamId) : {};
  let owned = null;
  if (settings.steamKey && steamId) {
    try { owned = await steam.ownedGames(settings.steamKey, steamId); } catch (e) { warnings.push(e.message); }
  }

  const seen = new Set();
  const upsert = (appid, name) => {
    const id = `steam:${appid}`;
    seen.add(id);
    const g = library.games[id] || (library.games[id] = { id, source: 'steam', appid, name, addedAt: Date.now() });
    if (name) g.name = name;
    return g;
  };
  for (const o of owned || []) {
    const g = upsert(o.appid, o.name);
    g.owned = true;
    g.steamMinutes = Math.max(o.playtime, local[o.appid]?.playtime || 0);
    g.lastPlayed = Math.max(g.lastPlayed || 0, o.lastPlayed, local[o.appid]?.lastPlayed || 0);
  }
  for (const a of Object.values(installed)) {
    const g = upsert(a.appid, owned ? null : a.name);
    if (!g.name) g.name = a.name;
    g.installed = a.installed;
    if (a.sizeOnDisk) g.size = a.sizeOnDisk;
    if (!owned) g.steamMinutes = Math.max(g.steamMinutes || 0, local[a.appid]?.playtime || 0);
    g.lastPlayed = Math.max(g.lastPlayed || 0, a.lastPlayed, local[a.appid]?.lastPlayed || 0);
  }
  for (const g of Object.values(library.games)) {
    if (g.source !== 'steam') continue;
    if (steamPath && !installed[g.appid]) g.installed = false;
    const customised = g.cover || g.hero || g.customName;
    if (!seen.has(g.id) && owned && !customised) delete library.games[g.id];
  }

  let profile = { personaName: user?.personaName || 'Игрок', avatar: user?.avatar || null, steamId };
  if (settings.steamKey && steamId) {
    const p = await steam.playerSummary(settings.steamKey, steamId);
    if (p) profile = { ...profile, personaName: p.personaName, avatar: profile.avatar || p.avatarUrl };
  }
  library.profile = profile;
  library.lastSync = Date.now();
  saveLibrary();
  return { ...view(), warnings, steamFound: !!steamPath, usedApi: !!owned };
}

// ---------- Epic Games ----------
let epicTok = loadEpicTok();
function loadEpicTok() {
  try {
    const buf = fs.readFileSync(FILES.epic);
    const txt = safeStorage.isEncryptionAvailable() && buf[0] !== 0x7b ? safeStorage.decryptString(buf) : buf.toString('utf8');
    return JSON.parse(txt);
  } catch { return null; }
}
function saveEpicTok(t) {
  epicTok = t;
  if (!t) { try { fs.unlinkSync(FILES.epic); } catch { /* none */ } return; }
  const txt = JSON.stringify(t);
  fs.mkdirSync(USER, { recursive: true });
  // tokens are encrypted with the Windows user's key (DPAPI) when available
  fs.writeFileSync(FILES.epic, safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(txt) : txt);
}
async function epicSession() {
  if (!epicTok) return null;
  if (epicTok.expiresAt - Date.now() > 5 * 60000) return epicTok;
  if (epicTok.refreshExpiresAt && epicTok.refreshExpiresAt < Date.now()) { saveEpicTok(null); return null; }
  try { saveEpicTok(await epic.refresh(epicTok)); return epicTok; }
  catch (e) { if (/invalid|expired|AUTH/i.test(`${e.code} ${e.message}`)) saveEpicTok(null); throw e; }
}

function epicArt(g) {
  const a = g.epicArt || {};
  return {
    cover: a.cover ? [epic.sized(a.cover, 600, 800)] : [],
    hero: a.wide ? [epic.sized(a.wide, 1920, 1080)] : [],
    header: a.wide ? [epic.sized(a.wide, 800, 450)] : [],
    logo: a.logo ? [a.logo] : [],
  };
}

async function syncEpic() {
  const warnings = [];
  const installed = epic.scanInstalled();
  const now = Date.now();
  const upsert = (appName, base) => {
    const id = `epic:${appName}`;
    const g = library.games[id] || (library.games[id] = { id, source: 'epic', appName, addedAt: now });
    Object.assign(g, base);
    return g;
  };
  let tok = null;
  try { tok = await epicSession(); } catch (e) { warnings.push(`Epic: ${e.message}`); }

  if (tok) {
    try {
      const [items, play] = await Promise.all([epic.libraryItems(tok), epic.playtime(tok)]);
      // catalog info is fetched once per game and cached in the library
      const need = items.filter((r) => { const g = library.games[`epic:${r.appName}`]; return !g || !g.epicInfo; });
      const infos = await epic.pool(need, 6, (r) => epic.catalogItem(tok, r.namespace, r.catalogItemId));
      need.forEach((r, i) => { r._info = infos[i]; });
      const seen = new Set();
      for (const r of items) {
        const id = `epic:${r.appName}`;
        const prev = library.games[id];
        const info = r._info || (prev && prev.epicInfo) || null;
        if (info && (info.isDlc || !info.isGame)) continue;
        if (!info && !prev && !installed[r.appName]) continue; // unknown item without details: skip quietly
        seen.add(id);
        const g = upsert(r.appName, { namespace: r.namespace, catalogItemId: r.catalogItemId, owned: true });
        if (info) {
          g.epicInfo = { isDlc: info.isDlc, isGame: info.isGame };
          g.epicArt = { cover: info.cover, wide: info.wide, logo: info.logo };
          if (info.title) g.name = info.title;
        }
        if (!g.name) g.name = installed[r.appName]?.name || r.appName;
        if (play[r.appName] != null) g.epicMinutes = play[r.appName];
      }
      for (const g of Object.values(library.games)) {
        if (g.source !== 'epic' || seen.has(g.id) || installed[g.appName]) continue;
        if (!(g.cover || g.hero || g.customName)) delete library.games[g.id];
      }
    } catch (e) {
      if (e.code === 'EXPIRED') saveEpicTok(null);
      warnings.push(`Epic: ${e.message}`);
    }
  }
  for (const a of Object.values(installed)) {
    const g = upsert(a.appName, { namespace: a.namespace, catalogItemId: a.catalogItemId });
    if (!g.name) g.name = a.name;
    g.installed = a.complete;
    g.exe = a.exe;
    g.size = a.size;
  }
  for (const g of Object.values(library.games)) {
    if (g.source === 'epic' && !installed[g.appName]) { g.installed = false; delete g.exe; delete g.size; }
  }
  await epicArtFromGrid();
  saveLibrary();
  return warnings;
}

// games Epic gave no pictures for: take the top SteamGridDB match by name (needs the SGDB key)
async function epicArtFromGrid() {
  if (!settings.sgdbKey) return;
  const todo = Object.values(library.games)
    .filter((g) => g.source === 'epic' && !(g.epicArt && (g.epicArt.cover || g.epicArt.wide)) && !g.sgdbTried)
    .slice(0, 25);
  await epic.pool(todo, 4, async (g) => {
    g.sgdbTried = true;
    const found = await sgdbSearch(g.name);
    if (!found.length) return;
    const id = found[0].id;
    const [grids, heroes] = await Promise.all([
      sgdb(`/grids/game/${id}?types=static&dimensions=600x900,342x482,660x930`).catch(() => null),
      sgdb(`/heroes/game/${id}?types=static`).catch(() => null),
    ]);
    g.sgdbId = id;
    g.epicArt = { cover: grids && grids[0] ? grids[0].url : null, wide: heroes && heroes[0] ? heroes[0].url : null };
  });
}

async function syncAll() {
  const r = await syncSteam();
  const ew = await syncEpic();
  return { ...view(), warnings: [...r.warnings, ...ew], steamFound: r.steamFound, usedApi: r.usedApi };
}

// login: Epic's own sign-in page in a separate window; we only read the one-time code it hands back
let loginWin = null;
function epicLogin() {
  if (loginWin) { loginWin.focus(); return Promise.resolve({ ok: false, error: 'Окно входа уже открыто' }); }
  return new Promise((resolve) => {
    const part = eSession.fromPartition('epic-login'); // in-memory: nothing from the login page is kept
    part.setUserAgent(epic.UA);
    loginWin = new BrowserWindow({
      width: 520, height: 760, parent: win, modal: false, autoHideMenuBar: true, backgroundColor: '#000000',
      title: 'Вход в Epic Games', webPreferences: { session: part, contextIsolation: true, sandbox: true },
    });
    loginWin.setMenu(null);
    let done = false;
    const finish = (res) => {
      if (done) return;
      done = true;
      if (loginWin && !loginWin.isDestroyed()) loginWin.close();
      loginWin = null;
      if (win && !win.isDestroyed()) { win.show(); win.focus(); }
      resolve(res);
    };
    const check = async (final) => {
      if (!loginWin || loginWin.isDestroyed()) return;
      const url = loginWin.webContents.getURL();
      if (!url.startsWith('https://www.epicgames.com/id/api/redirect')) return;
      let text = '';
      try { text = await loginWin.webContents.executeJavaScript('document.body.innerText', true); } catch { /* ignore */ }
      const code = epic.parseCode(text);
      if (!code) {
        if (final) finish({ ok: false, error: 'Epic не вернул код входа. Попробуй ещё раз или войди по коду.' });
        return;
      }
      try { saveEpicTok(await epic.exchangeCode(code)); finish({ ok: true, account: epicTok.displayName }); }
      catch (e) { finish({ ok: false, error: e.message }); }
    };
    loginWin.webContents.on('did-finish-load', () => check(true));
    loginWin.webContents.on('did-navigate', () => check(false));
    loginWin.webContents.setWindowOpenHandler(({ url }) => { loginWin.loadURL(url); return { action: 'deny' }; });
    loginWin.on('closed', () => { loginWin = null; finish({ ok: false, cancelled: true }); });
    loginWin.loadURL(epic.LOGIN_URL);
  });
}
async function epicLoginCode(text) {
  const code = epic.parseCode(text);
  if (!code) return { ok: false, error: 'Не вижу кода. Нужна строка из 32 символов после "authorizationCode".' };
  try { saveEpicTok(await epic.exchangeCode(code)); return { ok: true, account: epicTok.displayName }; }
  catch (e) { return { ok: false, error: e.message }; }
}

// ---------- launching & playtime ----------
function processRunning(imageName) {
  return new Promise((resolve) => {
    if (!steam.IS_WIN || !imageName) return resolve(false);
    execFile('tasklist', ['/FI', `IMAGENAME eq ${imageName}`, '/NH', '/FO', 'CSV'], { windowsHide: true }, (err, out) => {
      resolve(!err && out.toLowerCase().includes(`"${imageName.toLowerCase()}"`));
    });
  });
}

function endSession() {
  if (!session) return;
  clearInterval(session.timer);
  const s = session;
  session = null;
  if (s.achTimer) clearInterval(s.achTimer);
  const g = library.games[s.gameId];
  if (g && g.source === 'steam' && s.state === 'running' && s.achBefore) finishAchievements(g, s);
  let minutes = 0;
  if (g && s.state === 'running') {
    minutes = Math.round((Date.now() - s.start) / 60000);
    if (g.source === 'steam') g.steamMinutes = (g.steamMinutes || 0) + minutes; // replaced by Steam's own figure on next sync
    else if (g.source === 'epic') g.epicMinutes = (g.epicMinutes || 0) + minutes; // likewise by Epic's
    else g.localMinutes = (g.localMinutes || 0) + minutes;
    g.lastPlayed = s.start;
    saveLibrary();
    const ev = bro.played(g.id, minutes);
    setTimeout(() => broNotify(ev), 900);
  }
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show(); win.focus();
  }
  send('session', { state: 'ended', gameId: s.gameId, minutes, library: view() });
}

function startWatching(gameId, isRunning, waitMs) {
  const created = Date.now();
  session = { gameId, start: created, state: 'starting', misses: 0 };
  send('session', { state: 'starting', gameId });
  session.timer = setInterval(async () => {
    if (!session) return;
    const running = await isRunning();
    if (!session) return;
    if (session.state === 'starting') {
      if (running) {
        session.state = 'running';
        session.start = Date.now();
        if (settings.minimizeOnLaunch && win) win.minimize();
        send('session', { state: 'running', gameId, since: session.start });
        trackAchievements(session);
      } else if (Date.now() - created > waitMs) {
        endSession();
      }
    } else if (!running) {
      if (++session.misses >= 2) endSession();
    } else session.misses = 0;
  }, 3000);
}

// ---------- updates ----------
const upd = updater.create({ current: app.getVersion(), tempDir: app.getPath('temp') });
let updateInfo = null;
async function checkUpdate(manual) {
  try {
    const r = await upd.check();
    updateInfo = r.available ? r : null;
    if (r.available) send('update', { state: 'available', ...r });
    return r;
  } catch (e) { return manual ? { error: e.message } : null; }
}
async function downloadUpdate() {
  try {
    await upd.download((got, total) => send('update', { state: 'downloading', got, total }));
    send('update', { state: 'ready' });
    return { ok: true };
  } catch (e) {
    send('update', { state: 'error', error: e.message });
    return { ok: false, error: e.message };
  }
}

// ---------- Game Bro ----------
const bro = broMod.create({ file: path.join(USER, 'bro.json'), getGames: () => Object.values(library.games) });
function broNotify(events) {
  if (events && events.length) send('bro', { events, state: bro.view() });
}

// ---------- Steam achievements ----------
const ach = achievements.create({
  dir: path.join(USER, 'achievements'),
  getKey: () => settings.steamKey,
  getSteamId: () => (library.profile && library.profile.steamId) || '',
});
function storeSummary(g, data) {
  g.ach = ach.summary(data);
  g.achAt = Date.now();
}
async function achForGame(id, force) {
  const g = library.games[id];
  if (!g || g.source !== 'steam') return { error: 'Достижения есть только у игр Steam' };
  try {
    const data = await ach.forGame(g.appid, { force });
    storeSummary(g, data);
    saveLibrary();
    return { data, game: viewGame(g) };
  } catch (e) { return { error: e.message, code: e.code || null }; }
}
// fill in achievements for every played Steam game; reports progress to the Trophies screen
let sweeping = null;
function achSweep(force) {
  if (sweeping) return sweeping;
  sweeping = (async () => {
    const games = Object.values(library.games).filter((g) => g.source === 'steam' && ((g.steamMinutes || 0) > 0 || (g.ach && g.ach.u)));
    const stale = games.filter((g) => force || !g.achAt || Date.now() - g.achAt > 6 * 3600e3);
    let done = 0;
    let error = null;
    send('ach-progress', { done, total: stale.length });
    await epic.pool(stale, 4, async (g) => {
      try { storeSummary(g, await ach.forGame(g.appid)); } catch (e) { if (['PRIVATE', 'KEY', 'NOKEY'].includes(e.code)) error = { error: e.message, code: e.code }; }
      done++;
      if (done % 5 === 0 || done === stale.length) send('ach-progress', { done, total: stale.length });
    });
    saveLibrary();
    // everything from cache now: per game list for the Trophies screen
    const out = [];
    for (const g of games) {
      if (!g.ach || !g.ach.t) continue;
      try { const d = await ach.forGame(g.appid); out.push({ id: g.id, data: d }); } catch { /* skip */ }
    }
    return { games: out, library: view(), ...(error || {}) };
  })().finally(() => { sweeping = null; });
  return sweeping;
}
// while a Steam game runs: remember what was unlocked at the start, check once a minute
async function trackAchievements(s) {
  const g = library.games[s.gameId];
  if (!g || g.source !== 'steam' || !settings.steamKey) return;
  try {
    const d = await ach.forGame(g.appid, { force: true });
    if (!d.total) return;
    s.achBefore = new Set(d.items.filter((i) => i.unlocked).map((i) => i.id));
    s.achFresh = [];
    s.achTimer = setInterval(async () => {
      try {
        const r = await ach.newSince(g.appid, s.achBefore);
        for (const f of r.fresh) { s.achBefore.add(f.id); s.achFresh.push(f); }
      } catch { /* try again next minute */ }
    }, 60e3);
  } catch { /* no achievements for this game */ }
}
async function finishAchievements(g, s) {
  try {
    const r = await ach.newSince(g.appid, s.achBefore);
    const fresh = [...s.achFresh, ...r.fresh];
    storeSummary(g, r.data);
    saveLibrary();
    if (fresh.length) send('ach-new', { gameId: g.id, items: fresh, data: r.data, library: view() });
    if (fresh.length) setTimeout(() => broNotify(bro.unlocked(g.id, fresh.length)), 2500);
  } catch { /* offline: next sweep catches up */ }
}

async function launch(id) {
  const g = library.games[id];
  if (!g) return { ok: false, error: 'Игра не найдена' };
  if (session) return { ok: false, error: 'Другая игра уже запущена' };

  if (g.source === 'steam') {
    if (!g.installed) return installGame(id);
    await shell.openExternal(`steam://rungameid/${g.appid}`);
    if (!steam.IS_WIN) { g.lastPlayed = Date.now(); saveLibrary(); return { ok: true }; }
    startWatching(id, async () => (await steam.runningAppId()) === String(g.appid), 4 * 60000);
    return { ok: true };
  }

  if (g.source === 'epic') {
    if (!g.installed) return installGame(id);
    await shell.openExternal(epic.launchUri(g));
    const exeName = g.exe ? path.basename(g.exe) : '';
    if (!exeName || !steam.IS_WIN) { g.lastPlayed = Date.now(); saveLibrary(); return { ok: true, untracked: !exeName }; }
    startWatching(id, () => processRunning(exeName), 4 * 60000); // Epic may need to start up or update first
    return { ok: true };
  }

  let target = g.exe;
  let args = (g.args || '').match(/"[^"]*"|\S+/g)?.map((a) => a.replace(/^"|"$/g, '')) || [];
  if (!target || !fs.existsSync(target)) return { ok: false, error: 'Файл игры не найден. Возможно, её переместили.' };
  if (/\.lnk$/i.test(target)) {
    try {
      const l = shell.readShortcutLink(target);
      if (l.target) { target = l.target; if (l.args && !g.args) args = l.args.match(/"[^"]*"|\S+/g)?.map((a) => a.replace(/^"|"$/g, '')) || []; }
    } catch { /* fall through to openPath */ }
  }
  const trackName = (g.trackExe || (/\.exe$/i.test(target) ? path.basename(target) : '')).trim();
  try {
    if (/\.exe$/i.test(target)) {
      const child = spawn(target, args, { cwd: path.dirname(target), detached: true, stdio: 'ignore', windowsHide: false });
      child.on('error', () => { if (session && session.gameId === id && session.state === 'starting') endSession(); });
      child.unref();
    } else {
      const err = await shell.openPath(target);
      if (err) return { ok: false, error: err };
    }
  } catch (e) { return { ok: false, error: e.message }; }

  if (!trackName || !steam.IS_WIN) { g.lastPlayed = Date.now(); saveLibrary(); return { ok: true, untracked: true }; }
  startWatching(id, () => processRunning(trackName), 2 * 60000);
  return { ok: true };
}

// ---------- art ----------
async function pickImage(title) {
  const r = await dialog.showOpenDialog(win, {
    title, properties: ['openFile'],
    filters: [{ name: 'Изображения', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] }],
  });
  return r.canceled ? null : r.filePaths[0];
}
function storeArt(gameId, kind, src) {
  fs.mkdirSync(ART_DIR, { recursive: true });
  const safe = gameId.replace(/[^a-z0-9]+/gi, '_');
  const dest = path.join(ART_DIR, `${safe}-${kind}-${Date.now()}${path.extname(src).toLowerCase()}`);
  fs.copyFileSync(src, dest);
  return dest;
}
function dropArt(g, kind) {
  if (g[kind] && g[kind].startsWith(ART_DIR)) { try { fs.unlinkSync(g[kind]); } catch { /* ignore */ } }
  delete g[kind];
}

// ---------- installs, updates & removal (Steam does the work, we show it) ----------
// StateFlags bits from Steam's appmanifest
const F = { INSTALLED: 4, UPDATE_RUNNING: 256, PAUSED: 512, UPDATE_STARTED: 1024, UNINSTALLING: 2048,
  VALIDATING: 131072, PREALLOC: 524288, DOWNLOADING: 1048576, STAGING: 2097152, COMMITTING: 4194304 };
const BUSY = F.UPDATE_RUNNING | F.PAUSED | F.UPDATE_STARTED | F.UNINSTALLING | F.VALIDATING | F.PREALLOC | F.DOWNLOADING | F.STAGING | F.COMMITTING;
const pending = new Map(); // game id -> { kind: 'install' | 'uninstall', since, name, epic? }
let lastDlSig = '';
let downloads = [];

async function installGame(id) {
  const g = library.games[id];
  if (g && g.source === 'epic') {
    if (!epic.launcherInstalled() && steam.IS_WIN) return { ok: false, error: 'Epic Games Launcher не установлен на этом ПК' };
    pending.set(g.id, { kind: 'install', since: Date.now(), name: g.customName || g.name, epic: true });
    await shell.openExternal(epic.installUri(g));
    return { ok: true, installing: true, epic: true };
  }
  if (!g || g.source !== 'steam') return { ok: false, error: 'Это не игра Steam' };
  pending.set(g.id, { kind: 'install', since: Date.now(), name: g.customName || g.name });
  await shell.openExternal(`steam://install/${g.appid}`);
  setTimeout(pollDownloads, 300);
  return { ok: true, installing: true };
}

function unsafeFolder(dir) {
  const d = path.resolve(dir).toLowerCase().replace(/[\\/]+$/, '');
  const home = app.getPath('home').toLowerCase();
  const banned = [home, path.join(home, 'desktop'), path.join(home, 'downloads'), path.join(home, 'documents'),
    'c:\\program files', 'c:\\program files (x86)', 'c:\\windows', 'c:\\users', 'c:\\games']
    .map((p) => p.toLowerCase());
  if (banned.includes(d)) return true;
  if (d.split(/[\\/]/).filter(Boolean).length < 2) return true; // a drive root like D:\
  return home.startsWith(d + path.sep); // a parent of the home folder
}

async function uninstallGame(id) {
  const g = library.games[id];
  if (!g) return { ok: false, error: 'Игра не найдена' };
  if (g.source === 'epic') {
    // Epic has no uninstall link: open its library, the user removes the game there, we notice it's gone
    pending.set(g.id, { kind: 'uninstall', since: Date.now(), name: g.customName || g.name, epic: true });
    await shell.openExternal('com.epicgames.launcher://store/library');
    return { ok: true, epic: true };
  }
  if (g.source === 'steam') {
    pending.set(g.id, { kind: 'uninstall', since: Date.now(), name: g.customName || g.name });
    await shell.openExternal(`steam://uninstall/${g.appid}`);
    setTimeout(pollDownloads, 300);
    return { ok: true };
  }
  const dir = customGameDir(g);
  if (!dir) return { ok: false, error: 'Не удалось определить папку игры' };
  if (unsafeFolder(dir)) return { ok: false, error: `Папку «${dir}» удалять опасно — удали игру вручную.` };
  try { await shell.trashItem(dir); } catch (e) { return { ok: false, error: `Не удалось удалить: ${e.message}` } }
  dropArt(g, 'cover'); dropArt(g, 'hero');
  delete library.games[id];
  saveLibrary();
  return { ok: true, trashed: dir, library: view() };
}
function customGameDir(g) {
  let target = g.exe;
  if (!target) return null;
  if (/\.lnk$/i.test(target)) { try { target = shell.readShortcutLink(target).target || null; } catch { target = null; } }
  if (!target || !/\.exe$/i.test(target) || !fs.existsSync(target)) return null;
  return path.dirname(target);
}

function dlState(f) {
  if (f & F.UNINSTALLING) return 'uninstalling';
  if (f & F.PAUSED) return 'paused';
  if (f & F.VALIDATING) return 'validating';
  if (f & (F.STAGING | F.COMMITTING | F.PREALLOC)) return 'installing';
  if (f & (F.DOWNLOADING | F.UPDATE_RUNNING)) return (f & F.INSTALLED) ? 'updating' : 'downloading';
  return 'queued';
}

function pollDownloads() {
  const now = Date.now();
  const list = [];
  const events = [];
  let libChanged = false;
  const flip = (g, inst) => {
    if (!!g.installed === inst) return;
    g.installed = inst; libChanged = true;
    if (!inst) delete g.size;
    if (inst) events.push({ type: 'installed', name: g.customName || g.name });
    if (!inst && pending.get(g.id)?.kind === 'uninstall') { pending.delete(g.id); events.push({ type: 'uninstalled', name: g.customName || g.name }); }
  };

  // --- Steam: progress straight from appmanifests
  let man = null;
  if (steamPath) { try { man = steam.scanInstalled(steamPath); } catch { man = null; } }
  if (man) {
    for (const a of Object.values(man)) {
      const id = `steam:${a.appid}`;
      const busy = (a.flags & BUSY) || !(a.flags & F.INSTALLED);
      if (busy) {
        const total = a.toDownload || a.toStage;
        const done = a.toDownload ? a.downloaded : a.staged;
        list.push({ gid: id, name: a.name, state: dlState(a.flags), done, total, pct: total ? Math.min(1, done / total) : 0 });
        if (pending.get(id)?.kind === 'install') pending.delete(id);
      }
      let g = library.games[id];
      if (!g) { g = library.games[id] = { id, source: 'steam', appid: a.appid, name: a.name, addedAt: now }; libChanged = true; }
      flip(g, (a.flags & F.INSTALLED) === F.INSTALLED);
      if (a.sizeOnDisk && g.size !== a.sizeOnDisk) { g.size = a.sizeOnDisk; libChanged = true; }
    }
    for (const g of Object.values(library.games)) if (g.source === 'steam' && !man[g.appid]) flip(g, false);
  }

  // --- Epic: only "installing / done" is visible in its manifests, no percentage
  const em = epic.scanInstalled();
  for (const a of Object.values(em)) {
    const id = `epic:${a.appName}`;
    let g = library.games[id];
    if (!g) { g = library.games[id] = { id, source: 'epic', appName: a.appName, namespace: a.namespace, catalogItemId: a.catalogItemId, name: a.name, addedAt: now }; libChanged = true; }
    if (!a.complete) {
      list.push({ gid: id, name: g.name, state: 'epic', done: 0, total: 0, pct: 0 });
      if (pending.get(id)?.kind === 'install') pending.delete(id);
    }
    if (a.complete && g.exe !== a.exe) { g.exe = a.exe; libChanged = true; }
    if (a.complete && a.size && g.size !== a.size) { g.size = a.size; libChanged = true; }
    flip(g, a.complete);
  }
  for (const g of Object.values(library.games)) if (g.source === 'epic' && !em[g.appName]) flip(g, false);

  // --- installs we asked for that the store hasn't picked up yet
  for (const [id, p] of pending) {
    const g = library.games[id];
    if (!g || now - p.since > 15 * 60000) { pending.delete(id); continue; }
    if (p.kind === 'install' && !g.installed && !list.some((d) => d.gid === id)) {
      list.push({ gid: id, name: p.name, state: p.epic ? 'epicConfirm' : 'confirm', done: 0, total: 0, pct: 0 });
    }
    if (p.kind === 'uninstall' && g.source === 'steam' && man && !man[g.appid]) pending.delete(id);
  }

  if (libChanged) saveLibrary();
  downloads = list;
  const sig = JSON.stringify(list.map((d) => [d.gid, d.state, Math.round(d.pct * 1000)]));
  if (sig !== lastDlSig || libChanged || events.length) {
    lastDlSig = sig;
    send('downloads', { list, events, library: libChanged ? view() : null });
  }
}

// ---------- SteamGridDB ----------
const SGDB = 'https://www.steamgriddb.com/api/v2';
async function sgdb(q) {
  if (!settings.sgdbKey) { const e = new Error('Нужен ключ SteamGridDB'); e.code = 'NO_KEY'; throw e; }
  const r = await fetch(SGDB + q, { headers: { Authorization: `Bearer ${settings.sgdbKey.trim()}`, 'User-Agent': 'Lobby' } });
  if (r.status === 401 || r.status === 403) { const e = new Error('SteamGridDB отклонил ключ'); e.code = 'BAD_KEY'; throw e; }
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`SteamGridDB: ошибка ${r.status}`);
  const j = await r.json();
  if (!j.success) throw new Error((j.errors || []).join(', ') || 'SteamGridDB: ошибка');
  return j.data;
}
const wrap = (fn) => async (_e, ...a) => { try { return await fn(...a); } catch (e) { return { error: e.message, code: e.code || null }; } };

async function sgdbSearch(term) {
  const res = (await sgdb(`/search/autocomplete/${encodeURIComponent(term)}`)) || [];
  return res.slice(0, 10).map((r) => ({ id: r.id, name: r.name, year: r.release_date ? new Date(r.release_date * 1000).getFullYear() : null }));
}
async function sgdbImages(gameId, kind, matchId) {
  const g = library.games[gameId];
  if (!g) return { error: 'Игра не найдена' };
  const what = kind === 'cover' ? 'grids' : 'heroes';
  const q = kind === 'cover' ? '?types=static&dimensions=600x900,342x482,660x930' : '?types=static';
  let target = matchId || g.sgdbId || null;
  let match = null;
  let data = null;
  if (!target && g.source === 'steam') {
    data = await sgdb(`/${what}/steam/${g.appid}${q}`);
    if (data) match = { name: g.customName || g.name, viaSteam: true };
  }
  if (!data) {
    if (!target) {
      const found = await sgdbSearch(g.customName || g.name);
      if (!found.length) return { match: null, images: [] };
      target = found[0].id;
      match = { id: target, name: found[0].name };
    }
    data = await sgdb(`/${what}/game/${target}${q}`);
    if (!match) {
      const info = await sgdb(`/games/id/${target}`);
      match = { id: target, name: info ? info.name : g.name };
    }
  }
  if (matchId && g.sgdbId !== matchId) { g.sgdbId = matchId; saveLibrary(); }
  return {
    match,
    images: (data || []).slice(0, 60).map((i) => ({ id: i.id, url: i.url, thumb: i.thumb || i.url, w: i.width, h: i.height })),
  };
}
async function sgdbApply(gameId, kind, url) {
  const g = library.games[gameId];
  if (!g || !['cover', 'hero'].includes(kind)) return { error: 'Игра не найдена' };
  const u = new URL(url);
  if (u.protocol !== 'https:' || !/(^|\.)steamgriddb\.com$/.test(u.hostname)) return { error: 'Недопустимый адрес картинки' };
  const r = await fetch(url);
  if (!r.ok) return { error: `Не удалось скачать картинку (${r.status})` };
  const buf = Buffer.from(await r.arrayBuffer());
  const ext = (path.extname(u.pathname).toLowerCase().match(/^\.(png|jpe?g|webp)$/) || ['.jpg'])[0];
  fs.mkdirSync(ART_DIR, { recursive: true });
  const dest = path.join(ART_DIR, `${gameId.replace(/[^a-z0-9]+/gi, '_')}-${kind}-${Date.now()}${ext}`);
  fs.writeFileSync(dest, buf);
  dropArt(g, kind);
  g[kind] = dest;
  saveLibrary();
  return view();
}

// ---------- IPC ----------
ipcMain.handle('game:install', (_e, id) => installGame(id));
ipcMain.handle('game:uninstall', (_e, id) => uninstallGame(id));
ipcMain.handle('game:folder', (_e, id) => { const g = library.games[id]; return g && g.source === 'custom' ? customGameDir(g) : null; });
ipcMain.handle('downloads:get', () => downloads);
// ---------- Steam friends ----------
const friends = require('./friends').create({
  getKey: () => settings.steamKey,
  getSteamId: () => (library.profile && library.profile.steamId) || '',
});
ipcMain.handle('friends:list', (_e, force) => friends.friends(!!force));
ipcMain.handle('friends:detail', (_e, id) => {
  if (!/^\d{17}$/.test(String(id))) return null;
  const mine = {};
  const names = {};
  for (const g of Object.values(library.games)) if (g.source === 'steam' && g.owned) { mine[g.appid] = g.steamMinutes || 0; names[g.appid] = g.customName || g.name; }
  return friends.detail(String(id), mine).then((d) => {
    for (const c of d.common || []) if (!c.name && names[c.appid]) c.name = names[c.appid];
    return d;
  }).catch((e) => ({ error: e.message }));
});
// chat, profile and joining go through the Steam client
ipcMain.handle('friends:open', (_e, { kind, id, appid, lobby }) => {
  const digits = (v) => /^\d+$/.test(String(v || ''));
  if (!digits(id)) return;
  if (kind === 'chat') shell.openExternal(`steam://friends/message/${id}`);
  else if (kind === 'profile') shell.openExternal(`steam://url/SteamIDPage/${id}`);
  else if (kind === 'join' && digits(appid) && digits(lobby)) shell.openExternal(`steam://joinlobby/${appid}/${lobby}/${id}`);
});

// ---------- Lobby Companion (phone) ----------
const ACCENT_BASE = { 'grad:sunset': '#FF8A5B', 'grad:chrome': '#D9DEE5', 'grad:aurora': '#5EE7C4' };
const ACCENT_GRAD = {
  'grad:sunset': ['#FF5F6D', '#FFC371', '#FF8A5B'],
  'grad:chrome': ['#8E9EAB', '#F5F7FA', '#9AA6B2', '#FFFFFF'],
  'grad:aurora': ['#43E97B', '#38F9D7', '#8B7CFF', '#D77BF0'],
};
// the phone follows the PC's colours; special accents only once they are unlocked (the PC falls back otherwise)
const remoteTheme = () => {
  const lv = (() => { const v = bro.view(); return Math.max(v.level, v.peak || 1); })();
  const need = { 'grad:sunset': 12, 'grad:chrome': 18, 'grad:aurora': 25 }[settings.accent];
  const a = need && lv < need ? DEFAULTS.accent : settings.accent;
  return { accent: ACCENT_BASE[a] || a || DEFAULTS.accent, grad: ACCENT_GRAD[a] || null };
};
const remoteArt = (g, v) => {
  const out = {};
  for (const k of ['cover', 'hero', 'wide']) out[k] = v.art[k].slice(0, 3).map((u, i) => (/^https:/.test(u) ? u : `/art/${encodeURIComponent(g.id)}/${k}/${i}`));
  return out;
};
const remoteGame = (g) => {
  const v = viewGame(g);
  return { id: v.id, source: v.source, appid: v.appid, name: v.name, installed: v.installed, owned: v.owned, size: v.size, minutes: v.minutes, lastPlayed: v.lastPlayed, ach: v.ach, art: remoteArt(g, v) };
};
const localPath = (u) => { try { return u && u.startsWith('file:') ? fileURLToPath(u) : null; } catch { return null; } };
const remote = require('./remote').create({
  file: path.join(USER, 'phones.json'), port: 47820, version: app.getVersion(),
  api: {
    artFile: (id, kind, i) => { const g = library.games[id]; return g ? localPath(viewGame(g).art[kind][i]) : null; },
    avatarFile: () => { const a = library.profile && library.profile.avatar; return a && !/^https?:/.test(a) && fs.existsSync(a) ? a : null; },
    games: () => Object.values(library.games).filter((g) => !g.hidden).map(remoteGame),
    state: async () => {
      const p = library.profile;
      const sg = session && library.games[session.gameId];
      return {
        ...remoteTheme(),
        profile: { name: (p && p.personaName) || 'Игрок', avatar: p && p.avatar ? (/^https?:/.test(p.avatar) ? p.avatar : '/avatar') : null },
        session: session ? { gameId: session.gameId, name: sg ? sg.customName || sg.name : '', since: session.start, state: session.state } : null,
        bro: bro.view(), downloads,
      };
    },
    launch: (id) => launch(id),
    install: (id) => installGame(id),
    ach: async (id) => {
      const r = await achForGame(id, false);
      if (r.error) return { error: r.error, code: r.code };
      return { total: r.data.total, unlocked: r.data.unlocked, items: r.data.items.map(({ id: aid, name, desc, icon, unlocked, time, pct, hidden }) => ({ id: aid, name, desc, icon, unlocked, time, pct, hidden })) };
    },
    bro: () => bro.view(),
    reroll: (id) => { const r = bro.reroll(id); const state = bro.view(); send('bro', { state }); return { ...r, state }; },
    friends: (force) => friends.friends(force),
    downloads: () => downloads,
    summon: () => summon(),
  },
});
remoteSend = (ch, data) => remote.broadcast(ch, ch === 'downloads' ? { list: data.list, events: data.events } : ch === 'bro' ? { events: data.events || [], state: data.state } : ch === 'ach-new' ? { gameId: data.gameId, items: (data.items || []).map((i) => ({ id: i.id, name: i.name, icon: i.icon })) } : ch === 'session' ? { state: data.state, gameId: data.gameId, since: data.since || null, minutes: data.minutes || 0, name: (library.games[data.gameId] && (library.games[data.gameId].customName || library.games[data.gameId].name)) || '' } : data);
remote.onPaired((d) => send('remote-paired', { name: d.name }));
async function applyRemote() {
  if (settings.remote) { try { await remote.start(); } catch (e) { send('remote-error', { error: e.code === 'EADDRINUSE' ? 'порт занят другой программой' : e.message }); } } else remote.stop();
}
const remoteStatus = () => ({ on: !!settings.remote, running: remote.running(), port: remote.port(), ips: remote.addresses(), devices: remote.devices() });
ipcMain.handle('remote:status', () => remoteStatus());
ipcMain.handle('remote:pair', async () => {
  if (!settings.remote) { settings.remote = true; saveSettings(); }
  await applyRemote();
  if (!remote.running()) return { error: 'Сервер для телефона не запустился' };
  const info = remote.beginPairing();
  const qr = require('qrcode-generator')(0, 'M');
  qr.addData(info.link);
  qr.make();
  return { ...info, svg: qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true }) };
});
ipcMain.handle('remote:cancel', () => remote.cancelPairing());
ipcMain.handle('remote:remove', (_e, id) => { remote.removeDevice(String(id)); return remoteStatus(); });

ipcMain.handle('app:steamDownloads', () => shell.openExternal('steam://open/downloads'));
ipcMain.handle('update:check', () => checkUpdate(true));
ipcMain.handle('update:get', () => ({ current: app.getVersion(), info: updateInfo }));
ipcMain.handle('update:download', () => downloadUpdate());
ipcMain.handle('update:install', () => {
  try { upd.install(); } catch (e) { return { ok: false, error: e.message }; }
  quitting = true;
  setTimeout(() => app.quit(), 300);
  return { ok: true };
});
ipcMain.handle('bro:get', () => bro.view());
ipcMain.handle('bro:reroll', (_e, id) => ({ ...bro.reroll(id), state: bro.view() }));
ipcMain.handle('bro:prestige', () => ({ ...bro.prestige(), state: bro.view() }));
ipcMain.handle('ach:game', (_e, id, force) => achForGame(id, !!force));
ipcMain.handle('ach:all', (_e, force) => achSweep(!!force));
ipcMain.handle('sgdb:search', wrap(sgdbSearch));
ipcMain.handle('sgdb:images', wrap(sgdbImages));
ipcMain.handle('sgdb:apply', wrap(sgdbApply));
ipcMain.handle('settings:get', () => settings);
ipcMain.handle('settings:set', (_e, patch) => {
  const allowed = Object.keys(DEFAULTS);
  for (const k of Object.keys(patch || {})) if (allowed.includes(k)) settings[k] = patch[k];
  saveSettings();
  if ('fullscreen' in patch && win) win.setFullScreen(!!settings.fullscreen);
  if ('autostart' in patch && steam.IS_WIN) app.setLoginItemSettings({ openAtLogin: !!settings.autostart, args: ['--hidden'] });
  if ('background' in patch || 'guideButton' in patch) applyBackground();
  if ('remote' in patch) applyRemote();
  if ('accent' in patch && remote.running()) remote.broadcast('theme', remoteTheme());
  return settings;
});
ipcMain.handle('library:get', async () => {
  if (!steamPath) steamPath = await steam.findSteamPath(settings.steamPath);
  return view();
});
ipcMain.handle('library:sync', () => syncAll());
ipcMain.handle('epic:login', () => epicLogin());
ipcMain.handle('epic:loginCode', (_e, text) => epicLoginCode(text));
ipcMain.handle('epic:loginPage', () => shell.openExternal(epic.LOGIN_URL));
ipcMain.handle('epic:logout', () => {
  saveEpicTok(null);
  // owned-but-not-installed Epic games came from the account; keep installed and customised ones
  for (const g of Object.values(library.games)) {
    if (g.source === 'epic' && !g.installed && !(g.cover || g.hero || g.customName)) delete library.games[g.id];
  }
  saveLibrary();
  return view();
});
ipcMain.handle('game:launch', (_e, id) => launch(id));
ipcMain.handle('game:stopTracking', () => { endSession(); return true; });
ipcMain.handle('game:update', (_e, id, patch) => {
  const g = library.games[id];
  if (!g) return view();
  for (const k of ['customName', 'hidden', 'trackExe', 'args']) {
    if (k in patch) { if (patch[k] === '' || patch[k] == null) delete g[k]; else g[k] = patch[k]; }
  }
  saveLibrary();
  return view();
});
ipcMain.handle('game:remove', (_e, id) => {
  const g = library.games[id];
  if (g && g.source === 'custom') { dropArt(g, 'cover'); dropArt(g, 'hero'); delete library.games[id]; saveLibrary(); }
  return view();
});
ipcMain.handle('game:pickArt', async (_e, id, kind) => {
  const g = library.games[id];
  if (!g || !['cover', 'hero'].includes(kind)) return view();
  const src = await pickImage(kind === 'cover' ? 'Обложка (вертикальная, 2:3)' : 'Фон (широкий, 16:9)');
  if (src) { dropArt(g, kind); g[kind] = storeArt(id, kind, src); saveLibrary(); }
  return view();
});
ipcMain.handle('game:resetArt', (_e, id, kind) => {
  const g = library.games[id];
  if (g) { dropArt(g, kind); saveLibrary(); }
  return view();
});
ipcMain.handle('game:add', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'Выбери файл игры', properties: ['openFile'],
    filters: [{ name: 'Игры и ярлыки', extensions: ['exe', 'lnk', 'url', 'bat', 'cmd'] }],
  });
  if (r.canceled) return { added: null, library: view() };
  const exe = r.filePaths[0];
  const id = `custom:${crypto.randomUUID()}`;
  library.games[id] = {
    id, source: 'custom', exe, name: path.basename(exe).replace(/\.(exe|lnk|url|bat|cmd)$/i, ''),
    localMinutes: 0, lastPlayed: 0, addedAt: Date.now(),
  };
  saveLibrary();
  return { added: id, library: view() };
});
ipcMain.handle('app:fullscreen', () => { if (win) { win.setFullScreen(!win.isFullScreen()); } return win?.isFullScreen(); });
ipcMain.handle('app:quit', () => { quitting = true; app.quit(); });
ipcMain.handle('app:guideStatus', () => ({ available: guide.available(), watching: !!guideWatch }));
ipcMain.handle('app:minimize', () => win?.minimize());
ipcMain.handle('app:openUrl', (_e, url) => {
  if (/^https:\/\/(steamcommunity\.com|store\.steampowered\.com|www\.steamgriddb\.com)\//.test(url)) shell.openExternal(url);
});

// ---------- window ----------
// ---------- background mode, tray & the Guide button ----------
let quitting = false;
let tray = null;
let guideWatch = null;
const startHidden = process.argv.includes('--hidden');

function summon() {
  if (!win || win.isDestroyed()) { createWindow(true); return; }
  if (win.isMinimized()) win.restore();
  win.show();
  win.setAlwaysOnTop(true);
  guide.forceForeground(win);
  win.focus();
  setTimeout(() => { if (win && !win.isDestroyed()) win.setAlwaysOnTop(false); }, 400);
  if (settings.fullscreen && !win.isFullScreen()) win.setFullScreen(true);
}

function onGuide() {
  if (win && !win.isDestroyed() && win.isVisible() && win.isFocused() && !win.isMinimized()) send('guide', { home: true });
  else { summon(); send('guide', { summoned: true }); }
}

function applyBackground() {
  const want = steam.IS_WIN && (settings.background || settings.guideButton);
  if (want && !tray) {
    const img = nativeImage.createFromPath(path.join(__dirname, '..', 'icon.png')).resize({ width: 32, height: 32 });
    tray = new Tray(img);
    tray.setToolTip('Lobby');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Открыть Lobby', click: summon },
      { type: 'separator' },
      { label: 'Выйти', click: () => { quitting = true; app.quit(); } },
    ]));
    tray.on('click', summon);
  } else if (!want && tray) { tray.destroy(); tray = null; }
  if (settings.guideButton && !guideWatch) {
    const w = guide.watch(onGuide);
    if (w.ok) guideWatch = w;
  } else if (!settings.guideButton && guideWatch) { guideWatch.stop(); guideWatch = null; }
}

function createWindow(showNow = false) {
  win = new BrowserWindow({
    width: 1600, height: 900, minWidth: 1100, minHeight: 640,
    fullscreen: !!settings.fullscreen, frame: false, backgroundColor: '#000000',
    autoHideMenuBar: true, show: false, title: 'Lobby',
    icon: path.join(__dirname, '..', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, sandbox: true, backgroundThrottling: false,
    },
  });
  win.setMenu(null);
  win.once('ready-to-show', () => { if (!startHidden || showNow) win.show(); });
  // closing hides to the tray in background mode, so the Guide button can bring Lobby back instantly
  // minimise / restore sounds are played by the page; the first show at start-up has its own chord
  let shown = false;
  const winSound = (kind) => { if (shown) send('win-state', kind); };
  win.on('show', () => { if (shown) winSound('restore'); shown = true; });
  win.on('restore', () => winSound('restore'));
  win.on('minimize', () => winSound('minimize'));
  win.on('hide', () => winSound('minimize'));
  win.on('close', (e) => {
    if (!quitting && settings.background && steam.IS_WIN) { e.preventDefault(); win.hide(); }
  });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => summon());
  app.on('before-quit', () => { quitting = true; });
  app.whenReady().then(() => {
    if (settings.autostart && steam.IS_WIN) app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] }); // re-point at Lobby.exe
    createWindow();
    applyBackground();
    applyRemote();
    // controller battery, once every 20 s (only sends when something changed)
    let lastBat = '';
    const pollBattery = () => {
      const b = guide.batteries();
      const sig = JSON.stringify(b);
      if (sig !== lastBat) { lastBat = sig; send('pad-battery', b); }
    };
    setInterval(pollBattery, 20000);
    setInterval(() => { if (bro.ensureToday()) send('bro', { state: bro.view(), newDay: true }); }, 10 * 60e3);
    setTimeout(pollBattery, 3000);
    ipcMain.handle('pad:battery', () => guide.batteries());
    if (steam.IS_WIN) {
      setTimeout(() => { if (settings.autoUpdate) checkUpdate(false); }, 12000);
      setInterval(() => { if (settings.autoUpdate) checkUpdate(false); }, 6 * 3600e3);
    }
    setInterval(pollDownloads, 2500);
  });
  app.on('window-all-closed', () => { if (!tray) app.quit(); });
}

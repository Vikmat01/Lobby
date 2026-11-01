// Epic Games: installed games from local manifests (no login) and the full library via account login.
// Uses the same public client and endpoints as Legendary / Heroic / Playnite.
'use strict';
const fs = require('fs');
const path = require('path');

const CLIENT_ID = '34a02cf8f4414e29b15921876da36f9a';
const CLIENT_SECRET = 'daafbccc737745039dffe53d94fc76cf';
const BASIC = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
const OAUTH = 'https://account-public-service-prod03.ol.epicgames.com/account/api/oauth/token';
const LIBRARY = 'https://library-service.live.use1a.on.epicgames.com/library/api/public';
const CATALOG = 'https://catalog-public-service-prod06.ol.epicgames.com/catalog/api/shared/namespace';
const REDIRECT = `https://www.epicgames.com/id/api/redirect?clientId=${CLIENT_ID}&responseType=code`;
const LOGIN_URL = `https://www.epicgames.com/id/login?redirectUrl=${encodeURIComponent(REDIRECT)}`;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';

const IS_WIN = process.platform === 'win32';
const PROGRAM_DATA = process.env.ProgramData || 'C:\\ProgramData';
const MANIFEST_DIR = path.join(PROGRAM_DATA, 'Epic', 'EpicGamesLauncher', 'Data', 'Manifests');

// ---------- local install manifests ----------
function scanInstalled() {
  const out = {};
  let files = [];
  try { files = fs.readdirSync(MANIFEST_DIR).filter((f) => f.toLowerCase().endsWith('.item')); } catch { return out; }
  for (const f of files) {
    let m;
    try { m = JSON.parse(fs.readFileSync(path.join(MANIFEST_DIR, f), 'utf8')); } catch { continue; }
    if (!m || !m.AppName || !m.DisplayName) continue;
    if (m.MainGameAppName && m.MainGameAppName !== m.AppName) continue; // DLC
    if (m.CatalogNamespace === 'ue' || /^UE_/i.test(m.AppName)) continue; // Unreal Engine itself
    const exe = m.InstallLocation && m.LaunchExecutable ? path.join(m.InstallLocation, m.LaunchExecutable) : null;
    out[m.AppName] = {
      appName: m.AppName,
      name: m.DisplayName,
      namespace: m.CatalogNamespace || '',
      catalogItemId: m.CatalogItemId || '',
      installDir: m.InstallLocation || '',
      exe,
      size: Number(m.InstallSize || 0),
      complete: !m.bIsIncompleteInstall,
    };
  }
  return out;
}

const launcherInstalled = () => IS_WIN && fs.existsSync(path.join(PROGRAM_DATA, 'Epic', 'EpicGamesLauncher'));

// ---------- auth ----------
async function oauth(form) {
  const r = await fetch(OAUTH, {
    method: 'POST',
    headers: { Authorization: `basic ${BASIC}`, 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: new URLSearchParams({ ...form, token_type: 'eg1' }).toString(),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(j.errorMessage || `Epic: ошибка входа ${r.status}`);
    e.code = j.errorCode || 'AUTH';
    throw e;
  }
  return {
    accessToken: j.access_token,
    refreshToken: j.refresh_token,
    expiresAt: Date.parse(j.expires_at) || Date.now() + (j.expires_in || 3600) * 1000,
    refreshExpiresAt: Date.parse(j.refresh_expires_at) || Date.now() + (j.refresh_expires || 0) * 1000,
    accountId: j.account_id,
    displayName: j.displayName || '',
  };
}
const exchangeCode = (code) => oauth({ grant_type: 'authorization_code', code: String(code).trim() });
const refresh = (tok) => oauth({ grant_type: 'refresh_token', refresh_token: tok.refreshToken });

// pull the code out of whatever the user pasted: the bare code, the JSON page, or a URL with ?code=
function parseCode(text) {
  const s = String(text || '').trim();
  const m = s.match(/"authorizationCode"\s*:\s*"([0-9a-f]{32})"/i) || s.match(/[?&]code=([0-9a-f]{32})/i) || s.match(/\b([0-9a-f]{32})\b/i);
  return m ? m[1] : null;
}

// ---------- library ----------
async function get(url, tok) {
  const r = await fetch(url, { headers: { Authorization: `bearer ${tok.accessToken}`, 'User-Agent': UA } });
  if (r.status === 401) { const e = new Error('Сессия Epic истекла — войди заново'); e.code = 'EXPIRED'; throw e; }
  if (!r.ok) throw new Error(`Epic: ошибка ${r.status}`);
  return r.json();
}

async function libraryItems(tok) {
  const items = [];
  let cursor = null;
  for (let page = 0; page < 40; page++) {
    const url = `${LIBRARY}/items?includeMetadata=true${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const j = await get(url, tok);
    items.push(...(j.records || []));
    cursor = j.responseMetadata && j.responseMetadata.nextCursor;
    if (!cursor) break;
  }
  return items.filter((r) => r.appName && r.namespace && r.namespace !== 'ue' && r.catalogItemId && (r.sandboxType || 'PUBLIC') !== 'PRIVATE');
}

async function playtime(tok) {
  try {
    const j = await get(`${LIBRARY}/playtime/account/${tok.accountId}/all`, tok);
    const out = {};
    for (const p of j || []) if (p.artifactId) out[p.artifactId] = Math.round((p.totalTime || 0) / 60);
    return out;
  } catch (e) { if (e.code === 'EXPIRED') throw e; return {}; }
}

function pickImage(images, types) {
  for (const t of types) {
    const im = (images || []).find((i) => i.type === t && i.url);
    if (im) return im.url;
  }
  return null;
}

async function catalogItem(tok, namespace, id) {
  const j = await get(`${CATALOG}/${encodeURIComponent(namespace)}/bulk/items?id=${encodeURIComponent(id)}&includeDLCDetails=true&includePeripheralDetails=true&country=US&locale=ru`, tok);
  const it = j && j[id];
  if (!it) return null;
  const cats = (it.categories || []).map((c) => c.path);
  return {
    title: it.title,
    isDlc: !!it.mainGameItem,
    isGame: !cats.length || cats.includes('games') || cats.includes('applications'),
    cover: pickImage(it.keyImages, ['DieselGameBoxTall', 'OfferImageTall', 'Thumbnail']),
    wide: pickImage(it.keyImages, ['DieselGameBox', 'OfferImageWide', 'DieselStoreFrontWide', 'featuredMedia']),
    logo: pickImage(it.keyImages, ['DieselGameBoxLogo']),
  };
}

// run fn over items, n at a time
async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; try { out[k] = await fn(items[k]); } catch (e) { if (e.code === 'EXPIRED') throw e; out[k] = null; } }
  }));
  return out;
}

// Epic's CDN resizes on the fly — ask for sensible sizes instead of 4K originals
function sized(url, w, h) {
  if (!url) return null;
  if (!/epicgames\.com/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}w=${w}&h=${h}&resize=1&quality=high`;
}

const launchUri = (g) => `com.epicgames.launcher://apps/${encodeURIComponent(`${g.namespace}:${g.catalogItemId}:${g.appName}`)}?action=launch&silent=true`;
const installUri = (g) => `com.epicgames.launcher://apps/${encodeURIComponent(`${g.namespace}:${g.catalogItemId}:${g.appName}`)}?action=install`;

module.exports = {
  LOGIN_URL, REDIRECT, UA, scanInstalled, launcherInstalled, exchangeCode, refresh, parseCode,
  libraryItems, playtime, catalogItem, pool, sized, launchUri, installUri,
};

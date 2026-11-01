// Steam achievements: schema (names, icons), the player's progress and global rarity, cached on disk.
'use strict';
const fs = require('fs');
const path = require('path');

const API = 'https://api.steampowered.com';
const SCHEMA_TTL = 7 * 864e5;
const GLOBAL_TTL = 3 * 864e5;
const PLAYER_TTL = 10 * 60e3;

function create({ dir, getKey, getSteamId }) {
  fs.mkdirSync(dir, { recursive: true });
  const mem = new Map();
  const file = (appid) => path.join(dir, `${appid}.json`);
  const load = (appid) => {
    if (mem.has(appid)) return mem.get(appid);
    let c = null;
    try { c = JSON.parse(fs.readFileSync(file(appid), 'utf8')); } catch { c = {}; }
    mem.set(appid, c);
    return c;
  };
  const save = (appid, c) => { mem.set(appid, c); fs.writeFileSync(file(appid), JSON.stringify(c)); };

  async function get(url) {
    const r = await fetch(url, { headers: { 'User-Agent': 'Lobby' } });
    let j = null;
    try { j = await r.json(); } catch { /* not json */ }
    if (r.status === 403 && j && j.playerstats && /not public/i.test(j.playerstats.error || '')) {
      const e = new Error('Профиль Steam скрыт: открой «Сведения об играх» в настройках приватности Steam');
      e.code = 'PRIVATE';
      throw e;
    }
    if (r.status === 401 || r.status === 403) { const e = new Error('Steam отклонил ключ API'); e.code = 'KEY'; throw e; }
    if (!r.ok && !(j && j.playerstats)) throw new Error(`Steam: ошибка ${r.status}`);
    return j;
  }

  async function schema(appid, c) {
    if (c.schema && Date.now() - c.schemaAt < SCHEMA_TTL) return c.schema;
    const j = await get(`${API}/ISteamUserStats/GetSchemaForGame/v2/?key=${encodeURIComponent(getKey())}&appid=${appid}&l=russian`);
    const list = (j && j.game && j.game.availableGameStats && j.game.availableGameStats.achievements) || [];
    c.schema = list.map((a) => ({ id: a.name, name: a.displayName || a.name, desc: a.description || '', icon: a.icon, gray: a.icongray, hidden: !!a.hidden }));
    c.schemaAt = Date.now();
    return c.schema;
  }

  async function rarity(appid, c) {
    if (c.global && Date.now() - c.globalAt < GLOBAL_TTL) return c.global;
    try {
      const j = await get(`${API}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid=${appid}`);
      const out = {};
      for (const a of (j && j.achievementpercentages && j.achievementpercentages.achievements) || []) out[a.name] = Number(a.percent) || 0;
      c.global = out;
      c.globalAt = Date.now();
    } catch { c.global = c.global || {}; }
    return c.global;
  }

  async function player(appid, c, force) {
    if (!force && c.player && Date.now() - c.playerAt < PLAYER_TTL) return c.player;
    const j = await get(`${API}/ISteamUserStats/GetPlayerAchievements/v1/?key=${encodeURIComponent(getKey())}&steamid=${getSteamId()}&appid=${appid}&l=russian`);
    const ps = j && j.playerstats;
    if (!ps || ps.success === false) { c.player = {}; c.playerAt = Date.now(); return c.player; }
    const out = {};
    for (const a of ps.achievements || []) {
      if (a.achieved) out[a.apiname] = { t: (a.unlocktime || 0) * 1000 };
      // hidden achievements only reveal their text through the player's own list
      if (a.description) (c.text || (c.text = {}))[a.apiname] = a.description;
    }
    c.player = out;
    c.playerAt = Date.now();
    return out;
  }

  // full data for one game: [{id,name,desc,icon,unlocked,time,pct}], plus summary
  async function forGame(appid, { force = false } = {}) {
    if (!getKey() || !getSteamId()) { const e = new Error('Нужен ключ Steam Web API'); e.code = 'NOKEY'; throw e; }
    appid = String(appid);
    const c = load(appid);
    const list = await schema(appid, c);
    if (!list.length) { save(appid, c); return { appid, total: 0, unlocked: 0, items: [] }; }
    const [p, g] = await Promise.all([player(appid, c, force), rarity(appid, c)]);
    save(appid, c);
    const items = list.map((a) => {
      const u = p[a.id];
      const desc = a.desc || (c.text && c.text[a.id]) || '';
      return {
        id: a.id, name: a.name, desc, hidden: a.hidden && !u && !a.desc,
        icon: u ? a.icon : a.gray, unlocked: !!u, time: u ? u.t : 0, pct: g[a.id] ?? null,
      };
    });
    const unlocked = items.filter((i) => i.unlocked).length;
    return { appid, total: items.length, unlocked, items };
  }

  const summary = (d) => ({ t: d.total, u: d.unlocked, last: d.items.reduce((m, i) => Math.max(m, i.time), 0) });

  // what got unlocked since `before` (a set of ids)
  async function newSince(appid, before) {
    const d = await forGame(appid, { force: true });
    return { data: d, fresh: d.items.filter((i) => i.unlocked && !before.has(i.id)) };
  }

  return { forGame, summary, newSince, cached: (appid) => load(String(appid)) };
}

module.exports = { create };

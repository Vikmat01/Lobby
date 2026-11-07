// Steam friends: who is online, what they play, recent games and games in common. Short in-memory cache.
'use strict';

const API = 'https://api.steampowered.com';
const LIST_TTL = 45e3;
const DETAIL_TTL = 5 * 60e3;

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'Lobby' } });
  if (r.status === 401 || r.status === 403) { const e = new Error('Steam не отдаёт данные'); e.code = r.status; throw e; }
  if (!r.ok) throw new Error(`Steam: ошибка ${r.status}`);
  return r.json();
}

function create({ getKey, getSteamId }) {
  let list = null;
  const details = new Map();

  async function summaries(ids) {
    const out = [];
    for (let i = 0; i < ids.length; i += 100) {
      const j = await get(`${API}/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(getKey())}&steamids=${ids.slice(i, i + 100).join(',')}`);
      for (const p of (j.response && j.response.players) || []) {
        out.push({
          id: p.steamid, name: p.personaname || 'Без имени', avatar: p.avatarfull || p.avatarmedium || null,
          state: p.personastate || 0, game: p.gameextrainfo || null, gameId: p.gameid || null, lobby: p.lobbysteamid || null,
          lastOff: (p.lastlogoff || 0) * 1000, url: p.profileurl || `https://steamcommunity.com/profiles/${p.steamid}/`,
          open: p.communityvisibilitystate === 3,
        });
      }
    }
    return out;
  }

  async function friends(force) {
    if (!getKey() || !getSteamId()) return { error: 'Нужен ключ Steam Web API', code: 'NOKEY', friends: [] };
    if (!force && list && Date.now() - list.at < LIST_TTL) return list.data;
    let data;
    try {
      const j = await get(`${API}/ISteamUser/GetFriendList/v1/?key=${encodeURIComponent(getKey())}&steamid=${getSteamId()}&relationship=friend`);
      const rel = (j.friendslist && j.friendslist.friends) || [];
      const since = Object.fromEntries(rel.map((f) => [f.steamid, (f.friend_since || 0) * 1000]));
      const people = rel.length ? await summaries(rel.map((f) => f.steamid)) : [];
      for (const p of people) p.since = since[p.id] || 0;
      data = { friends: people, at: Date.now() };
    } catch (e) {
      if (e.code === 401 || e.code === 403) data = { friends: [], code: 'PRIVATE', error: 'Steam скрывает список друзей: в настройках приватности профиля Steam сделай «Список друзей» открытым' };
      else data = { friends: list ? list.data.friends : [], error: e.message, stale: !!list };
    }
    if (!data.error) list = { at: Date.now(), data };
    return data;
  }

  // recent games, Steam level and games in common with `mine` ({appid: minutes})
  async function detail(id, mine) {
    const c = details.get(id);
    if (c && Date.now() - c.at < DETAIL_TTL) return c.data;
    const key = encodeURIComponent(getKey());
    const safe = (p) => p.catch(() => null);
    const [recent, owned, level] = await Promise.all([
      safe(get(`${API}/IPlayerService/GetRecentlyPlayedGames/v1/?key=${key}&steamid=${id}&count=12`)),
      safe(get(`${API}/IPlayerService/GetOwnedGames/v1/?key=${key}&steamid=${id}&include_appinfo=1&include_played_free_games=1`)),
      safe(get(`${API}/IPlayerService/GetSteamLevel/v1/?key=${key}&steamid=${id}`)),
    ]);
    const games = (owned && owned.response && owned.response.games) || null;
    const data = {
      level: level && level.response ? level.response.player_level ?? null : null,
      recent: ((recent && recent.response && recent.response.games) || []).map((g) => ({ appid: String(g.appid), name: g.name, week2: g.playtime_2weeks || 0, total: g.playtime_forever || 0 })),
      gamesHidden: !games,
      owned: games ? games.length : null,
      common: games ? games.filter((g) => mine[String(g.appid)] != null)
        .map((g) => ({ appid: String(g.appid), name: g.name, theirs: g.playtime_forever || 0, mine: mine[String(g.appid)] }))
        .sort((a, b) => (b.theirs + b.mine) - (a.theirs + a.mine)) : [],
    };
    details.set(id, { at: Date.now(), data });
    return data;
  }

  return { friends, detail };
}

module.exports = { create };

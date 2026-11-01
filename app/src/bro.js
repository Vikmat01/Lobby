// Game Bro: daily challenges for games you have installed, experience and levels. All local.
'use strict';
const fs = require('fs');

// level perks (the highest level ever reached counts, so prestige keeps them)
const PERK_REROLL = 10;   // +1 reroll a day
const PERK_SLOT = 20;     // 4th daily challenge
const PERK_WEEKLY = 25;   // weekly challenge with double experience
const PRESTIGE_AT = 50;
const slotsFor = (lv) => 3 + (lv >= PERK_SLOT ? 1 : 0);
const rerollsFor = (lv) => 2 + (lv >= PERK_REROLL ? 1 : 0);

// experience needed to go from `level` to the next one; grows with every level
const need = (level) => Math.round(100 * Math.pow(level, 1.4));
function levelOf(xp) {
  let level = 1;
  let left = xp;
  while (left >= need(level)) { left -= need(level); level++; }
  return { level, into: left, need: need(level) };
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// Monday of the current week, local time
const weekId = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const minutesOf = (g) => (g.steamMinutes || 0) + (g.epicMinutes || 0) + (g.localMinutes || 0);
const installed = (g) => !g.hidden && (g.source === 'custom' || g.installed);

function create({ file, getGames }) {
  let s;
  try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { s = null; }
  if (!s || typeof s.xp !== 'number') s = { xp: 0, day: '', challenges: [], rerolls: 2, done: 0, history: [] };
  s.prestige = s.prestige || 0;
  s.peak = Math.max(s.peak || 1, levelOf(s.xp).level);
  const perkLv = () => Math.max(s.peak, levelOf(s.xp).level);
  const save = () => { try { fs.writeFileSync(file, JSON.stringify(s)); } catch { /* disk full etc. */ } };

  function make(kind, g) {
    const name = g.customName || g.name;
    const id = `${kind}:${g.id}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    if (kind === 'first') return { id, kind, gameId: g.id, name, target: 15, progress: 0, xp: 80 };
    if (kind === 'return') { const t = pick([20, 30, 40]); return { id, kind, gameId: g.id, name, target: t, progress: 0, xp: t * 3 }; }
    if (kind === 'ach') return { id, kind, gameId: g.id, name, target: 1, progress: 0, xp: 120 };
    const t = pick([20, 30, 45, 60]);
    return { id, kind: 'play', gameId: g.id, name, target: t, progress: 0, xp: t * 2 };
  }

  // one favourite, one forgotten or never-launched, one achievement hunt (or another game)
  function generate(exclude = new Set(), slots = slotsFor(perkLv())) {
    const pool = getGames().filter(installed).filter((g) => !exclude.has(g.id));
    const used = new Set();
    const out = [];
    const take = (list, kind) => {
      const c = list.filter((g) => !used.has(g.id));
      if (!c.length) return false;
      const g = pick(c);
      used.add(g.id);
      out.push(make(kind, g));
      return true;
    };
    const monthAgo = Date.now() - 21 * 864e5;
    const plan = [
      () => take([...pool].sort((a, b) => minutesOf(b) - minutesOf(a)).slice(0, 5).filter((g) => minutesOf(g) > 0), 'play'),
      () => take(pool.filter((g) => !minutesOf(g)), 'first') || take(pool.filter((g) => g.lastPlayed && g.lastPlayed < monthAgo), 'return'),
      () => take(pool.filter((g) => g.source === 'steam' && g.ach && g.ach.t && g.ach.u < g.ach.t), 'ach'),
    ];
    for (const step of plan) { if (out.length < slots) step(); }
    while (out.length < slots && take(pool, 'play')) { /* fill with any installed game */ }
    return out;
  }

  function ensureWeek() {
    if (perkLv() < PERK_WEEKLY) return false;
    const w = weekId();
    if (s.week && s.week.week === w) return false;
    const t = pick([180, 240, 300]);
    s.week = { id: `week:${w}`, kind: 'week', week: w, name: 'любые игры', target: t, progress: 0, xp: t * 4 };
    return true;
  }

  function ensureToday() {
    const d = today();
    const wk = ensureWeek();
    if (s.day === d && s.challenges.length) { if (wk) save(); return wk; }
    if (s.day !== d) s.rerolls = rerollsFor(perkLv());
    s.day = d;
    s.challenges = generate();
    save();
    return true;
  }

  // a level crossed a perk threshold in the middle of the day: give the bonus right away
  function perksReached(from, to) {
    if (from < PERK_REROLL && to >= PERK_REROLL) s.rerolls++;
    if (from < PERK_SLOT && to >= PERK_SLOT) {
      const [more] = generate(new Set(s.challenges.map((c) => c.gameId)), 1);
      if (more) s.challenges.push(more);
    }
    if (from < PERK_WEEKLY && to >= PERK_WEEKLY) ensureWeek();
  }

  function award(c, events) {
    c.done = true;
    c.doneAt = Date.now();
    const before = levelOf(s.xp).level;
    const peakBefore = perkLv();
    s.xp += c.xp;
    s.done = (s.done || 0) + 1;
    s.history = [{ name: c.name, kind: c.kind, target: c.target, xp: c.xp, at: c.doneAt }, ...(s.history || [])].slice(0, 30);
    const after = levelOf(s.xp).level;
    s.peak = Math.max(s.peak, after);
    if (perkLv() > peakBefore) perksReached(peakBefore, perkLv());
    // `from` is the highest level reached before, so rewards are only announced the first time
    events.push({ challenge: c, levelUp: after > before ? after : 0, from: peakBefore, to: perkLv() });
  }

  // minutes played in a game launched from Lobby
  function played(gameId, minutes) {
    ensureToday();
    const events = [];
    const w = s.week; // taken first: a weekly challenge unlocked by this very session starts from zero
    for (const c of s.challenges) {
      if (c.done || c.gameId !== gameId || c.kind === 'ach' || minutes <= 0) continue;
      c.progress = Math.min(c.target, c.progress + minutes);
      if (c.progress >= c.target) award(c, events);
    }
    if (w && !w.done && minutes > 0) {
      w.progress = Math.min(w.target, w.progress + minutes);
      if (w.progress >= w.target) award(w, events);
    }
    save();
    return events;
  }

  function unlocked(gameId, count) {
    ensureToday();
    const events = [];
    for (const c of s.challenges) {
      if (c.done || c.gameId !== gameId || c.kind !== 'ach' || count <= 0) continue;
      c.progress = 1;
      award(c, events);
    }
    save();
    return events;
  }

  function reroll(id) {
    ensureToday();
    if (s.rerolls <= 0) return { error: 'Замены на сегодня закончились' };
    const i = s.challenges.findIndex((c) => c.id === id && !c.done);
    if (i < 0) return { error: 'Этот челлендж уже не заменить' };
    const exclude = new Set(s.challenges.map((c) => c.gameId));
    const [fresh] = generate(exclude, 1);
    if (!fresh) return { error: 'Нет других установленных игр для замены' };
    s.challenges[i] = fresh;
    s.rerolls--;
    save();
    return { ok: true };
  }

  // from level 50: start over from level 1 with a star; everything unlocked stays unlocked
  function prestige() {
    const lv = levelOf(s.xp).level;
    if (lv < PRESTIGE_AT) return { error: `Престиж откроется на ${PRESTIGE_AT} уровне` };
    s.peak = Math.max(s.peak, lv);
    s.prestige++;
    s.xp = 0;
    save();
    return { ok: true, prestige: s.prestige };
  }

  function view() {
    ensureToday();
    return {
      xp: s.xp, ...levelOf(s.xp), challenges: s.challenges, rerolls: s.rerolls, done: s.done || 0,
      history: (s.history || []).slice(0, 10), week: perkLv() >= PERK_WEEKLY ? s.week || null : null,
      prestige: s.prestige, peak: perkLv(), canPrestige: levelOf(s.xp).level >= PRESTIGE_AT,
    };
  }

  return { view, played, unlocked, reroll, prestige, ensureToday };
}

module.exports = { create, levelOf, need, PRESTIGE_AT };

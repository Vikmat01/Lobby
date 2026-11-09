'use strict';
/* global api */

// =====================================================================
// helpers
// =====================================================================
const $ = (s, r = document) => r.querySelector(s);
const SVGNS = 'http://www.w3.org/2000/svg';

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k === 'nav') { el.setAttribute('data-nav', ''); if (v !== true) el.dataset.row = v; }
    else if (k === 'act') el._act = v;
    else if (k === 'alt') el._alt = v;
    else if (k === 'onfocus') el._focus = v;
    else if (k === 'key') el.dataset.key = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
function icon(pathD, { size = 22, fill = false } = {}) {
  const s = document.createElementNS(SVGNS, 'svg');
  s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.setAttribute('fill', fill ? 'currentColor' : 'none');
  if (!fill) { s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); }
  for (const d of [].concat(pathD)) { const p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', d); s.append(p); }
  return s;
}
const I = {
  play: () => icon('M6 4l14 8-14 8z', { size: 18, fill: true }),
  more: () => icon(['M5 12h.01', 'M12 12h.01', 'M19 12h.01'], { size: 26 }),
  grid: () => icon(['M3 3h7v7H3z', 'M14 3h7v7h-7z', 'M3 14h7v7H3z', 'M14 14h7v7h-7z'], { size: 44 }),
  plus: () => icon(['M12 5v14', 'M5 12h14'], { size: 44 }),
  download: () => icon(['M12 3v12', 'M7 10l5 5 5-5', 'M5 21h14'], { size: 20 }),
  users: (size = 14) => icon(['M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20', 'M10 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z', 'M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4', 'M15.5 4.6a3.5 3.5 0 0 1 0 6.8'], { size }),
  trophy: (size = 14) => icon(['M8 21h8', 'M12 17v4', 'M7 4h10v5a5 5 0 0 1-10 0z', 'M17 5h3v2a3 3 0 0 1-3 3', 'M7 5H4v2a3 3 0 0 0 3 3'], { size }),
  lock: (size = 14) => icon(['M6 11h12v10H6z', 'M8 11V7a4 4 0 0 1 8 0v4'], { size }),
};

// Title in a fixed-height box: shrink on one line first, then allow two lines, so layout never jumps.
function titleBox(text, { max, min, wrapAt }) {
  const span = h('span', { text });
  const box = h('h1', { class: 'fit-title' }, span);
  box._fit = { max, min, wrapAt };
  requestAnimationFrame(() => fitTitle(box));
  return box;
}
function fitTitle(box) {
  if (!box.isConnected || !box._fit) return;
  const span = box.firstChild, { max, min, wrapAt } = box._fit;
  box.classList.remove('wrap');
  let size = max;
  span.style.fontSize = `${size}px`;
  while (span.scrollWidth > span.clientWidth + 1 && size > min) { size -= 2; span.style.fontSize = `${size}px`; }
  if (span.scrollWidth > span.clientWidth + 1) { box.classList.add('wrap'); span.style.fontSize = `${wrapAt}px`; }
}
const refitAll = () => document.querySelectorAll('.fit-title').forEach(fitTitle);
document.fonts && document.fonts.ready.then(refitAll);

function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
const gamesWord = (n) => `${n} ${plural(n, 'игра', 'игры', 'игр')}`;
function fmtTime(min) {
  if (!min) return 'не запускалась';
  if (min < 60) return `${min} мин`;
  const hrs = min / 60;
  return hrs < 10 ? `${(Math.round(hrs * 10) / 10).toLocaleString('ru-RU')} ч` : `${Math.round(hrs).toLocaleString('ru-RU')} ч`;
}
function fmtAgo(ts) {
  if (!ts) return 'никогда';
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const days = Math.round((d0 - new Date(ts).setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return 'сегодня';
  if (days === 1) return 'вчера';
  if (days < 7) return `${days} ${plural(days, 'день', 'дня', 'дней')} назад`;
  const d = new Date(ts);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', ...(d.getFullYear() !== d0.getFullYear() ? { year: 'numeric' } : {}) });
}
function fmtClock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
function hash(str) { let x = 2166136261; for (const c of str) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619); } return x >>> 0; }

// =====================================================================
// state
// =====================================================================
const TABS = [
  { id: 'home', label: 'Главная' },
  { id: 'library', label: 'Библиотека' },
  { id: 'steam', label: 'Steam' },
  { id: 'epic', label: 'Epic' },
  { id: 'custom', label: 'Мои игры' },
  { id: 'friends', label: 'Друзья' },
  { id: 'trophies', label: 'Трофеи' },
];
const SOURCE = { steam: 'Steam', epic: 'Epic Games', custom: 'Своя игра' };
// all bright enough for black text on accent buttons
const ACCENT_LIST = [
  ['#3FD1A9', 'Мята'], ['#2DD4CF', 'Бирюза'], ['#5AA9F2', 'Небо'], ['#6E8BFF', 'Синий'],
  ['#8B7CFF', 'Индиго'], ['#B794F6', 'Лаванда'], ['#D77BF0', 'Орхидея'], ['#FF6FB5', 'Розовый'],
  ['#FF5A5F', 'Красный'], ['#FF7A6B', 'Коралл'], ['#F2A65A', 'Апельсин'], ['#FFC145', 'Янтарь'],
  ['#E4E85A', 'Лимон'], ['#7ED957', 'Лайм'], ['#3DDC84', 'Изумруд'], ['#E8E8E8', 'Платина'],
];
const ACCENTS = ACCENT_LIST.map(([c]) => c);
const accentName = (c) => (ACCENT_LIST.find(([x]) => x.toLowerCase() === String(c || '').toLowerCase()) || [null, 'Свой'])[1];
const PALETTE = [
  ['#1E3550', '#F2B866'], ['#141B3A', '#9AA8FF'], ['#3A1E1E', '#FF8A65'], ['#23331F', '#B5E08A'],
  ['#2B2440', '#E6B8FF'], ['#33291A', '#F2C46D'], ['#1C3B4A', '#7FD3E8'], ['#4A1F24', '#FF7A6B'],
  ['#1E2350', '#8FA2FF'], ['#14303A', '#5FE0C8'], ['#4F2A1A', '#FFB07A'], ['#2E2E48', '#F5D06B'],
];
const S = {
  games: [], profile: null, settings: {}, lastSync: 0,
  input: 'kb', tab: 'home', libSort: 'played', libFilter: 'installed', downloads: [], epic: { account: null, launcher: false },
  heroGame: null, syncing: false, session: null,
  focused: null, scale: 1,
};
const byId = (id) => S.games.find((g) => g.id === id);
const visibleGames = () => S.games.filter((g) => !g.hidden);

function applyLibrary(lib) {
  if (!lib) return;
  S.games = lib.games || [];
  S.profile = lib.profile || null;
  S.lastSync = lib.lastSync || 0;
  if (lib.epic) S.epic = lib.epic;
  if (lib.session !== undefined) S.session = lib.session;
}

// =====================================================================
// layout scaling: the UI is drawn at 1080p and scaled to the window
// =====================================================================
const UI_SCALES = [75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 140, 150];
function fit() {
  const k = (S.settings.uiScale || 100) / 100;
  const s = Math.min(innerHeight / 1080, innerWidth / 1440) * k;
  S.scale = s;
  document.documentElement.style.setProperty('--s', s);
  document.documentElement.style.setProperty('--w', `${innerWidth / s}px`);
  document.documentElement.style.setProperty('--h', `${innerHeight / s}px`);
}
addEventListener('resize', () => { fit(); refitAll(); if (S.focused) reveal(S.focused, false); });

// =====================================================================
// images: try each source in order, lazily, cached
// =====================================================================
const artCache = new Map();
function firstOk(urls) {
  const key = urls.join('|');
  if (artCache.has(key)) return artCache.get(key);
  const p = new Promise((res) => {
    let i = 0;
    const next = () => {
      if (i >= urls.length) return res(null);
      const u = urls[i++];
      const im = new Image();
      im.onload = () => (im.naturalWidth > 8 ? res(u) : next());
      im.onerror = next;
      im.src = u;
    };
    next();
  });
  artCache.set(key, p);
  return p;
}
const lazy = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    lazy.unobserve(e.target);
    const img = e.target;
    firstOk(img._urls || []).then(async (u) => {
      if (u) { img.src = u; img.classList.add('ok'); return; }
      if (!img._fallback || !img._fallback.length) return;
      const w = await firstOk(img._fallback);
      if (!w || !img.isConnected) return;
      const blur = h('img', { alt: '', draggable: 'false', class: 'blur ok', src: w });
      img.before(blur);
      img.parentElement?.querySelector('.ph')?.remove();
      img.src = w; img.classList.add('ok', 'fit');
    });
  }
}, { rootMargin: '400px' });
function artImg(urls) {
  const img = h('img', { alt: '', draggable: 'false' });
  if (urls && urls.length) { img._urls = urls; lazy.observe(img); }
  return img;
}
// vertical cover; if a game has none (demos, small titles) show its wide art fitted over a blurred copy
function coverImg(g) {
  const wrap = document.createDocumentFragment();
  const img = h('img', { alt: '', draggable: 'false' });
  img._urls = g.art.cover;
  img._fallback = g.art.wide;
  lazy.observe(img);
  wrap.append(img);
  return wrap;
}
function placeholder(g) {
  const [bg, fg] = PALETTE[hash(g.name) % PALETTE.length];
  const round = hash(g.id) % 2 === 0;
  return h('div', { class: 'ph', style: `background:${bg}` },
    h('div', { class: 'shape', style: `background:${fg};border-radius:${round ? '50%' : '8px'}` }),
    h('div', { class: 'ph-title', text: g.name }));
}

// =====================================================================
// hero background (home)
// =====================================================================
let heroToken = 0;
function setHeroArt(urls) {
  const token = ++heroToken;
  const [a, b] = document.querySelectorAll('#hero-art .hero-img');
  const show = (u) => {
    if (token !== heroToken) return;
    const cur = a.classList.contains('on') ? a : b;
    const nxt = cur === a ? b : a;
    if (!u) { cur.classList.remove('on'); nxt.classList.remove('on'); return; }
    nxt.style.backgroundImage = `url("${u.replace(/"/g, '%22')}")`;
    nxt.classList.add('on'); cur.classList.remove('on');
  };
  if (!urls || !urls.length) return show(null);
  firstOk(urls).then(show);
}

// =====================================================================
// focus & spatial navigation
// =====================================================================
const layers = [];
const rowMemory = new Map();

function scopeEls() {
  if (layers.length) return [...layers[layers.length - 1].el.querySelectorAll('[data-nav]')];
  return [...document.querySelectorAll('#topbar [data-nav], .view:not([hidden]) [data-nav]')];
}
const isShown = (el) => el.isConnected && el.getClientRects().length > 0 && !el.closest('[hidden]');

function focus(el, { scroll = true } = {}) {
  if (!el) return;
  if (S.focused && S.focused !== el) S.focused.classList.remove('is-focused');
  S.focused = el;
  el.classList.add('is-focused');
  if (el.dataset.row) rowMemory.set(rowKey(el), el);
  if (scroll) reveal(el);
  if (el._focus) el._focus();
  updateHints();
}
const rowKey = (el) => `${layers.length}:${el.dataset.row}`;

function defaultFocus() {
  const els = scopeEls().filter(isShown);
  const top = layers[layers.length - 1];
  const pref = (top && top.initial && top.el.querySelector(top.initial)) || els.find((e) => e.dataset.default != null) || els.find((e) => e.dataset.row !== 'top') || els[0];
  if (pref) focus(pref);
}

function move(dir) {
  const els = scopeEls().filter(isShown);
  const cur = S.focused && els.includes(S.focused) ? S.focused : null;
  if (!cur) return defaultFocus();
  const r = cur.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const rects = els.filter((e) => e !== cur).map((e) => ({ e, r: e.getBoundingClientRect() }));
  let best = null;

  if (dir === 'left' || dir === 'right') {
    const sign = dir === 'right' ? 1 : -1;
    const sameRow = cur.dataset.row ? rects.filter((o) => o.e.dataset.row === cur.dataset.row) : [];
    const pool = (sameRow.length ? sameRow : rects).filter((o) => {
      const ocx = o.r.left + o.r.width / 2;
      if ((ocx - cx) * sign <= 2) return false;
      if (sameRow.length) return true;
      return o.r.bottom > r.top + 4 && o.r.top < r.bottom - 4; // vertical overlap
    });
    let bd = Infinity;
    for (const o of pool) {
      const ocx = o.r.left + o.r.width / 2, ocy = o.r.top + o.r.height / 2;
      const d = Math.abs(ocx - cx) + Math.abs(ocy - cy) * 2;
      if (d < bd) { bd = d; best = o.e; }
    }
  } else {
    const down = dir === 'down';
    let pool = rects.filter((o) => (down ? o.r.top >= r.bottom - 12 : o.r.bottom <= r.top + 12));
    // inside a scrolled list, stay in it (rows scrolled under the top bar still count) before jumping to the tabs
    const box = cur.closest('[data-scroll="y"]');
    if (box) { const same = pool.filter((o) => box.contains(o.e)); if (same.length) pool = same; }
    if (pool.length) {
      const gap = (o) => (down ? o.r.top - r.bottom : r.top - o.r.bottom);
      const nearest = pool.reduce((a, b) => (gap(b) < gap(a) ? b : a));
      const row = nearest.e.dataset.row;
      const band = pool.filter((o) => (row && cur.dataset.row !== row ? o.e.dataset.row === row : Math.abs(gap(o) - gap(nearest)) < 30));
      const mem = row ? rowMemory.get(`${layers.length}:${row}`) : null;
      if (mem && band.some((o) => o.e === mem) && row !== cur.dataset.row) best = mem;
      else {
        let bd = Infinity;
        for (const o of band) {
          const ocx = o.r.left + o.r.width / 2;
          const d = Math.abs(ocx - cx);
          if (d < bd) { bd = d; best = o.e; }
        }
      }
    }
  }
  if (best) { focus(best); sound('move'); } else sound('bump');
}

// keep the focused element inside its scroll container (rows scroll sideways, grids down)
function reveal(el, smooth = true) {
  let box = el.closest('[data-scroll]');
  while (box) {
    revealIn(box, box.dataset.scroll === 'y' ? (el.closest('.row-wrap') || el) : el, smooth);
    box = box.parentElement && box.parentElement.closest('[data-scroll]');
  }
}
function revealIn(box, el, smooth) {
  stopGlide(box);
  const s = S.scale;
  if (box.classList.contains('home-scroll') && el.closest('.hero')) {
    box.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
    return;
  }
  const er = el.getBoundingClientRect(), br = box.getBoundingClientRect();
  const pad = 64 * s;
  if (box.dataset.scroll === 'x') {
    let dx = 0;
    if (er.right > br.right - pad) dx = er.right - (br.right - pad);
    else if (er.left < br.left + pad) dx = er.left - (br.left + pad);
    if (dx) box.scrollTo({ left: box.scrollLeft + dx / s, behavior: smooth ? 'smooth' : 'auto' });
  } else {
    let dy = 0;
    const padY = 40 * s;
    const padTop = box.classList.contains('home-scroll') ? 120 * s : padY;
    if (er.bottom > br.bottom - padY) dy = er.bottom - (br.bottom - padY);
    if (er.top - dy < br.top + padTop) dy = er.top - (br.top + padTop); // the top edge wins if it doesn't all fit
    if (dy) box.scrollTo({ top: box.scrollTop + dy / s, behavior: smooth ? 'smooth' : 'auto' });
  }
}
// =====================================================================
// interface sounds, synthesised on the fly (no audio files)
// =====================================================================
const Sfx = {
  ctx: null,
  get vol() { return (S.settings.sfxVolume ?? 50) / 100; },
  // sound packs reshape every tone: same melodies, different instrument
  tone(freq, dur, { type = 'sine', gain = 0.2, to = null, at = 0 } = {}) {
    const pack = S.settings.sfxPack || 'classic';
    let attack = 0.008;
    let filter = null;
    if (pack === 'soft') { type = 'sine'; freq *= 0.75; if (to) to *= 0.75; gain *= 0.9; dur *= 1.5; attack = 0.025; }
    if (pack === '8bit') {
      const q = (f) => 440 * Math.pow(2, Math.round(12 * Math.log2(f / 440)) / 12); // snap to notes
      type = 'square'; gain *= 0.42; freq = q(freq);
      if (to) { const half = dur / 2; this.raw(freq, half, type, gain, null, at, 0.002); this.raw(q(to), half, type, gain, null, at + half, 0.002); return; }
      attack = 0.002;
    }
    if (pack === 'scifi') { type = 'sawtooth'; gain *= 0.55; to = to || freq * 1.3; dur *= 1.15; filter = [500, 4200]; }
    this.raw(freq, dur, type, gain, to, at, attack, filter);
  },
  raw(freq, dur, type, gain, to, at, attack, filter) {
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const peak = gain * this.vol * 0.5;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let src = o;
    if (filter) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass'; f.Q.value = 9;
      f.frequency.setValueAtTime(filter[0], t);
      f.frequency.exponentialRampToValueAtTime(filter[1], t + dur * 0.7);
      src = o.connect(f);
    }
    src.connect(g).connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  play(name) {
    if (!this.vol) return;
    try {
      if (!this.ctx) this.ctx = new AudioContext();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      switch (name) {
        case 'move': this.tone(1320, 0.035, { type: 'triangle', gain: 0.10 }); break;
        case 'bump': this.tone(180, 0.06, { type: 'sine', gain: 0.18 }); break;
        case 'select': this.tone(784, 0.05, { gain: 0.16 }); this.tone(1175, 0.08, { gain: 0.14, at: 0.045 }); break;
        case 'back': this.tone(700, 0.09, { type: 'triangle', gain: 0.14, to: 420 }); break;
        case 'tab': this.tone(980, 0.05, { type: 'triangle', gain: 0.12, to: 1240 }); break;
        case 'open': this.tone(420, 0.12, { gain: 0.12, to: 840 }); break;
        case 'key': this.tone(1600, 0.025, { type: 'square', gain: 0.04 }); break;
        case 'toggle': this.tone(1050, 0.05, { type: 'triangle', gain: 0.14 }); break;
        case 'boot': [392, 587, 784].forEach((f, i) => this.tone(f, 0.75, { gain: 0.09, at: 0.18 + i * 0.4 })); this.tone(1568, 1, { gain: 0.04, at: 1.5 }); break;
        case 'minimize': this.tone(880, 0.16, { type: 'triangle', gain: 0.12, to: 330 }); this.tone(1320, 0.1, { gain: 0.05, to: 660, at: 0.02 }); break;
        case 'restore': this.tone(330, 0.16, { type: 'triangle', gain: 0.12, to: 880 }); this.tone(1320, 0.12, { gain: 0.06, at: 0.13 }); break;
        case 'launch': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, { gain: 0.14, at: i * 0.07 })); break;
        case 'done': this.tone(880, 0.08, { gain: 0.14 }); this.tone(1319, 0.16, { gain: 0.12, at: 0.08 }); break;
        case 'reward': [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.3, { gain: 0.1, at: i * 0.09 })); this.tone(2093, 0.6, { gain: 0.05, at: 0.36 }); break;
        case 'error': this.tone(240, 0.16, { type: 'square', gain: 0.07 }); this.tone(190, 0.2, { type: 'square', gain: 0.07, at: 0.12 }); break;
      }
    } catch { /* audio unavailable */ }
  },
};
const sound = (n = 'move') => (n === 'none' ? null : Sfx.play(n));

// layers: game page, settings, keyboard, dialogs
function pushLayer(layer) {
  layer.restore = S.focused;
  layer.el.classList.add('layer');
  $('#layers').append(layer.el);
  layers.push(layer);
  $('#stage').classList.toggle('overlay-open', true);
  if (S.focused) S.focused.classList.remove('is-focused');
  S.focused = null;
  requestAnimationFrame(() => (layer.focusFirst ? layer.focusFirst() : defaultFocus()));
  if (layer.kind !== 'osk') sound('open');
  updateHints();
  return layer;
}
function squish(el) {
  el.classList.add('pressed');
  setTimeout(() => el.classList.remove('pressed'), 130);
}
function popLayer(layer = layers[layers.length - 1]) {
  if (!layer) return;
  const i = layers.indexOf(layer);
  if (i < 0) return;
  layers.splice(i, 1);
  const gone = layer.el;
  gone.classList.add('closing');
  setTimeout(() => gone.remove(), 190);
  if (layer.onClose) layer.onClose();
  $('#stage').classList.toggle('overlay-open', layers.length > 0);
  if (S.focused && !S.focused.isConnected) S.focused = null;
  if (i === layers.length) {
    const back = layer.restore && layer.restore.isConnected && isShown(layer.restore) ? layer.restore : null;
    if (S.focused) S.focused.classList.remove('is-focused');
    S.focused = null;
    if (!layers.length && baseDirty) { baseDirty = false; refresh(); }
    if (S.focused && S.focused.isConnected) { /* refresh restored focus */ }
    else if (back && back.isConnected) focus(back); else defaultFocus();
  }
  updateHints();
}
const topLayer = () => layers[layers.length - 1];

// =====================================================================
// input: gamepad, keyboard, mouse
// =====================================================================
function press(btn) {
  hideCursor();
  const layer = topLayer();
  const f = S.focused && S.focused.isConnected ? S.focused : null;
  if (layer && layer.handle && layer.handle(btn) === true) return;
  switch (btn) {
    case 'A': if (f && f._act) { sound(f.dataset.sfx || 'select'); squish(f); f._act(); } else if (!f) defaultFocus(); break;
    case 'B': sound('back'); if (layer) (layer.onBack ? layer.onBack() : popLayer()); else if (S.tab !== 'home') setTab('home'); break;
    case 'X': if (f && f._alt) f._alt(); else if (!layer && isLibTab()) cycleSort(); break;
    case 'Y': if (!layer) { if (S.tab === 'trophies') { toast('Обновляю достижения…'); openTrophies(true); } else if (S.tab === 'friends') { toast('Обновляю друзей…'); loadFriends(true); } else openSearch(); } break;
    case 'MENU': if (!layer) openSettings(); else if (layer.kind === 'settings') popLayer(); break;
    case 'VIEW': if (!layer && isLibTab()) cycleFilter(); break;
    case 'LB': if (!layer) cycleTab(-1); break;
    case 'RB': if (!layer) cycleTab(1); break;
    case 'up': case 'down': case 'left': case 'right': move(btn); break;
  }
}

// --- gamepad ---
const PAD_BUTTONS = { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 8: 'VIEW', 9: 'MENU' };
const prev = {};
const rep = { dir: null, next: 0 };
let padConnected = false;
function pollPads(t) {
  const pads = (navigator.getGamepads ? [...navigator.getGamepads()] : []).filter((p) => p && p.connected);
  if (!!pads.length !== padConnected) {
    padConnected = !!pads.length;
    $('#pad-state').classList.toggle('on', padConnected);
    if (padConnected) { toast('Геймпад подключён'); setInput('pad'); api.padBattery().then((b) => { lastBattery = b; renderBattery(b); }); } else setInput('kb');
    renderBattery(lastBattery);
  }
  const active = document.hasFocus() && !document.hidden;
  for (const pad of pads) {
    const id = pad.index;
    const b = (i) => !!(pad.buttons[i] && pad.buttons[i].pressed);
    for (const [i, name] of Object.entries(PAD_BUTTONS)) {
      const k = `${id}:${i}`;
      const now = b(+i);
      if (now && !prev[k] && active) { setInput('pad'); press(name); }
      prev[k] = now;
    }
    const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
    let dir = null;
    if (b(12) || ay < -0.55) dir = 'up';
    else if (b(13) || ay > 0.55) dir = 'down';
    else if (b(14) || ax < -0.55) dir = 'left';
    else if (b(15) || ax > 0.55) dir = 'right';
    if (pads.indexOf(pad) === 0 || dir) {
      if (!dir) rep.dir = null;
      else if (dir !== rep.dir) { rep.dir = dir; rep.next = t + 380; if (active) { setInput('pad'); press(dir); } }
      else if (t >= rep.next) { rep.next = t + 95; if (active) press(dir); }
    }
  }
  requestAnimationFrame(pollPads);
}
addEventListener('gamepadconnected', () => {});

// --- keyboard ---
const KEYMAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  Enter: 'A', ' ': 'A', Escape: 'B', Backspace: 'B',
  x: 'X', ч: 'X', y: 'Y', н: 'Y', '/': 'Y', q: 'LB', й: 'LB', e: 'RB', у: 'RB', m: 'MENU', ь: 'MENU', F1: 'MENU', v: 'VIEW', м: 'VIEW',
};
addEventListener('keydown', (e) => {
  if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) setInput('kb');
  if (e.key === 'F11') { e.preventDefault(); api.toggleFullscreen(); return; }
  if (e.ctrlKey && ['=', '+', '-', '_', '0'].includes(e.key)) {
    e.preventDefault();
    const cur = UI_SCALES.indexOf(S.settings.uiScale || 100);
    const next = e.key === '0' ? 100 : UI_SCALES[Math.max(0, Math.min(UI_SCALES.length - 1, cur + (e.key === '-' || e.key === '_' ? -1 : 1)))];
    if (next !== (S.settings.uiScale || 100)) setScale(next);
    return;
  }
  const inInput = document.activeElement && document.activeElement.tagName === 'INPUT';
  if (inInput) {
    if (e.key === 'Escape') { e.preventDefault(); press('B'); }
    else if (e.key === 'Enter') { e.preventDefault(); topLayer()?.submit?.(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); press(KEYMAP[e.key]); }
    return;
  }
  const k = KEYMAP[e.key] || KEYMAP[e.key.toLowerCase()];
  if (k) { e.preventDefault(); if (!e.repeat || /up|down|left|right/.test(k)) press(k); }
});

// --- mouse ---
let cursorTimer = 0;
function hideCursor() { document.body.classList.add('no-cursor'); }
let lastMouse = null;
addEventListener('mousemove', (e) => {
  // ignore the tiny jitter Windows sends when nothing really moved
  if (lastMouse && Math.abs(e.screenX - lastMouse[0]) + Math.abs(e.screenY - lastMouse[1]) < 6) return;
  const first = !lastMouse;
  lastMouse = [e.screenX, e.screenY];
  if (first) return;
  setInput('kb');
  document.body.classList.remove('no-cursor');
  clearTimeout(cursorTimer);
  cursorTimer = setTimeout(hideCursor, 3000);
});
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-nav]');
  if (!el || !scopeEls().includes(el)) {
    if (topLayer() && e.target.classList.contains('scrim')) press('B');
    return;
  }
  focus(el, { scroll: false });
  if (el._act) { sound(el.dataset.sfx || 'select'); squish(el); el._act(); }
});
// buttons never take DOM focus, so Enter/Space only go through our own handler
document.addEventListener('mousedown', (e) => {
  if (e.target.closest('button')) e.preventDefault();
});
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const el = e.target.closest('[data-nav]');
  if (el && scopeEls().includes(el)) { focus(el, { scroll: false }); if (el._alt) el._alt(); }
});
// hover moves the selection, but not while the wheel is gliding: content slides under a still cursor,
// and re-focusing every tile it passes (with the hero art swapping) is what made scrolling stutter
let wheelAt = 0;
function hoverFocus(target) {
  if (document.body.classList.contains('no-cursor') || performance.now() - wheelAt < 220) return;
  const el = target && target.closest && target.closest('[data-nav]');
  if (el && el !== S.focused && scopeEls().includes(el)) focus(el, { scroll: false });
}
document.addEventListener('mouseover', (e) => hoverFocus(e.target));
document.addEventListener('mousemove', (e) => { if (performance.now() - wheelAt < 400) hoverFocus(e.target); });
// Mouse wheel: one continuous eased glide per container instead of a restarted CSS animation per notch.
// A vertical wheel over a sideways row scrolls the page; sideways wheels / Shift scroll the row.
const glides = new Map();
function stopGlide(box) {
  const g = glides.get(box);
  if (!g) return;
  cancelAnimationFrame(g.raf);
  glides.delete(box);
  box.style.scrollBehavior = '';
}
function glide(box, axis, delta) {
  const prop = axis === 'x' ? 'scrollLeft' : 'scrollTop';
  const max = axis === 'x' ? box.scrollWidth - box.clientWidth : box.scrollHeight - box.clientHeight;
  if (max <= 0) return false;
  let g = glides.get(box);
  if (!g || g.axis !== axis) {
    stopGlide(box);
    g = { axis, pos: box[prop], target: box[prop], raf: 0 };
    glides.set(box, g);
  }
  const before = g.target;
  g.target = Math.max(0, Math.min(max, g.target + delta));
  if (g.target === before && !g.raf) { glides.delete(box); return false; }
  box.style.scrollBehavior = 'auto';
  if (!g.raf) {
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(48, now - last); last = now;
      const k = 1 - Math.pow(0.78, dt / 16.7); // frame-rate independent easing
      g.pos += (g.target - g.pos) * k;
      if (Math.abs(g.target - g.pos) < 0.5) g.pos = g.target;
      box[prop] = g.pos;
      if (g.pos === g.target) { g.raf = 0; glides.delete(box); box.style.scrollBehavior = ''; return; }
      g.raf = requestAnimationFrame(step);
    };
    g.raf = requestAnimationFrame(step);
  }
  return true;
}
document.addEventListener('wheel', (e) => {
  if (e.ctrlKey) return;
  wheelAt = performance.now();
  const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1;
  const dx = e.deltaX * unit, dy = e.deltaY * unit;
  const sideways = e.shiftKey || Math.abs(dx) > Math.abs(dy);
  const s = S.scale || 1;
  const yBox = e.target.closest('[data-scroll="y"]');
  const xBox = e.target.closest('[data-scroll="x"]');
  if (sideways && xBox) { glide(xBox, 'x', (e.shiftKey ? dy || dx : dx) / s); return; }
  if (!sideways && yBox && glide(yBox, 'y', dy / s)) return;
  if (xBox) glide(xBox, 'x', (dy || dx) / s); // a row on a page that doesn't scroll vertically
}, { passive: true });

// =====================================================================
// hints bar
// =====================================================================
function updateHints() {
  const bar = $('#hints');
  const layer = topLayer();
  let list;
  if (layer && layer.hints) list = typeof layer.hints === 'function' ? layer.hints() : layer.hints;
  else {
    const onGame = S.focused && S.focused._alt;
    const lib = isLibTab();
    list = [['A', 'Выбрать'], onGame && S.tab !== 'trophies' && S.tab !== 'friends' && ['X', 'Действия'], !onGame && lib && ['X', 'Сортировка'],
      lib && ['VIEW', 'Фильтр'], ['Y', S.tab === 'trophies' || S.tab === 'friends' ? 'Обновить' : 'Поиск'], ['MENU', 'Настройки']];
  }
  bar.replaceChildren(
    h('span', { class: 'left', text: layer ? '' : S.input === 'kb' ? 'Q / E — разделы  ·  F11 — полный экран  ·  ПКМ — действия' : 'LB / RB — разделы  ·  F11 — полный экран' }),
    ...list.filter(Boolean).map(([b, t]) => h('span', { class: 'h' }, glyph(b), t)),
  );
}
// button prompts follow whatever was used last: Xbox glyphs for the pad, keycaps for keyboard and mouse
const KEYCAP = { A: 'Enter', B: 'Esc', X: 'X', Y: 'Y', MENU: 'M', VIEW: 'V', LB: 'Q', RB: 'E' };
function glyph(b) {
  if (S.input === 'kb') return h('span', { class: 'gb key', 'data-glyph': b, text: KEYCAP[b] || b });
  if (b === 'MENU') return h('span', { class: 'gb sys', 'data-glyph': b, text: '≡' });
  if (b === 'VIEW') return h('span', { class: 'gb sys', 'data-glyph': b, text: '⧉' });
  if (b === 'LB' || b === 'RB') return h('span', { class: 'gb sys', 'data-glyph': b, text: b });
  return h('span', { class: `gb ${b}`, 'data-glyph': b, text: b });
}
function setInput(mode) {
  if (S.input === mode) return;
  S.input = mode;
  document.body.dataset.input = mode;
  document.querySelectorAll('[data-glyph]').forEach((el) => {
    const n = glyph(el.dataset.glyph);
    n.classList.add('swap-in');
    el.replaceWith(n);
  });
  document.querySelectorAll('[data-bump]').forEach((el) => { el.textContent = mode === 'kb' ? KEYCAP[el.dataset.bump] : el.dataset.bump; });
  updateHints();
}

// =====================================================================
// toasts
// =====================================================================
function toast(msg, kind = '') {
  if (kind === 'warn') sound('error');
  const t = h('div', { class: `toast ${kind}`, text: msg });
  $('#toasts').append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, kind === 'warn' ? 6500 : 3200);
}

// =====================================================================
// top bar
// =====================================================================
function renderTabs() {
  const nav = $('#tabs');
  nav.replaceChildren(
    h('span', { class: 'tab-bumper', 'data-bump': 'LB', text: S.input === 'kb' ? 'Q' : 'LB' }),
    ...TABS.map((t) => h('button', { class: `tab${S.tab === t.id ? ' active' : ''}`, nav: 'top', text: t.label, act: () => setTab(t.id) })),
    h('span', { class: 'tab-bumper', 'data-bump': 'RB', text: S.input === 'kb' ? 'E' : 'RB' }),
  );
}
function renderProfile() {
  const p = S.profile;
  const name = (p && p.personaName) || 'Игрок';
  $('#profile-name').textContent = name;
  renderLevel();
}
function renderPill() {
  const pill = $('#playing-pill');
  const s = S.session;
  const g = s && byId(s.gameId);
  if (!g) { pill.hidden = true; return; }
  pill.hidden = false;
  pill.textContent = s.state === 'running' ? `▶ ${g.name} · ${fmtClock(Date.now() - s.since)}` : `Запуск: ${g.name}…`;
}
function tickClock() {
  $('#clock').textContent = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  renderPill();
}

// =====================================================================
// tiles
// =====================================================================
// =====================================================================
// downloads (Steam does the work, progress is read from its manifests)
// =====================================================================
const DL_LABEL = {
  confirm: 'Подтверди в окне Steam', epicConfirm: 'Подтверди в окне Epic', epic: 'Установка в Epic', queued: 'В очереди', downloading: 'Загрузка', updating: 'Обновление',
  installing: 'Установка', validating: 'Проверка файлов', paused: 'Пауза', uninstalling: 'Удаление',
};
function fmtBytes(b) {
  if (!b) return '0 Б';
  const u = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  const i = Math.min(u.length - 1, Math.floor(Math.log(b) / Math.log(1024)));
  const v = b / 1024 ** i;
  return `${v.toLocaleString('ru-RU', { maximumFractionDigits: v < 10 && i > 1 ? 1 : 0 })} ${u[i]}`;
}
const dlFor = (g) => (g ? S.downloads.find((d) => d.gid === g.id) : null);
const WAITING = ['confirm', 'epicConfirm', 'epic', 'uninstalling'];
function dlText(d) {
  const base = DL_LABEL[d.state] || 'Загрузка';
  if (!d.total || WAITING.includes(d.state)) return base;
  return `${base} · ${Math.floor(d.pct * 100)}%`;
}
function dlBar(d, variant) {
  const fill = h('div', { class: 'dl-fill', style: `width:${(d.pct * 100).toFixed(1)}%` });
  const el = h('div', { class: `dl ${variant} st-${d.state}`, 'data-dl': d.gid },
    h('div', { class: 'dl-track' }, fill),
    h('div', { class: 'dl-text', text: variant === 'big' ? '' : dlText(d) }));
  if (variant === 'big') fillBig(el, d);
  return el;
}
function fillBig(el, d) {
  const t = el.querySelector('.dl-text');
  t.textContent = '';
  t.append(h('b', { text: DL_LABEL[d.state] || 'Загрузка' }),
    d.total && !WAITING.includes(d.state) ? h('span', { text: `${fmtBytes(d.done)} из ${fmtBytes(d.total)} · ${Math.floor(d.pct * 100)}%` })
      : h('span', { text: { confirm: 'Выбери диск и нажми «Установить» в окне Steam', epicConfirm: 'Выбери папку и нажми «Установить» в окне Epic', epic: 'Процент загрузки виден в самом Epic' }[d.state] || '' }));
}
function updateProgressUI() {
  document.querySelectorAll('[data-dl]').forEach((el) => {
    const d = S.downloads.find((x) => x.gid === el.dataset.dl);
    if (!d) return;
    el.className = el.className.replace(/st-\w+/, `st-${d.state}`);
    el.querySelector('.dl-fill').style.width = `${(d.pct * 100).toFixed(1)}%`;
    if (el.classList.contains('big')) fillBig(el, d); else el.querySelector('.dl-text').textContent = dlText(d);
  });
  document.querySelectorAll('[data-dltext]').forEach((el) => {
    const d = S.downloads.find((x) => x.gid === el.dataset.dltext);
    if (d) el.textContent = dlText(d);
  });
  const pill = $('#dl-pill');
  if (!S.downloads.length) { pill.hidden = true; return; }
  pill.hidden = false;
  const active = S.downloads.find((d) => ['downloading', 'updating', 'installing'].includes(d.state)) || S.downloads[0];
  pill.textContent = `⬇ ${S.downloads.length > 1 ? `${S.downloads.length} · ` : ''}${active.total ? `${Math.floor(active.pct * 100)}%` : DL_LABEL[active.state]}`;
}

function gameTile(g, kind, row, extra = {}) {
  const urls = kind === 'cover' ? g.art.cover : kind === 'square' ? g.art.square : g.art.wide;
  const kids = [placeholder(g), kind === 'cover' ? coverImg(g) : artImg(urls)];
  const dl0 = dlFor(g);
  if (kind !== 'cover') {
    const sub = dl0 ? h('span', { class: 's', 'data-dltext': dl0.gid, text: dlText(dl0) }) : extra.sub ? h('span', { class: 's', text: extra.sub }) : null;
    kids.push(h('div', { class: 'tile-bar' }, h('span', { class: 't', text: g.name }), sub));
  } else if (!g.installed && row !== 'rest' && !dlFor(g)) kids.push(h('span', { class: 'badge', text: 'Не установлена' }));
  const d = dlFor(g);
  if (d) kids.push(dlBar(d, kind === 'cover' ? 'cover-dl' : 'onwide'));
  return h('button', {
    class: `tile ${kind}`, nav: row || true, 'aria-label': g.name,
    act: () => openGame(g.id),
    alt: () => gameMenu(g.id),
    onfocus: extra.onfocus,
  }, ...kids);
}

// =====================================================================
// home
// =====================================================================
function recentGames() {
  return visibleGames().filter((g) => g.lastPlayed).sort((a, b) => b.lastPlayed - a.lastPlayed);
}
function shelfGames() {
  return visibleGames().filter((g) => g.installed).sort((a, b) => (b.minutes - a.minutes) || a.name.localeCompare(b.name, 'ru'));
}

function renderHome() {
  const view = $('#view-home');
  const recent = recentGames();
  const shelf = shelfGames();
  const all = visibleGames();
  const rowRecent = recent.length ? recent.slice(0, 7) : shelf.slice(0, 7);
  if (!S.heroGame || !byId(S.heroGame) || byId(S.heroGame).hidden) S.heroGame = (rowRecent[0] || shelf[0] || all[0] || {}).id || null;

  const hero = h('section', { class: 'hero', id: 'hero' });
  const stats = renderStats(all, shelf);

  const recentRow = h('div', { class: 'row', 'data-scroll': 'x' });
  rowRecent.forEach((g, i) => {
    recentRow.append(gameTile(g, i === 0 ? 'wide' : 'square', 'recent', {
      sub: i === 0 && recent.length ? 'Продолжить' : null,
      onfocus: () => setHero(g.id),
    }));
  });
  if (all.length) {
    recentRow.append(h('button', { class: 'tile more', nav: 'recent', act: () => setTab('library') },
      I.grid(), h('b', { text: 'Вся коллекция' }), h('span', { text: gamesWord(all.length) })));
  } else {
    recentRow.append(h('button', { class: 'tile more', nav: 'recent', act: addGame }, I.plus(), h('b', { text: 'Добавить игру' }), h('span', { text: '.exe или ярлык' })));
  }

  const coverRow = (list, row, more) => {
    const r = h('div', { class: 'row', 'data-scroll': 'x' });
    for (const g of list.slice(0, 40)) r.append(gameTile(g, 'cover', row, { onfocus: () => setHero(g.id) }));
    if (list.length > 40 || more) r.append(h('button', { class: 'tile cover more', nav: row, act: () => setTab('library') }, I.grid(), h('b', { text: 'Все' })));
    return r;
  };
  const block = (title, sub, row) => h('div', { class: 'row-wrap' },
    h('div', { class: 'row-title' }, h('h2', { text: title }), sub ? h('span', { text: sub }) : null), row);
  const rest = all.filter((g) => !g.installed).sort((a, b) => (b.minutes - a.minutes) || a.name.localeCompare(b.name, 'ru'));

  // keep vertical position when the home screen is rebuilt in place
  const prevScroll = view.querySelector('.home-scroll')?.scrollTop || 0;
  const scroller = h('div', { class: 'home-scroll', 'data-scroll': 'y' },
    h('div', { class: 'home-inner' },
      hero, stats,
      downloadsBlock(block),
      broBlock(block),
      friendsBlock(block),
      block(recent.length ? 'Недавние' : 'Установленные', null, recentRow),
      shelf.length ? block('Библиотека', 'Установленные · по времени игры', coverRow(shelf, 'shelf')) : null,
      rest.length ? block('Не установлены', `${gamesWord(rest.length)} · по времени игры`, coverRow(rest, 'rest', true)) : null));
  scroller.addEventListener('scroll', () => $('#topbar').classList.toggle('solid', scroller.scrollTop > 40));
  view.replaceChildren(scroller);
  scroller.scrollTop = prevScroll;
  $('#topbar').classList.toggle('solid', prevScroll > 40);
  renderHero();
}

function downloadsBlock(block) {
  const items = S.downloads.map((d) => byId(d.gid)).filter(Boolean);
  if (!items.length) return null;
  const r = h('div', { class: 'row', 'data-scroll': 'x' });
  for (const g of items) r.append(gameTile(g, 'wide', 'dl', { onfocus: () => setHero(g.id) }));
  return block('Загрузки', 'Магазин качает в фоне · прогресс обновляется сам', r);
}
function renderStats(all, shelf) {
  const total = all.reduce((s, g) => s + (g.minutes || 0), 0);
  const top = [...all].sort((a, b) => b.minutes - a.minutes)[0];
  return h('aside', { class: 'stats' },
    h('span', { class: 'panel-label', text: 'Статистика' }),
    h('div', { class: 'stat' }, h('span', { text: 'Игр в библиотеке' }), h('b', { text: String(all.length) })),
    h('div', { class: 'stat' }, h('span', { text: 'Установлено' }), h('b', { text: String(shelf.length) })),
    h('div', { class: 'stat' }, h('span', { text: 'Всего сыграно' }), h('b', { text: total ? fmtTime(total) : '—' })),
    top && top.minutes ? h('div', { class: 'stat-top' }, 'Больше всего: ', h('em', { text: top.name }), ` · ${fmtTime(top.minutes)}`) : null,
  );
}

// main action: play / install / show download progress
// main action: play / install / show download progress
function playState(g) {
  const d = dlFor(g);
  const playing = S.session && S.session.gameId === g.id;
  if (d && !(g.installed && d.state === 'updating')) {
    const waiting = d.state === 'confirm' || d.state === 'epicConfirm';
    return { key: `dl:${d.state}`, busy: true, icon: I.download, label: waiting ? 'Ждёт подтверждения' : DL_LABEL[d.state], act: () => (g.source === 'steam' ? api.steamDownloads() : null) };
  }
  if (!g.installed) return { key: 'install', busy: false, icon: I.download, label: 'Установить', act: () => installGame(g.id) };
  return { key: playing ? 'playing' : 'play', busy: false, icon: I.play, label: playing ? 'Запущена' : 'Играть', act: () => launch(g.id) };
}
function playButton(g, row) {
  const st = playState(g);
  const btn = h('button', { class: `btn primary${st.busy ? ' busy-btn' : ''}`, nav: row, key: 'play', 'data-default': row === 'hero' ? '' : null, act: st.act },
    h('span', { class: 'pb-in' }, st.icon(), st.label));
  btn.dataset.state = st.key;
  return btn;
}
// change the play/install button in place: content cross-fades, width glides to the new size
function morphPlay(btn, g) {
  const st = playState(g);
  btn._act = st.act;
  if (btn.dataset.state === st.key) return;
  btn.dataset.state = st.key;
  const from = btn.offsetWidth;
  btn.classList.toggle('busy-btn', st.busy);
  const inner = h('span', { class: 'pb-in swap' }, st.icon(), st.label);
  btn.replaceChildren(inner);
  btn.style.width = '';
  const to = btn.offsetWidth;
  btn.style.width = `${from}px`;
  void btn.offsetWidth;
  btn.style.width = `${to}px`;
  clearTimeout(btn._wt);
  btn._wt = setTimeout(() => { btn.style.width = ''; }, 320);
}
function setHero(id) {
  if (S.heroGame === id) return;
  S.heroGame = id;
  renderHero();
}
function heroMeta(g) {
  return [SOURCE[g.source] || 'Игра', g.minutes ? `сыграно ${fmtTime(g.minutes)}` : 'ещё не запускалась', g.lastPlayed ? `последний раз ${fmtAgo(g.lastPlayed)}` : null,
    g.ach ? `достижения ${g.ach.u} из ${g.ach.t}` : null].filter(Boolean).join(' · ');
}
function heroEyebrow(g) {
  const playing = S.session && S.session.gameId === g.id;
  return playing ? 'Сейчас запущена' : recentGames()[0]?.id === g.id ? 'Продолжить игру' : g.installed ? 'Готова к игре' : 'Не установлена';
}
function renderHero() {
  const hero = $('#hero');
  if (!hero) return;
  const g = byId(S.heroGame);
  if (!g) {
    setHeroArt(null);
    hero.dataset.mode = 'welcome';
    hero.dataset.gid = '';
    hero.replaceChildren(
      h('span', { class: 'eyebrow', text: 'Добро пожаловать в Lobby' }),
      titleBox('Твоя библиотека', { max: 76, min: 52, wrapAt: 40 }),
      h('p', { class: 'hero-meta', text: S.syncing ? 'Ищу игры Steam на этом ПК…' : 'Подтяни игры из Steam или добавь свои.' }),
      h('div', { class: 'hero-actions' },
        h('button', { class: 'btn primary', nav: 'hero', key: 'sync', 'data-default': '', act: doSync }, 'Синхронизировать'),
        h('button', { class: 'btn', nav: 'hero', key: 'add', act: addGame }, 'Добавить игру'),
        h('button', { class: 'btn', nav: 'hero', key: 'settings', act: openSettings }, 'Настройки')),
    );
    return;
  }
  // the hero is built once; switching games only swaps its text and morphs the main button
  if (hero.dataset.mode !== 'game') {
    const keepFocus = S.focused && hero.contains(S.focused);
    hero.dataset.mode = 'game';
    hero.dataset.gid = '';
    hero.replaceChildren(
      h('span', { class: 'eyebrow hero-eyebrow' }),
      h('div', { class: 'hero-text' },
        titleBox('', { max: 76, min: 52, wrapAt: 40 }),
        h('p', { class: 'hero-meta' })),
      h('div', { class: 'hero-actions' },
        playButton(g, 'hero'),
        h('button', { class: 'btn', nav: 'hero', key: 'info' }, 'Подробнее'),
        h('button', { class: 'btn icon', nav: 'hero', key: 'more', 'aria-label': 'Действия' }, I.more())),
    );
    if (keepFocus) focus(hero.querySelector('[data-key="play"]'), { scroll: false });
  }
  const text = hero.querySelector('.hero-text');
  const box = text.querySelector('.fit-title');
  // the status line only animates when its wording actually changes
  const eb = hero.querySelector('.hero-eyebrow');
  const ebText = heroEyebrow(g);
  if (eb.textContent !== ebText) {
    clearTimeout(eb._t);
    if (!eb.textContent) eb.textContent = ebText;
    else {
      eb.classList.add('fading');
      eb._t = setTimeout(() => { eb.textContent = ebText; eb.classList.remove('fading'); }, 140);
    }
  }
  const apply = () => {
    box.firstChild.textContent = g.name;
    text.querySelector('.hero-meta').textContent = heroMeta(g);
    fitTitle(box);
  };
  hero.querySelector('[data-key="info"]')._act = () => openGame(g.id);
  hero.querySelector('[data-key="more"]')._act = () => gameMenu(g.id);
  morphPlay(hero.querySelector('[data-key="play"]'), g);
  clearTimeout(text._t);
  if (hero.dataset.gid === g.id) { text.classList.remove('fading'); apply(); return; }
  const first = !hero.dataset.gid;
  hero.dataset.gid = g.id;
  setHeroArt(g.art.hero);
  if (first) { apply(); return; }
  text.classList.add('fading');
  text._t = setTimeout(() => { apply(); text.classList.remove('fading'); }, 120);
}

// =====================================================================
// library views
// =====================================================================
const SORTS = { played: 'недавние', time: 'по времени', name: 'по названию' };
const FILTERS = { installed: 'Установленные', all: 'Все', hidden: 'Скрытые' };

function libraryList() {
  let list = S.games.filter((g) => (['steam', 'epic', 'custom'].includes(S.tab) ? g.source === S.tab : true));
  const f = S.libFilter;
  list = list.filter((g) => (f === 'hidden' ? g.hidden : !g.hidden && (f === 'all' || g.installed)));
  const by = {
    played: (a, b) => (b.lastPlayed - a.lastPlayed) || a.name.localeCompare(b.name, 'ru'),
    time: (a, b) => (b.minutes - a.minutes) || a.name.localeCompare(b.name, 'ru'),
    name: (a, b) => a.name.localeCompare(b.name, 'ru'),
  }[S.libSort];
  return list.sort(by);
}

function renderLibrary() {
  const view = $('#view-library');
  const list = libraryList();
  const title = { library: 'Библиотека', steam: 'Steam', epic: 'Epic Games', custom: 'Мои игры' }[S.tab];
  const grid = h('div', { class: 'grid' });
  if (S.tab === 'epic' && !S.epic.account && S.libFilter !== 'hidden') {
    grid.append(h('div', { class: 'gcell' },
      h('button', { class: 'tile cover add', nav: true, 'data-default': '', act: epicLoginFlow }, I.plus(), h('b', { text: 'Войти в Epic' })),
      h('span', { class: 'cap', text: 'Аккаунт Epic' }), h('span', { class: 'cap2', text: 'вся библиотека и время' })));
  }
  if (S.tab === 'custom' && S.libFilter !== 'hidden') {
    grid.append(h('div', { class: 'gcell' },
      h('button', { class: 'tile cover add', nav: true, 'data-default': '', act: addGame }, I.plus(), h('b', { text: 'Добавить игру' })),
      h('span', { class: 'cap', text: 'Новая игра' }), h('span', { class: 'cap2', text: '.exe, .lnk или .url' })));
  }
  for (const g of list) {
    grid.append(h('div', { class: 'gcell' },
      gameTile(g, 'cover', null),
      h('span', { class: 'cap', text: g.name }),
      h('span', { class: 'cap2' }, g.minutes ? fmtTime(g.minutes) : g.installed ? 'не запускалась' : 'не установлена',
        g.ach && g.ach.u ? h('span', { class: `cap-ach${g.ach.u === g.ach.t ? ' full' : ''}` }, I.trophy(), `${Math.floor((g.ach.u / g.ach.t) * 100)}%`) : null)));
  }
  const empty = !list.length && S.tab !== 'custom' && !(S.tab === 'epic' && !S.epic.account)
    ? h('div', { class: 'empty', text: S.libFilter === 'hidden' ? 'Скрытых игр нет.'
      : S.tab === 'epic' && !S.games.some((g) => g.source === 'epic') ? (S.epic.account ? 'В аккаунте Epic игр не нашлось.' : 'Войди в аккаунт Epic в настройках (≡ → Epic Games), чтобы увидеть всю библиотеку. Установленные игры Epic появятся и без входа.')
      : S.tab === 'steam' && !S.games.some((g) => g.source === 'steam') ? 'Игры Steam не найдены. Проверь в настройках папку Steam или добавь ключ Steam API, чтобы подтянуть всю библиотеку.'
        : S.libFilter === 'installed' ? 'Установленных игр нет. Нажми ⧉ (View), чтобы показать все.' : 'Здесь пока пусто.' })
    : null;
  view.replaceChildren(
    h('div', { class: 'lib-head' },
      h('div', {}, h('h1', { text: title }), h('div', { class: 'sub', text: `${gamesWord(list.length)} · ${FILTERS[S.libFilter].toLowerCase()} · ${SORTS[S.libSort]}` })),
      h('div', { class: 'chips' },
        h('span', { class: 'chip' }, glyph('X'), `Сортировка: ${SORTS[S.libSort]}`),
        h('span', { class: 'chip' }, glyph('VIEW'), FILTERS[S.libFilter]))),
    h('div', { class: 'lib-scroll', 'data-scroll': 'y' }, empty || grid),
  );
}

function cycleSort() {
  const k = Object.keys(SORTS);
  S.libSort = k[(k.indexOf(S.libSort) + 1) % k.length];
  renderLibrary(); defaultFocus();
}
function cycleFilter() {
  const k = Object.keys(FILTERS);
  S.libFilter = k[(k.indexOf(S.libFilter) + 1) % k.length];
  renderLibrary(); defaultFocus();
}

const isLibTab = () => !['home', 'trophies', 'friends'].includes(S.tab);
function setTab(id) {
  S.tab = id;
  renderTabs();
  $('#view-home').hidden = id !== 'home';
  $('#view-library').hidden = id === 'home' || id === 'trophies' || id === 'friends';
  $('#view-trophies').hidden = id !== 'trophies';
  $('#view-friends').hidden = id !== 'friends';
  if (S.focused) S.focused.classList.remove('is-focused');
  S.focused = null;
  if (id === 'home') { renderHome(); }
  else if (id === 'trophies') { setHeroArt(null); openTrophies(); }
  else if (id === 'friends') { setHeroArt(null); renderFriends(); if (!S.friends || Date.now() - S.friends.at > 45e3) loadFriends(); }
  else { setHeroArt(null); renderLibrary(); }
  intro(id === 'home' ? $('#view-home') : id === 'trophies' ? $('#view-trophies') : id === 'friends' ? $('#view-friends') : $('#view-library'));
  defaultFocus();
}
// staggered entrance for tiles after switching sections
let introTimer = 0;
function intro(view) {
  view.querySelectorAll('.row, .grid').forEach((r) => [...r.querySelectorAll('.tile')].forEach((t, i) => t.style.setProperty('--i', Math.min(i, 14))));
  view.classList.remove('intro', 'fade-in');
  void view.offsetWidth;
  view.classList.add('intro', 'fade-in');
  clearTimeout(introTimer);
  introTimer = setTimeout(() => view.classList.remove('intro'), 1300);
}
function cycleTab(d) {
  sound('tab');
  const i = TABS.findIndex((t) => t.id === S.tab);
  setTab(TABS[(i + d + TABS.length) % TABS.length].id);
}

// re-render whatever is on screen, keeping focus on the same game where possible
function refresh() {
  renderProfile(); renderPill();
  if (layers.length) { for (const l of layers) if (l.refresh) l.refresh(); return; }
  const key = S.focused ? (S.focused.getAttribute('aria-label') || S.focused.dataset.key) : null;
  const row = S.focused ? S.focused.dataset.row : null;
  if (S.tab === 'home') renderHome(); else if (S.tab === 'trophies') renderTrophies(); else if (S.tab === 'friends') renderFriends(); else renderLibrary();
  if (S.focused && S.focused.isConnected) return;
  S.focused = null;
  const els = scopeEls().filter(isShown);
  const same = key && els.find((e) => (e.getAttribute('aria-label') || e.dataset.key) === key && (!row || e.dataset.row === row));
  if (same) focus(same, { scroll: false }); else defaultFocus();
}

// =====================================================================
// game page
// =====================================================================
function openGame(id) {
  const root = h('div', {});
  const layer = { el: root, kind: 'game', gameId: id, initial: '[data-key="play"]' };
  layer.hints = [['A', 'Выбрать'], ['B', 'Назад']];
  layer.refresh = () => {
    const g = byId(id);
    if (!g) { popLayer(layer); return; }
    const keep = S.focused && root.contains(S.focused) ? S.focused.dataset.key : null;
    const bg = h('div', { class: 'gp-bg' });
    firstOk(g.art.hero).then((u) => { if (u) { bg.style.backgroundImage = `url("${u.replace(/"/g, '%22')}")`; bg.classList.add('on'); } });
    const cover = h('div', { class: 'gp-cover' }, placeholder(g), artImg(g.art.cover));
    const B = (key, label, act, cls = '') => h('button', { class: `btn ${cls}`, nav: 'gp', key, act }, label);
    const playing = S.session && S.session.gameId === g.id;
    const acts = [
      playButton(g, 'gp'),
      B('cover', 'Сменить обложку', () => api.pickArt(g.id, 'cover').then(afterEdit)),
      B('hero', 'Сменить фон', () => api.pickArt(g.id, 'hero').then(afterEdit)),
      B('sgcover', 'Обложки SteamGridDB', () => openGridPicker(g.id, 'cover')),
      B('sghero', 'Фоны SteamGridDB', () => openGridPicker(g.id, 'hero')),
      g.hasCustomCover ? B('rcover', 'Сбросить обложку', () => api.resetArt(g.id, 'cover').then(afterEdit)) : null,
      g.hasCustomHero ? B('rhero', 'Сбросить фон', () => api.resetArt(g.id, 'hero').then(afterEdit)) : null,
      B('rename', 'Переименовать', async () => {
        const v = await osk({ title: 'Название игры', value: g.name });
        if (v != null) afterEdit(await api.updateGame(g.id, { customName: v.trim() && v.trim() !== g.originalName ? v.trim() : '' }));
      }),
      B('hide', g.hidden ? 'Вернуть в библиотеку' : 'Скрыть', async () => {
        afterEdit(await api.updateGame(g.id, { hidden: !g.hidden }));
        toast(g.hidden ? 'Игра снова в библиотеке' : 'Игра скрыта. Найти её можно в фильтре «Скрытые».');
      }),
      g.source === 'custom' ? B('track', 'Процесс для учёта', async () => {
        const v = await osk({ title: 'Имя процесса игры (например, game.exe). Нужно, если игра запускается через свой лаунчер.', value: g.trackExe });
        if (v != null) afterEdit(await api.updateGame(g.id, { trackExe: v.trim() }));
      }) : null,
      g.source === 'custom' ? B('args', 'Параметры запуска', async () => {
        const v = await osk({ title: 'Параметры запуска', value: g.args });
        if (v != null) afterEdit(await api.updateGame(g.id, { args: v.trim() }));
      }) : null,
      g.installed && !dlFor(g) ? B('uninstall', 'Удалить с диска', () => uninstallFlow(g), 'danger') : null,
      g.source === 'steam' ? B('store', 'Страница в Steam', () => api.openUrl(`https://store.steampowered.com/app/${g.appid}/`)) : null,
      g.source === 'custom' ? B('remove', 'Удалить из Lobby', () => confirmBox('Удалить игру из Lobby?', 'Сама игра и её файлы останутся на диске, удалится только плитка и учёт времени.', 'Удалить', async () => { afterEdit(await api.removeGame(g.id)); popLayer(layer); }), 'danger') : null,
    ];
    const again = !!root.firstChild;
    root.replaceChildren(h('div', { class: `gp${again ? ' noanim' : ''}` }, bg,
      h('div', { class: 'gp-body' },
        h('div', { class: 'gp-main' },
          h('span', { class: 'eyebrow', text: SOURCE[g.source] || 'Игра' }),
          titleBox(g.name, { max: 72, min: 52, wrapAt: 58 }),
          h('div', { class: 'gp-facts' },
            h('div', { class: 'fact' }, h('b', { text: g.minutes ? fmtTime(g.minutes) : '—' }), h('span', { text: 'Сыграно' })),
            h('div', { class: 'fact' }, h('b', { text: g.lastPlayed ? fmtAgo(g.lastPlayed) : '—' }), h('span', { text: 'Последний запуск' })),
            h('div', { class: 'fact' }, h('b', { text: playing ? 'Запущена' : dlFor(g) ? DL_LABEL[dlFor(g).state] : g.installed ? 'Установлена' : 'Нет' }), h('span', { text: 'Статус' })),
            g.size ? h('div', { class: 'fact' }, h('b', { text: fmtBytes(g.size) }), h('span', { text: 'На диске' })) : null),
          dlFor(g) ? dlBar(dlFor(g), 'big') : null,
          g.source === 'steam' ? achBlock(g, layer) : null,
          h('div', { class: 'gp-actions' }, ...acts),
          g.exe ? h('div', { class: 'gp-path', text: g.exe + (g.trackExe ? `  ·  учёт по процессу ${g.trackExe}` : '') }) : null),
        cover)));
    if (keep) { const el = root.querySelector(`[data-key="${keep}"]`); if (el) focus(el, { scroll: false }); else defaultFocus(); }
  };
  layer.refresh();
  pushLayer(layer);
}

function afterEdit(lib) { applyLibrary(lib); refreshAll(); }
function refreshAll() {
  renderProfile(); renderPill();
  for (const l of layers) if (l.refresh) l.refresh();
  // base views are rebuilt quietly when no layer is open, otherwise on next close
  if (!layers.length) refresh(); else baseDirty = true;
}
let baseDirty = false;

function gameMenu(id) {
  const g = byId(id);
  if (!g) return;
  menuBox(g.name, null, [
    [g.installed ? 'Играть' : 'Установить', () => (g.installed ? launch(id) : installGame(id))],
    ['Открыть страницу игры', () => openGame(id)],
    ['Сменить обложку', () => api.pickArt(id, 'cover').then(afterEdit)],
    ['Сменить фон', () => api.pickArt(id, 'hero').then(afterEdit)],
    ['Обложки SteamGridDB', () => openGridPicker(id, 'cover')],
    ['Фоны SteamGridDB', () => openGridPicker(id, 'hero')],
    [g.hidden ? 'Вернуть в библиотеку' : 'Скрыть', async () => afterEdit(await api.updateGame(id, { hidden: !g.hidden }))],
  ]);
}

// =====================================================================
// SteamGridDB picker
// =====================================================================
async function openGridPicker(gameId, kind, matchId = null) {
  const g = byId(gameId);
  if (!g) return;
  if (!S.settings.sgdbKey) return askSgdbKey(() => openGridPicker(gameId, kind, matchId));
  const label = kind === 'cover' ? 'Обложки' : 'Фоны';
  const sub = h('div', { class: 'sub', text: 'Ищу в SteamGridDB…' });
  const body = h('div', { class: 'pick-scroll', 'data-scroll': 'y' }, h('div', { class: 'pick-status', text: 'Загрузка…' }));
  const otherBtn = h('button', { class: 'btn', nav: 'pick-top', key: 'other', act: () => searchOther() }, 'Не та игра?');
  const root = h('div', { class: 'pick' },
    h('div', { class: 'pick-head' },
      h('div', {}, h('span', { class: 'eyebrow', text: `SteamGridDB · ${label}` }), h('h1', { text: g.name }), sub),
      otherBtn),
    body);
  const layer = { el: h('div', {}, root), kind: 'picker', hints: [['A', 'Применить'], ['Y', 'Другая игра'], ['B', 'Назад']] };
  layer.handle = (btn) => { if (btn === 'Y') { searchOther(); return true; } return false; };
  layer.focusFirst = () => { const t = body.querySelector('[data-nav]'); focus(t || otherBtn); };

  async function searchOther() {
    const q = await osk({ title: 'Название игры для поиска в SteamGridDB', value: g.name });
    if (!q || !q.trim()) return;
    const res = await api.sgdbSearch(q.trim());
    if (res.error) return toast(res.error, 'warn');
    if (!res.length) return toast('Ничего не найдено', 'warn');
    menuBox('Выбери игру', null, res.slice(0, 8).map((r) => [`${r.name}${r.year ? ` (${r.year})` : ''}`, () => { popLayer(layer); openGridPicker(gameId, kind, r.id); }]));
  }

  pushLayer(layer);
  const r = await api.sgdbImages(gameId, kind, matchId);
  if (!layer.el.isConnected) return;
  if (r.error) {
    sub.textContent = 'Не удалось загрузить';
    body.replaceChildren(h('div', { class: 'pick-status', text: /fetch failed|ENOTFOUND|ECONN/i.test(r.error) ? 'Нет связи с SteamGridDB. Проверь интернет.' : r.error }));
    if (r.code === 'BAD_KEY') { popLayer(layer); askSgdbKey(() => openGridPicker(gameId, kind, matchId), true); }
    return;
  }
  sub.textContent = r.match ? `Найдено: ${r.match.name} · ${r.images.length} ${plural(r.images.length, 'вариант', 'варианта', 'вариантов')}` : 'Игра не найдена в каталоге';
  if (!r.images.length) {
    body.replaceChildren(h('div', { class: 'pick-status', text: r.match ? 'Для этой игры пока нет картинок такого типа.' : 'Нажми «Не та игра?», чтобы найти её по другому названию.' }));
    focus(otherBtn);
    return;
  }
  const grid = h('div', { class: `pick-grid ${kind}` });
  r.images.forEach((im, i) => {
    const t = h('button', { class: `tile pick-${kind}`, nav: true, 'aria-label': `Вариант ${i + 1}`, style: `--i:${Math.min(i, 14)}` },
      h('div', { class: 'ph', style: 'background:#151515' }), artImg([im.thumb, im.url]),
      im.w ? h('span', { class: 'badge', text: `${im.w}×${im.h}` }) : null);
    t._act = async () => {
      t.classList.add('busy');
      const res = await api.sgdbApply(gameId, kind, im.url);
      t.classList.remove('busy');
      if (res.error) return toast(res.error, 'warn');
      artCache.clear();
      afterEdit(res);
      sound('done');
      toast(kind === 'cover' ? 'Обложка обновлена' : 'Фон обновлён');
      popLayer(layer);
    };
    grid.append(t);
  });
  body.replaceChildren(grid);
  root.classList.add('intro');
  setTimeout(() => root.classList.remove('intro'), 1300);
  if (S.focused === otherBtn || !S.focused || !S.focused.isConnected) focus(grid.firstChild);
}

function askSgdbKey(then, bad = false) {
  menuBox(bad ? 'Ключ SteamGridDB не подошёл' : 'Нужен ключ SteamGridDB',
    'Бесплатно: войди на steamgriddb.com через Steam, открой Preferences → API и скопируй ключ.',
    [
      ['Ввести ключ', async () => {
        const v = await osk({ title: 'Ключ SteamGridDB (можно Ctrl+V)', value: S.settings.sgdbKey });
        if (v != null && v.trim()) { S.settings = await api.setSettings({ sgdbKey: v.trim() }); then(); }
      }],
      ['Открыть сайт в браузере', () => api.openUrl('https://www.steamgriddb.com/profile/preferences/api')],
      ['Отмена', () => {}],
    ]);
}

// =====================================================================
// Steam achievements
// =====================================================================
S.achData = {};
const pctText = (p) => (p == null ? '' : `${p < 10 ? p.toLocaleString('ru-RU', { maximumFractionDigits: 1 }) : Math.round(p)}% игроков`);
const rarityOf = (p) => (p == null ? '' : p < 2 ? 'ultra' : p < 10 ? 'rare' : '');
const RARITY = { ultra: 'Ультраредкое', rare: 'Редкое' };
function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
}
function achIcon(a, size = 64) {
  const img = h('img', { class: `ach-ic${a.unlocked ? '' : ' off'}`, alt: '', src: a.icon || '', style: `width:${size}px;height:${size}px` });
  img.onerror = () => img.replaceWith(h('span', { class: 'ach-ic ach-ph', style: `width:${size}px;height:${size}px` }, I.trophy(size * 0.45)));
  return img;
}
async function loadAch(id, force) {
  const c = S.achData[id];
  if (!force && c && Date.now() - c.at < 10 * 60e3) return c;
  const r = await api.achGame(id, force);
  const entry = r.error ? { error: r.error, code: r.code, at: Date.now() } : { data: r.data, at: Date.now() };
  S.achData[id] = entry;
  if (r.game) { const i = S.games.findIndex((x) => x.id === id); if (i >= 0) S.games[i] = r.game; }
  return entry;
}
function achBar(u, t) {
  return h('div', { class: 'ach-bar' }, h('div', { style: `width:${t ? (u / t) * 100 : 0}%` }));
}
// the block on a game's page: progress plus the latest unlocked icons
function achBlock(g) {
  const box = h('div', { class: 'ach-block loading' }, h('span', { class: 'ach-wait', text: 'Загружаю достижения…' }));
  const fill = (c) => {
    if (!box.isConnected && box._filled) return;
    box._filled = true;
    box.classList.remove('loading');
    if (c.error) {
      box.replaceChildren(h('span', { class: 'ach-wait', text: c.code === 'NOKEY' ? 'Добавь ключ Steam API в настройках, чтобы видеть достижения' : c.error }));
      return;
    }
    const d = c.data;
    if (!d.total) { box.remove(); return; }
    const recent = d.items.filter((i) => i.unlocked).sort((a, b) => b.time - a.time).slice(0, 6);
    const keep = S.focused && box.contains(S.focused);
    const btn = h('button', { class: 'ach-sum', nav: 'gpa', key: 'ach', act: () => openAchievements(g.id) },
      h('span', { class: 'ach-sum-l' },
        h('span', { class: 'ach-sum-t' }, I.trophy(20), h('b', { text: 'Достижения' }), h('span', { text: `${d.unlocked} из ${d.total}` })),
        achBar(d.unlocked, d.total)),
      h('span', { class: 'ach-sum-r' }, ...recent.map((a) => achIcon(a, 44)),
        recent.length ? null : h('span', { class: 'ach-wait', text: 'Пока ни одного' })));
    box.replaceChildren(btn);
    if (keep) focus(btn, { scroll: false });
  };
  const c = S.achData[g.id];
  if (c && Date.now() - c.at < 10 * 60e3) fill(c);
  else loadAch(g.id).then(fill);
  return box;
}

const ACH_FILTERS = { all: 'Все', got: 'Полученные', left: 'Не полученные' };
async function openAchievements(gameId) {
  const g = byId(gameId);
  if (!g) return;
  let filter = 'all';
  const root = h('div', { class: 'achp' });
  const layer = { el: root, kind: 'ach', hints: () => [['X', `Фильтр: ${ACH_FILTERS[filter].toLowerCase()}`], ['Y', 'Обновить'], ['B', 'Назад']] };
  const render = (c) => {
    if (c.error) {
      root.replaceChildren(h('div', { class: 'achp-head' }, h('div', {}, h('span', { class: 'eyebrow', text: 'Достижения' }), h('h1', { text: g.name }))),
        h('div', { class: 'achp-scroll' }, h('div', { class: 'pick-status', text: c.code === 'NOKEY' ? 'Добавь ключ Steam Web API в настройках (≡ → Steam), чтобы видеть достижения.' : c.error })));
      return;
    }
    const d = c.data;
    const items = d.items.filter((i) => (filter === 'got' ? i.unlocked : filter === 'left' ? !i.unlocked : true))
      .sort((a, b) => (b.unlocked - a.unlocked) || (a.unlocked ? b.time - a.time : (b.pct ?? -1) - (a.pct ?? -1)));
    const list = h('div', { class: 'ach-list' }, ...items.map((a, k) => {
      const r = rarityOf(a.pct);
      return h('button', { class: `ach-row${a.unlocked ? ' got' : ''}${r ? ` ${r}` : ''}`, nav: `ar${Math.floor(k / 2)}`, style: `--i:${Math.min(k, 14)}` },
        achIcon(a, 64),
        h('span', { class: 'ach-txt' },
          h('b', { text: a.hidden ? 'Скрытое достижение' : a.name }),
          h('span', { text: a.hidden ? 'Подробности откроются после получения' : a.desc || '' })),
        h('span', { class: 'ach-meta' },
          r ? h('span', { class: `ach-rar ${r}`, text: RARITY[r] }) : null,
          h('span', { text: pctText(a.pct) }),
          a.unlocked && a.time ? h('span', { class: 'ach-date', text: fmtDate(a.time) }) : null));
    }));
    const keep = S.focused && root.contains(S.focused) ? [...root.querySelectorAll('.ach-row')].indexOf(S.focused) : -1;
    root.replaceChildren(
      h('div', { class: 'achp-head' },
        h('div', {},
          h('span', { class: 'eyebrow', text: 'Достижения' }),
          h('h1', { text: g.name }),
          h('div', { class: 'achp-prog' }, h('b', { text: `${d.unlocked} из ${d.total}` }), achBar(d.unlocked, d.total), h('span', { text: `${Math.floor((d.unlocked / d.total) * 100)}%` }))),
        h('span', { class: 'chip' }, glyph('X'), ACH_FILTERS[filter])),
      h('div', { class: 'achp-scroll', 'data-scroll': 'y' }, items.length ? list : h('div', { class: 'pick-status', text: 'Здесь пусто' })));
    const rows = root.querySelectorAll('.ach-row');
    if (rows.length) focus(rows[Math.max(0, Math.min(keep, rows.length - 1))], { scroll: false });
    updateHints();
  };
  layer.handle = (btn) => {
    if (btn === 'X') { const k = Object.keys(ACH_FILTERS); filter = k[(k.indexOf(filter) + 1) % k.length]; sound('tab'); render(S.achData[gameId]); return true; }
    if (btn === 'Y') { root.classList.add('busy'); loadAch(gameId, true).then((c) => { root.classList.remove('busy'); render(c); toast('Достижения обновлены'); }); return true; }
    return false;
  };
  layer.focusFirst = () => { const r = root.querySelector('.ach-row'); if (r) focus(r); };
  root.append(h('div', { class: 'pick-status', text: 'Загружаю достижения…' }));
  pushLayer(layer);
  render(await loadAch(gameId));
}

// --- Trophies screen
async function openTrophies(force) {
  const view = $('#view-trophies');
  if (S.trophies && !force && Date.now() - S.trophies.at < 5 * 60e3) { renderTrophies(); return; }
  if (!S.trophies) view.replaceChildren(h('div', { class: 'tr-wait' }, I.trophy(48), h('b', { text: 'Собираю достижения…' }), h('span', { id: 'tr-prog', text: '' })));
  const r = await api.achAll(!!force);
  if (r.library) applyLibrary(r.library);
  S.trophies = { at: Date.now(), games: r.games || [], error: r.error, code: r.code };
  if (S.tab === 'trophies' && !layers.length) { renderTrophies(); intro(view); defaultFocus(); }
}
api.onAchProgress((p) => { const el = $('#tr-prog'); if (el) el.textContent = p.total ? `${p.done} из ${p.total} игр` : ''; });

function achCard(a, game, row) {
  const r = rarityOf(a.pct);
  return h('button', { class: `tile ach-card${r ? ` ${r}` : ''}`, nav: row, 'aria-label': `${a.name} — ${game.name}`, act: () => openAchievements(game.id) },
    achIcon(a, 72),
    h('span', { class: 'ach-txt' },
      h('b', { text: a.name }),
      h('span', { text: game.name }),
      h('span', { class: 'ach-sub', text: [a.time ? fmtDate(a.time) : null, pctText(a.pct)].filter(Boolean).join(' · ') })));
}
function renderTrophies() {
  const view = $('#view-trophies');
  const T = S.trophies;
  if (!T) return;
  const games = T.games.map((x) => ({ g: byId(x.id), d: x.data })).filter((x) => x.g && x.d && x.d.total);
  if (!games.length) {
    const msg = T.code === 'NOKEY' || !S.settings.steamKey ? 'Чтобы видеть достижения Steam, добавь ключ Steam Web API в настройках (≡ → Steam).'
      : T.code === 'PRIVATE' ? 'Steam не отдаёт достижения: в настройках приватности профиля Steam открой «Сведения об играх» и нажми Y, чтобы обновить.'
        : T.error || 'Пока нет достижений. Поиграй во что-нибудь из Steam!';
    view.replaceChildren(h('div', { class: 'lib-head' }, h('div', {}, h('h1', { text: 'Трофеи' }))), h('div', { class: 'lib-scroll' }, h('div', { class: 'empty', text: msg })));
    return;
  }
  const all = [];
  for (const { g, d } of games) for (const a of d.items) if (a.unlocked) all.push({ a, g });
  const perfect = games.filter(({ d }) => d.unlocked === d.total);
  const avg = Math.round(games.reduce((s2, { d }) => s2 + d.unlocked / d.total, 0) / games.length * 100);
  const rarest = all.filter((x) => x.a.pct != null).sort((x, y) => x.a.pct - y.a.pct);
  const recent = [...all].sort((x, y) => y.a.time - x.a.time);
  const near = games.filter(({ d }) => d.unlocked < d.total && d.unlocked / d.total >= 0.5).sort((x, y) => y.d.unlocked / y.d.total - x.d.unlocked / x.d.total);
  const byPct = [...games].sort((x, y) => (y.d.unlocked / y.d.total) - (x.d.unlocked / x.d.total) || y.d.unlocked - x.d.unlocked);

  const stat = (v, l) => h('div', { class: 'tr-stat' }, h('b', { text: v }), h('span', { text: l }));
  const block = (title, sub, row) => h('div', { class: 'row-wrap' }, h('div', { class: 'row-title' }, h('h2', { text: title }), sub ? h('span', { text: sub }) : null), row);
  const rowOf = (els) => h('div', { class: 'row', 'data-scroll': 'x' }, ...els);
  const progTile = (g, d, kind, row) => {
    const t = gameTile(g, kind, row, kind === 'wide' ? { sub: `${d.unlocked} из ${d.total}` } : {});
    t._act = () => openAchievements(g.id);
    t.append(h('div', { class: `tile-prog${d.unlocked === d.total ? ' full' : ''}` }, h('div', { style: `width:${(d.unlocked / d.total) * 100}%` })));
    if (kind === 'cover') t.append(h('span', { class: `badge ach-badge${d.unlocked === d.total ? ' full' : ''}` }, I.trophy(12), `${Math.floor((d.unlocked / d.total) * 100)}%`));
    return t;
  };
  const prevScroll = view.querySelector('.home-scroll')?.scrollTop || 0;
  const scroller = h('div', { class: 'home-scroll tr-scroll', 'data-scroll': 'y' },
    h('div', { class: 'home-inner tr-inner' },
      h('div', { class: 'tr-head' },
        h('div', {}, h('h1', { text: 'Трофеи' }), h('div', { class: 'sub', text: `Достижения Steam · ${gamesWord(games.length)}` })),
        h('div', { class: 'tr-stats' },
          stat(all.length.toLocaleString('ru-RU'), 'получено'),
          stat(String(perfect.length), perfect.length === 1 ? 'игра на 100%' : 'игр на 100%'),
          stat(`${avg}%`, 'средний прогресс'),
          rarest[0] ? stat(pctText(rarest[0].a.pct).replace(' игроков', ''), 'самое редкое') : null)),
      recent.length ? block('Последние', null, rowOf(recent.slice(0, 20).map(({ a, g }) => achCard(a, g, 'tr-recent')))) : null,
      rarest.length ? block('Самые редкие', 'твои достижения, которые есть у немногих', rowOf(rarest.slice(0, 20).map(({ a, g }) => achCard(a, g, 'tr-rare')))) : null,
      near.length ? block('Почти на 100%', null, rowOf(near.slice(0, 12).map(({ g, d }) => progTile(g, d, 'wide', 'tr-near')))) : null,
      block('Все игры', 'по прогрессу', rowOf(byPct.map(({ g, d }) => progTile(g, d, 'cover', 'tr-all'))))));
  scroller.addEventListener('scroll', () => $('#topbar').classList.toggle('solid', scroller.scrollTop > 40));
  view.replaceChildren(scroller);
  scroller.scrollTop = prevScroll;
}

// unlocked while playing: a card when Lobby comes back
api.onAchNew((d) => {
  if (d.library) applyLibrary(d.library);
  S.achData[d.gameId] = { data: d.data, at: Date.now() };
  if (S.trophies) S.trophies.at = 0;
  const g = byId(d.gameId);
  if (!g) return;
  const items = d.items.slice(0, 5);
  const box = h('div', { class: 'menu achnew', role: 'dialog' },
    h('span', { class: 'eyebrow', text: 'Получено во время игры' }),
    h('h2', { text: g.name }),
    h('div', { class: 'achnew-list' }, ...items.map((a, k) => h('div', { class: `achnew-row ${rarityOf(a.pct)}`, style: `--i:${k}` },
      achIcon({ ...a, unlocked: true }, 56),
      h('span', { class: 'ach-txt' }, h('b', { text: a.name }), h('span', { text: [RARITY[rarityOf(a.pct)], pctText(a.pct)].filter(Boolean).join(' · ') }))))),
    d.items.length > 5 ? h('p', { text: `и ещё ${d.items.length - 5}` }) : null,
    h('div', { class: 'sl-actions' },
      h('button', { class: 'btn primary', nav: 'an', key: 'ok', act: () => popLayer(layer) }, 'Отлично'),
      h('button', { class: 'btn', nav: 'an', act: () => { popLayer(layer); openAchievements(g.id); } }, 'Все достижения')));
  const layer = { el: h('div', {}, h('div', { class: 'scrim' }), box), kind: 'achnew', hints: [['A', 'Выбрать'], ['B', 'Закрыть']] };
  setTimeout(() => { pushLayer(layer); sound('done'); }, 600);
  refreshAll();
});

// =====================================================================
// Friends (Steam): who is online, what they play, recent games and games in common
// =====================================================================
S.friends = null;
const FSTATE = ['Не в сети', 'В сети', 'Занят', 'Отошёл', 'Спит', 'Хочет обменяться', 'Хочет поиграть'];
const steamHeader = (appid) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
const friendStatus = (f) => (f.game ? `Играет в ${f.game}` : f.state ? FSTATE[f.state] || 'В сети' : f.lastOff ? `Был ${fmtAgo(f.lastOff)}` : 'Не в сети');
const friendKind = (f) => (f.game ? 'ingame' : f.state ? 'online' : 'offline');
function friendAvatar(f, size) {
  const el = h('span', { class: `fr-av ${friendKind(f)}`, style: `--sz:${size}px` });
  if (f.avatar) { const img = h('img', { alt: '' }); img.onerror = () => el.replaceChildren(f.name[0].toUpperCase()); img.src = f.avatar; el.append(img); } else el.textContent = f.name[0].toUpperCase();
  return el;
}
function gameArt(appid, name) {
  const el = h('span', { class: 'fg-art', style: `background:${PALETTE[hash(name || appid) % PALETTE.length][0]}` });
  const img = h('img', { alt: '', loading: 'lazy' });
  img.onload = () => { el.classList.add('ok'); img.classList.add('ok'); };
  img.src = steamHeader(appid);
  el.append(img);
  return el;
}
let friendsTimer = 0;
async function loadFriends(force) {
  const r = await api.friendsList(!!force);
  if (!r) return;
  const sig = (x) => (x && x.friends ? x.friends.filter((f) => f.game).map((f) => f.id + f.game).join() : '');
  const homeChanged = sig(S.friends) !== sig(r);
  S.friends = { ...r, at: Date.now() };
  clearTimeout(friendsTimer);
  friendsTimer = setTimeout(() => loadFriends(), S.tab === 'friends' ? 60e3 : 180e3);
  if (layers.length) { for (const l of layers) if (l.kind === 'friend' && l.refresh) l.refresh(); return; }
  if (S.tab === 'friends' || (S.tab === 'home' && homeChanged)) refresh();
}
function sortFriends(list) {
  const rank = (f) => (f.game ? 0 : f.state ? 1 : 2);
  return [...list].sort((a, b) => rank(a) - rank(b) || (b.lastOff - a.lastOff) || a.name.localeCompare(b.name, 'ru'));
}
function friendTile(f, row) {
  const kids = [];
  if (f.game && f.gameId) kids.push(gameArt(f.gameId, f.game), h('span', { class: 'fg-shade' }));
  kids.push(friendAvatar(f, f.game ? 64 : 56),
    h('span', { class: 'fr-txt' }, h('b', { text: f.name }), h('span', { class: 'fr-st', text: friendStatus(f) })));
  return h('button', { class: `tile friend ${friendKind(f)}${f.game ? ' playing' : ''}`, nav: row, key: f.id, 'aria-label': f.name, act: () => openFriend(f.id) }, ...kids);
}
function renderFriends() {
  const view = $('#view-friends');
  const F = S.friends;
  if (!F) {
    view.replaceChildren(h('div', { class: 'tr-wait' }, I.users(48), h('b', { text: 'Загружаю друзей…' })));
    return;
  }
  const list = sortFriends(F.friends || []);
  const head = (sub) => h('div', { class: 'tr-head' }, h('div', {}, h('h1', { text: 'Друзья' }), h('div', { class: 'sub', text: sub })), stats);
  if (!list.length) {
    const msg = F.code === 'NOKEY' || !S.settings.steamKey ? 'Чтобы видеть друзей из Steam, добавь ключ Steam Web API в настройках (≡ → Steam).' : F.error || 'В Steam пока нет друзей.';
    view.replaceChildren(h('div', { class: 'lib-head' }, h('div', {}, h('h1', { text: 'Друзья' }))), h('div', { class: 'lib-scroll' }, h('div', { class: 'empty', text: msg })));
    return;
  }
  const playing = list.filter((f) => f.game);
  const online = list.filter((f) => !f.game && f.state);
  const offline = list.filter((f) => !f.game && !f.state);
  const stat = (v, l) => h('div', { class: 'tr-stat' }, h('b', { text: v }), h('span', { text: l }));
  var stats = h('div', { class: 'tr-stats' }, stat(String(playing.length), 'в игре'), stat(String(online.length + playing.length), 'в сети'), stat(String(list.length), plural(list.length, 'друг', 'друга', 'друзей')));
  const block = (title, sub, row) => h('div', { class: 'row-wrap' }, h('div', { class: 'row-title' }, h('h2', { text: title }), sub ? h('span', { text: sub }) : null), row);
  const grid = (arr, row) => h('div', { class: 'fr-grid-list' }, ...arr.map((f) => friendTile(f, row)));
  const prevScroll = view.querySelector('.home-scroll')?.scrollTop || 0;
  const scroller = h('div', { class: 'home-scroll tr-scroll', 'data-scroll': 'y' },
    h('div', { class: 'home-inner tr-inner' },
      head(`Steam · обновляется само${F.stale ? ' · нет связи, показан прошлый список' : ''}`),
      playing.length ? block('Играют сейчас', null, h('div', { class: 'row', 'data-scroll': 'x' }, ...playing.map((f) => friendTile(f, 'f-play')))) : null,
      online.length ? block('В сети', null, grid(online, 'f-on')) : null,
      offline.length ? block('Не в сети', null, grid(offline, 'f-off')) : null));
  scroller.addEventListener('scroll', () => $('#topbar').classList.toggle('solid', scroller.scrollTop > 40));
  view.replaceChildren(scroller);
  scroller.scrollTop = prevScroll;
}
// home: friends who are playing right now
function friendsBlock(block) {
  const playing = S.friends ? sortFriends(S.friends.friends || []).filter((f) => f.game) : [];
  if (!playing.length) return null;
  return block('Друзья играют', `${playing.length} ${plural(playing.length, 'друг', 'друга', 'друзей')} сейчас в игре`,
    h('div', { class: 'row', 'data-scroll': 'x' }, ...playing.slice(0, 12).map((f) => friendTile(f, 'f-home'))));
}

async function openFriend(id) {
  const root = h('div', {});
  const layer = { el: root, kind: 'friend', hints: [['A', 'Выбрать'], ['B', 'Назад']] };
  let detail = null;
  layer.refresh = () => {
    const f = (S.friends && S.friends.friends.find((x) => x.id === id));
    if (!f) return popLayer(layer);
    const keep = S.focused && root.contains(S.focused) ? S.focused.dataset.key : null;
    const restore = keepScroll(root);
    const mineG = (appid) => byId(`steam:${appid}`);
    const gameRow = (g, sub, key) => {
      const own = mineG(g.appid);
      return h('button', { class: 'fg-row', nav: 'fg', key, act: () => { if (own) { popLayer(layer); openGame(own.id); } else { sound('bump'); toast('Этой игры нет в твоей библиотеке'); } } },
        gameArt(g.appid, g.name), h('span', { class: 'rw-txt' }, h('b', { text: g.name }), h('span', { text: sub })),
        own ? h('span', { class: 'fg-own', text: own.installed ? 'установлена' : 'есть у тебя' }) : null);
    };
    const d = detail;
    const sections = [];
    if (!d) sections.push(h('div', { class: 'pick-status', text: 'Загружаю игры друга…' }));
    else {
      if (d.recent.length) sections.push(h('div', { class: 'group-label', text: 'Играл последние две недели' }),
        h('div', { class: 'fg-list' }, ...d.recent.map((g) => gameRow(g, `${fmtTime(g.week2)} за 2 недели · всего ${fmtTime(g.total)}`, `r${g.appid}`))));
      if (d.gamesHidden) sections.push(h('div', { class: 'group-label', text: 'Общие игры' }), h('p', { class: 'fr-note', text: 'Друг скрыл список игр в Steam, поэтому общие игры не видны.' }));
      else if (d.common.length) sections.push(h('div', { class: 'group-label', text: `Общие игры · ${d.common.length} из ${d.owned}` }),
        h('div', { class: 'fg-list' }, ...d.common.slice(0, 30).map((g) => gameRow(g, `у друга ${g.theirs ? fmtTime(g.theirs) : 'не играл'} · у тебя ${g.mine ? fmtTime(g.mine) : 'не играл'}`, `c${g.appid}`))));
      else sections.push(h('div', { class: 'group-label', text: 'Общие игры' }), h('p', { class: 'fr-note', text: 'Общих игр нет.' }));
    }
    const own = f.gameId ? mineG(f.gameId) : null;
    const scroll = h('div', { class: 'sheet-scroll', 'data-scroll': 'y' },
      h('div', { class: 'pf-head' }, friendAvatar(f, 112),
        h('div', { class: 'pf-who' },
          h('span', { class: `eyebrow fr-eb ${friendKind(f)}`, text: friendStatus(f) }),
          h('h1', { text: f.name }),
          h('div', { class: 'fr-meta', text: [d && d.level != null ? `Уровень Steam ${d.level}` : null, f.since ? `в друзьях с ${new Date(f.since).getFullYear()} года` : null].filter(Boolean).join(' · ') }))),
      f.game && f.gameId ? h('div', { class: 'fr-now' }, gameArt(f.gameId, f.game), h('span', { class: 'fg-shade' }),
        h('span', { class: 'fr-now-txt' }, h('span', { class: 'eyebrow', text: 'Сейчас играет' }), h('b', { text: f.game }))) : null,
      h('div', { class: 'acts pf-acts' },
        f.lobby ? h('button', { class: 'btn primary', nav: 'fa', key: 'join', act: () => { sound('launch'); api.friendOpen({ kind: 'join', id: f.id, appid: f.gameId, lobby: f.lobby }); } }, 'Присоединиться') : null,
        !f.lobby && own && own.installed ? h('button', { class: 'btn primary', nav: 'fa', key: 'play', act: () => { popLayer(layer); launch(own.id); } }, `Играть тоже`) : null,
        h('button', { class: `btn${f.lobby || (own && own.installed) ? '' : ' primary'}`, nav: 'fa', key: 'chat', act: () => { sound('select'); api.friendOpen({ kind: 'chat', id: f.id }); toast('Открываю чат в Steam'); } }, 'Написать'),
        h('button', { class: 'btn', nav: 'fa', key: 'profile', act: () => { api.friendOpen({ kind: 'profile', id: f.id }); toast('Открываю профиль в Steam'); } }, 'Профиль Steam')),
      ...sections);
    root.replaceChildren(h('div', { class: 'scrim' }), h('div', { class: 'sheet profile-sheet friend-sheet', role: 'dialog' }, scroll));
    restore();
    if (keep) { const el = root.querySelector(`[data-key="${keep}"]`); if (el) focus(el, { scroll: false }); }
  };
  layer.focusFirst = () => focus(root.querySelector('.pf-acts .btn'));
  layer.refresh();
  pushLayer(layer);
  detail = await api.friendDetail(id);
  if (detail && detail.error) detail = null;
  if (layers.includes(layer)) layer.refresh();
}

// =====================================================================
// Game Bro: daily challenges, experience, levels
// =====================================================================
S.bro = null;
const BRO_GREET = ['Йо! Вот задания на сегодня', 'Бро, есть дело — три челленджа ждут', 'Сегодня без отговорок: погнали!', 'Готов прокачаться? Я подобрал игры', 'Новый день — новый опыт. Разберём?'];
const BRO_PRAISE = ['Красава!', 'Вот это я понимаю!', 'Чётко!', 'Изи!', 'Мощно!', 'Так держать!'];
const broLine = () => {
  const b = S.bro;
  if (!b || !b.challenges.length) return 'Установи хоть одну игру — и я подкину заданий';
  if (b.challenges.every((c) => c.done)) return 'Все челленджи закрыты. Красава! Завтра будут новые';
  return BRO_GREET[new Date().getDate() % BRO_GREET.length];
};
function broText(c) {
  if (c.kind === 'week') return `Неделя: наиграй ${fmtTime(c.target)} в любые игры`;
  if (c.kind === 'first') return `Запусти ${c.name} впервые и сыграй ${c.target} мин`;
  if (c.kind === 'return') return `Вернись в ${c.name} на ${c.target} мин`;
  if (c.kind === 'ach') return `Получи достижение в ${c.name}`;
  return `Сыграй в ${c.name} ${c.target} мин`;
}
const broProg = (c) => (c.kind === 'ach' ? (c.done ? 'выполнено' : 'нужно 1 достижение') : `${c.progress} / ${c.target} мин${c.kind === 'week' ? ' · до понедельника' : ''}`);
const broAll = (b = S.bro) => (b ? [...(b.week ? [b.week] : []), ...b.challenges] : []);
function broFace(size = 56, mood = '') {
  const el = document.createElementNS(SVGNS, 'svg');
  el.setAttribute('width', size); el.setAttribute('height', size); el.setAttribute('viewBox', '0 0 64 64');
  el.setAttribute('class', `bro-face ${mood}`); el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<line x1="32" y1="4" x2="32" y2="12" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
    <circle cx="32" cy="5" r="4" fill="currentColor"/>
    <rect x="6" y="12" width="52" height="44" rx="14" fill="#161616" stroke="currentColor" stroke-width="3"/>
    ${mood === 'happy'
    ? '<path d="M18 33 q5 -7 10 0 M36 33 q5 -7 10 0" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>'
    : '<rect class="eye" x="19" y="26" width="7" height="12" rx="3.5" fill="currentColor"/><rect class="eye" x="38" y="26" width="7" height="12" rx="3.5" fill="currentColor"/>'}
    <path d="M25 46 q7 5 14 0" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>`;
  return el;
}
// =====================================================================
// rewards unlocked by level: frames, badges, titles, accents, sounds, backgrounds, effects, Game Bro perks.
// The highest level ever reached counts, so prestige never takes anything away.
// =====================================================================
const FRAMES = [
  { id: 'none', name: 'Обычная', lvl: 1 },
  { id: 'bronze', name: 'Бронзовая', lvl: 5 },
  { id: 'silver', name: 'Серебряная', lvl: 15 },
  { id: 'gold', name: 'Золотая', lvl: 30 },
  { id: 'neon', name: 'Неоновая', lvl: 50 },
];
const BADGES = [
  { id: 'auto', name: 'Аватар Steam', lvl: 1, hint: 'или первая буква ника' },
  { id: 'pad', name: 'Геймпад', lvl: 2, d: ['M7 6.5h10a4.5 4.5 0 0 1 4.4 5.2l-.7 4.1a2.7 2.7 0 0 1-4.8 1.2L14.4 15H9.6l-1.5 2a2.7 2.7 0 0 1-4.8-1.2l-.7-4.1A4.5 4.5 0 0 1 7 6.5z', 'M7.5 9.6v3.4', 'M5.8 11.3h3.4', 'M16 10.2h.01', 'M17.8 12.2h.01'] },
  { id: 'bolt', name: 'Молния', lvl: 6, d: 'M13.5 2 4.5 13.5h6.5l-1 8.5 9-11.5h-6.5z', fill: true },
  { id: 'crown', name: 'Корона', lvl: 10, d: 'M3 7.5l4.5 4 4.5-6.5 4.5 6.5 4.5-4-1.8 11H4.8z', fill: true },
  { id: 'star', name: 'Звезда', lvl: 20, d: 'M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z', fill: true },
  { id: 'flame', name: 'Пламя', lvl: 30, d: 'M12 2c.6 3.6 5.5 6.3 5.5 11.5a5.5 5.5 0 0 1-11 0c0-2.4 1.1-4.1 2.4-5.3.1 2.2 1 3.4 2.3 3.6-.4-3.7.2-6.6.8-9.8z', fill: true },
  { id: 'diamond', name: 'Алмаз', lvl: 40, d: ['M6.5 3.5h11l4 5.5L12 21 2.5 9z', 'M2.5 9h19', 'M9 3.5 7.5 9 12 21l4.5-12L15 3.5'] },
];
const TITLES = [
  { id: 'none', name: 'Без титула', lvl: 1, hint: 'только ник' },
  { id: 'novice', name: 'Новичок', lvl: 1 },
  { id: 'regular', name: 'Завсегдатай', lvl: 5 },
  { id: 'gamer', name: 'Геймер', lvl: 10 },
  { id: 'hunter', name: 'Охотник за трофеями', lvl: 15 },
  { id: 'marathon', name: 'Марафонец', lvl: 20 },
  { id: 'collector', name: 'Коллекционер', lvl: 25 },
  { id: 'veteran', name: 'Ветеран', lvl: 30 },
  { id: 'master', name: 'Мастер', lvl: 40 },
  { id: 'legend', name: 'Легенда Lobby', lvl: 50 },
];
const SPECIAL_ACCENTS = [
  { id: 'grad:sunset', name: 'Закат', lvl: 12, base: '#FF8A5B', grad: 'linear-gradient(90deg, #FF5F6D, #FFC371, #FF8A5B, #FF5F6D)' },
  { id: 'grad:chrome', name: 'Хром', lvl: 18, base: '#D9DEE5', grad: 'linear-gradient(90deg, #8E9EAB, #F5F7FA, #9AA6B2, #FFFFFF, #8E9EAB)' },
  { id: 'grad:aurora', name: 'Аврора', lvl: 25, base: '#5EE7C4', grad: 'linear-gradient(90deg, #43E97B, #38F9D7, #8B7CFF, #D77BF0, #43E97B)' },
];
const SFX_PACKS = [
  { id: 'classic', name: 'Классика', lvl: 1, hint: 'стандартные звуки' },
  { id: 'soft', name: 'Мягкие', lvl: 3 },
  { id: '8bit', name: '8-бит', lvl: 10 },
  { id: 'scifi', name: 'Sci-fi', lvl: 18 },
];
const AMBIENTS = [
  { id: 'none', name: 'Без фона', lvl: 1, hint: 'чистый чёрный' },
  { id: 'fog', name: 'Туман', lvl: 8 },
  { id: 'particles', name: 'Частицы', lvl: 15 },
  { id: 'aurora', name: 'Сияние', lvl: 25 },
];
const FOCUS_FX = [
  { id: 'glow', name: 'Свечение', lvl: 1, hint: 'стандартная подсветка' },
  { id: 'shine', name: 'Блик', lvl: 7 },
  { id: 'sparks', name: 'Искры', lvl: 20 },
];
const LAUNCH_FX_LVL = 4;
const PERKS = [
  { lvl: 10, name: '+1 замена челленджа в день' },
  { lvl: 20, name: 'Четвёртый челлендж в день' },
  { lvl: 25, name: 'Недельный челлендж с двойным опытом' },
  { lvl: 50, name: 'Престиж: начать с 1 уровня со звездой' },
];
const levelNow = () => (S.bro ? S.bro.level : 1);
const unlockLv = () => (S.bro ? Math.max(S.bro.level, S.bro.peak || 1) : 1);
const isOpen = (o) => unlockLv() >= o.lvl;
// a saved choice that is not unlocked (or no longer exists) falls back to the default
const chosen = (list, key, def) => { const o = list.find((x) => x.id === S.settings[key]); return o && isOpen(o) ? o.id : def; };

function allRewards() {
  const out = [];
  const add = (list, kind, label) => list.forEach((o) => { if (o.lvl > 1) out.push({ ...o, kind, label }); });
  add(FRAMES, 'frame', 'Рамка аватара');
  add(BADGES, 'badge', 'Значок аватара');
  add(TITLES, 'title', 'Титул');
  add(SPECIAL_ACCENTS, 'accent', 'Особый цвет');
  add(SFX_PACKS, 'sfx', 'Звуки интерфейса');
  add(AMBIENTS, 'ambient', 'Живой фон');
  add(FOCUS_FX, 'focus', 'Эффект выбора');
  out.push({ id: 'launch', name: 'Анимация запуска игры', lvl: LAUNCH_FX_LVL, kind: 'launch', label: 'Эффект' });
  PERKS.forEach((p) => out.push({ ...p, id: `perk${p.lvl}`, kind: 'perk', label: 'Game Bro' }));
  return out.sort((a, b) => a.lvl - b.lvl);
}
const rewardsBetween = (from, to) => allRewards().filter((r) => r.lvl > from && r.lvl <= to);
const nextReward = () => allRewards().find((r) => r.lvl > unlockLv());

function frameFor(choice = S.settings.avatarFrame || 'auto', lv = unlockLv()) {
  if (choice === 'auto') return [...FRAMES].reverse().find((f) => lv >= f.lvl).id;
  const f = FRAMES.find((x) => x.id === choice);
  return f && lv >= f.lvl ? f.id : 'none';
}
function titleFor(choice = S.settings.title || 'auto') {
  if (choice === 'auto') return [...TITLES].reverse().find((t) => t.id !== 'none' && isOpen(t));
  const t = TITLES.find((x) => x.id === choice);
  return t && isOpen(t) ? t : TITLES[1];
}
function badgeSvg(b, size) {
  return icon(b.d, { size, fill: !!b.fill });
}
// the avatar: Steam picture / first letter, or a badge picked in settings
function avatarEl(badgeId = chosen(BADGES, 'avatarIcon', 'auto')) {
  const p = S.profile;
  const name = (p && p.personaName) || 'Игрок';
  const av = h('span', { class: 'avatar' });
  const b = BADGES.find((x) => x.id === badgeId && x.d);
  if (b) { av.classList.add('av-badge'); av.append(badgeSvg(b, 30)); return av; }
  if (p && p.avatar) {
    const img = h('img', { alt: '' });
    img.onerror = () => { av.replaceChildren(name[0].toUpperCase()); };
    img.src = p.avatar;
    av.append(img);
  } else av.textContent = name[0].toUpperCase();
  return av;
}
function avatarPreview(frameId, size = 72, badgeId) {
  return h('span', { class: `av-frame fr-${frameId}`, style: `--av:${size}px` }, avatarEl(badgeId));
}
const stars = (n) => (n > 5 ? `★×${n}` : '★'.repeat(n));
function applyFrame() {
  const el = $('#av-frame');
  if (!el) return;
  el.className = `av-frame fr-${frameFor()}`;
  const pr = (S.bro && S.bro.prestige) || 0;
  const st = h('span', { class: 'av-stars', text: pr ? stars(pr) : '' });
  el.replaceChildren(avatarEl(), st);
  el.firstChild.id = 'avatar';
}

// accents: special ones are a gradient on fills plus a solid base colour for glows and text
function accentInfo(c) {
  const sp = SPECIAL_ACCENTS.find((a) => a.id === c);
  if (sp) return { base: sp.base, grad: sp.grad, name: sp.name, special: sp };
  return { base: c || ACCENTS[0], grad: null, name: accentName(c) };
}
function applyAccent(c = S.settings.accent || ACCENTS[0]) {
  let a = accentInfo(c);
  if (a.special && !isOpen(a.special) && c === S.settings.accent) a = accentInfo(ACCENTS[0]);
  const root = document.documentElement;
  root.style.setProperty('--accent', a.base);
  if (a.grad) { root.style.setProperty('--accent-grad', a.grad); root.classList.add('acc-grad'); } else { root.style.removeProperty('--accent-grad'); root.classList.remove('acc-grad'); }
  try { localStorage.setItem('accent', a.base); } catch { /* ignore */ }
}

// live background behind everything
const Ambient = {
  kind: null, raf: 0, canvas: null,
  set(kind) {
    if (kind === this.kind) return;
    this.kind = kind;
    cancelAnimationFrame(this.raf);
    const el = $('#ambient');
    el.className = `amb-${kind}`;
    el.replaceChildren();
    if (kind === 'fog') el.append(h('i', { class: 'fog-a' }), h('i', { class: 'fog-b' }), h('i', { class: 'fog-c' }));
    if (kind === 'aurora') el.append(h('i', { class: 'au-a' }), h('i', { class: 'au-b' }), h('i', { class: 'au-c' }));
    if (kind === 'particles') this.particles(el);
  },
  particles(el) {
    const cv = h('canvas', {});
    el.append(cv);
    const W = 1920, H = 1080;
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const dots = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 0.8 + Math.random() * 2.2, v: 0.15 + Math.random() * 0.45, p: Math.random() * 6.28, a: 0.15 + Math.random() * 0.5 }));
    let last = 0;
    const tick = (t) => {
      this.raf = requestAnimationFrame(tick);
      if (t - last < 33) return; // ~30 fps is plenty for slow dust
      last = t;
      const col = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#fff';
      ctx.clearRect(0, 0, W, H);
      for (const d of dots) {
        d.y -= d.v; d.p += 0.01; d.x += Math.sin(d.p) * 0.3;
        if (d.y < -10) { d.y = H + 10; d.x = Math.random() * W; }
        ctx.globalAlpha = d.a * (0.6 + 0.4 * Math.sin(d.p * 2));
        ctx.fillStyle = d.r > 2.4 ? col : '#ffffff';
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.283); ctx.fill();
      }
    };
    this.raf = requestAnimationFrame(tick);
  },
};
function applyCosmetics() {
  applyAccent();
  applyFrame();
  Ambient.set(chosen(AMBIENTS, 'ambient', 'none'));
  const fx = chosen(FOCUS_FX, 'focusFx', 'glow');
  document.documentElement.classList.toggle('fx-shine', fx === 'shine');
  document.documentElement.classList.toggle('fx-sparks', fx === 'sparks');
}

// generic picker for anything unlockable; `preview(o)` draws the option, `onTry(o)` previews it live
function unlockBox({ title, note, opts, current, preview, onTry, onCancel, cols = 3, kind = 'unlock' }) {
  return new Promise((resolve) => {
    const lv = unlockLv();
    let done = false;
    const grid = h('div', { class: 'fr-grid', style: `grid-template-columns:repeat(${cols}, 1fr)` }, ...opts.map((o, k) => {
      const locked = lv < o.lvl;
      return h('button', {
        class: `fr-opt${locked ? ' locked' : ''}${o.id === current ? ' cur' : ''}`, nav: `u${Math.floor(k / cols)}`, key: o.id, 'aria-label': o.name,
        onfocus: () => { if (!done && onTry) onTry(o); },
        act: () => {
          if (locked) { sound('bump'); toast(`«${o.name}» откроется на ${o.lvl} уровне`); return; }
          finish(o.id);
        },
      }, preview(o), h('b', { text: o.name }),
      h('span', { text: locked ? `с ${o.lvl} уровня` : o.hint || (o.lvl > 1 ? `открыто с ${o.lvl} уровня` : 'всегда') }),
      locked ? h('span', { class: 'fr-lock' }, I.lock(16)) : null);
    }));
    const box = h('div', { class: `menu frames ${kind}`, role: 'dialog' },
      h('h2', { text: title }), h('p', { text: note || `Твой уровень: ${levelNow()}. Новое открывается с уровнем Game Bro.` }), grid,
      h('div', { class: 'sl-actions' }, h('button', { class: 'btn', nav: 'frb', act: () => finish(null) }, 'Отмена')));
    const layer = { el: h('div', {}, h('div', { class: 'scrim' }), box), kind: 'frames', hints: [['A', 'Выбрать'], ['B', 'Отмена']] };
    const finish = (v) => {
      if (done) return;
      done = true;
      if (v == null && onCancel) onCancel();
      popLayer(layer);
      resolve(v);
    };
    layer.onBack = () => finish(null);
    layer.focusFirst = () => focus(grid.querySelector('.fr-opt.cur') || grid.firstChild);
    pushLayer(layer);
  });
}
const frameBox = () => unlockBox({
  title: 'Рамка аватара', note: `Твой уровень: ${levelNow()}. Новые рамки открываются на 5, 15, 30 и 50 уровне.`,
  opts: [{ id: 'auto', name: 'Авто', lvl: 1, hint: 'лучшая из открытых' }, ...FRAMES], current: S.settings.avatarFrame || 'auto',
  preview: (o) => avatarPreview(o.id === 'auto' ? frameFor('auto') : o.id, 72),
});
const badgeBox = () => unlockBox({
  title: 'Значок аватара', cols: 4, opts: BADGES, current: chosen(BADGES, 'avatarIcon', 'auto'),
  preview: (o) => avatarPreview(frameFor(), 64, o.id),
});
const titleBoxPick = () => unlockBox({
  title: 'Титул', note: 'Показывается под ником. «Авто» берёт самый высокий из открытых.', cols: 4,
  opts: [{ id: 'auto', name: 'Авто', lvl: 1, hint: titleFor('auto').name }, ...TITLES], current: S.settings.title || 'auto',
  preview: (o) => h('span', { class: 'tt-prev', text: o.id === 'auto' ? titleFor('auto').name : o.id === 'none' ? '—' : o.name }),
});
const sfxBox = () => {
  const before = S.settings.sfxPack;
  return unlockBox({
    title: 'Звуки интерфейса', note: 'Наведи на набор, чтобы послушать', cols: 4, opts: SFX_PACKS, current: chosen(SFX_PACKS, 'sfxPack', 'classic'),
    preview: (o) => h('span', { class: 'fx-prev snd' }, icon(['M4 9v6h4l5 4V5L8 9z', 'M16 9a4 4 0 0 1 0 6', 'M18.5 6.5a8 8 0 0 1 0 11'], { size: 30 })),
    onTry: (o) => { S.settings.sfxPack = o.id; setTimeout(() => sound('select'), 30); },
    onCancel: () => { S.settings.sfxPack = before; },
  }).then((v) => { S.settings.sfxPack = before; return v; });
};
const ambientBox = () => unlockBox({
  title: 'Живой фон', note: 'Фон за всем интерфейсом. Можно примерить, наведя на вариант.', cols: 4, opts: AMBIENTS, current: chosen(AMBIENTS, 'ambient', 'none'),
  preview: (o) => h('span', { class: `fx-prev amb-prev ap-${o.id}` }),
  onTry: (o) => Ambient.set(isOpen(o) ? o.id : chosen(AMBIENTS, 'ambient', 'none')),
  onCancel: () => Ambient.set(chosen(AMBIENTS, 'ambient', 'none')),
});
const focusBox = () => unlockBox({
  title: 'Эффект выбора', note: 'Как подсвечивается выбранная игра', opts: FOCUS_FX, current: chosen(FOCUS_FX, 'focusFx', 'glow'),
  preview: (o) => h('span', { class: `fx-prev foc-prev fp-${o.id}` }, h('i')),
});

// "a new level" screen lists everything it unlocked
function rewardIcon(r, size = 48) {
  if (r.kind === 'frame') return avatarPreview(r.id, size - 10);
  if (r.kind === 'badge') return avatarPreview('none', size - 10, r.id);
  if (r.kind === 'accent') return h('span', { class: 'rw-ic', style: `background:${r.grad}` });
  if (r.kind === 'ambient') return h('span', { class: `rw-ic amb-prev ap-${r.id}` });
  const paths = {
    title: ['M4 7h16', 'M4 12h10', 'M4 17h13'],
    sfx: ['M4 9v6h4l5 4V5L8 9z', 'M16 9a4 4 0 0 1 0 6'],
    focus: ['M4 8V4h4', 'M16 4h4v4', 'M20 16v4h-4', 'M8 20H4v-4'],
    launch: 'M7 4l13 8-13 8z',
  };
  if (r.kind === 'perk') return h('span', { class: 'rw-ic perk' }, broFace(size - 14));
  return h('span', { class: 'rw-ic' }, icon(paths[r.kind], { size: Math.round(size * 0.5), fill: r.kind === 'launch' }));
}
function rewardChip(r) {
  return h('div', { class: 'rw-chip' }, rewardIcon(r, 52), h('span', { class: 'rw-txt' }, h('b', { text: r.kind === 'title' ? `«${r.name}»` : r.name }), h('span', { text: r.label })));
}
function renderLevel() {
  const b = S.bro;
  applyCosmetics();
  const t = S.settings.title === 'none' ? null : titleFor();
  $('#profile-title').textContent = t ? t.name : '';
  $('#profile-title').hidden = !t;
  if (!b) return;
  $('#prestige').hidden = !b.prestige;
  $('#prestige').textContent = b.prestige ? stars(b.prestige) : '';
  $('#lvl-pill').textContent = `LV ${b.level}`;
  $('#xp-fill').style.width = `${Math.min(100, (b.into / b.need) * 100)}%`;
  $('#xp-text').textContent = `${b.into} / ${b.need} XP`;
}
function broCard(c, row) {
  const g = byId(c.gameId);
  const kids = [];
  if (g) { kids.push(placeholder(g), artImg(g.art.wide)); }
  kids.push(h('span', { class: 'bro-shade' }),
    h('span', { class: 'bro-body' },
      h('span', { class: 'bro-xp', text: c.done ? '✓ выполнено' : `+${c.xp} XP${c.kind === 'week' ? ' · ×2' : ''}` }),
      h('b', { text: broText(c) }),
      h('span', { class: 'bro-prog' }, h('span', { class: 'ach-bar' }, h('span', { style: `width:${(c.progress / c.target) * 100}%` })), h('span', { text: broProg(c) }))));
  if (c.kind === 'week') kids.unshift(h('span', { class: 'week-bg' }));
  return h('button', {
    class: `tile bro-card${c.done ? ' done' : ''}${c.kind === 'week' ? ' week' : ''}`, nav: row, 'aria-label': broText(c),
    act: () => { if (g) openGame(g.id); else if (c.kind === 'week' && row !== 'bl') openBro(); },
    alt: c.done || c.kind === 'week' ? null : () => rerollBro(c),
  }, ...kids);
}
function broBlock(block) {
  const b = S.bro;
  if (!b) return null;
  const r = h('div', { class: 'row', 'data-scroll': 'x' }, ...broAll(b).map((c) => broCard(c, 'bro')));
  const head = h('div', { class: 'row-title bro-title' }, broFace(30), h('h2', { text: 'Game Bro' }), h('span', { text: broLine() }));
  return b.challenges.length ? h('div', { class: 'row-wrap' }, head, r) : h('div', { class: 'row-wrap' }, head);
}
async function rerollBro(c) {
  confirmBox('Заменить челлендж?', `«${broText(c)}» заменится другим. Замен осталось сегодня: ${S.bro.rerolls}.`, 'Заменить', async () => {
    const r = await api.broReroll(c.id);
    if (r.error) return toast(r.error, 'warn');
    S.bro = r.state;
    sound('tab');
    refreshAll();
  });
}
function openBro() {
  const root = h('div', {});
  const layer = { el: root, kind: 'bro', hints: () => [['A', 'К игре'], ['X', 'Заменить'], ['B', 'Назад']] };
  layer.refresh = () => {
    const b = S.bro;
    const keep = S.focused && root.contains(S.focused) ? S.focused.getAttribute('aria-label') : null;
    const list = h('div', { class: 'bro-list' }, ...b.challenges.map((c) => broCard(c, 'bl')));
    const week = b.week ? h('div', { class: 'bro-list' }, broCard(b.week, 'bl')) : null;
    root.replaceChildren(h('div', { class: 'scrim' }), h('div', { class: 'sheet bro-sheet', role: 'dialog' },
      h('div', { class: 'bro-hero' }, broFace(96),
        h('div', { class: 'bro-say' }, h('b', { text: 'Game Bro' }), h('span', { text: broLine() }))),
      h('div', { class: 'bro-level' },
        h('span', { class: 'bro-lv', text: `${b.level}` }),
        h('div', { class: 'bro-lvtxt' },
          h('b', { text: `Уровень ${b.level}` }),
          h('span', { class: 'ach-bar' }, h('span', { style: `width:${(b.into / b.need) * 100}%` })),
          h('span', { class: 'bro-sub', text: `${b.into} из ${b.need} XP до уровня ${b.level + 1} · всего ${b.xp} XP` }))),
      week ? h('div', { class: 'group-label', text: 'Челлендж недели · двойной опыт' }) : null, week,
      h('div', { class: 'group-label', text: `Челленджи на сегодня · замен осталось: ${b.rerolls}` }),
      b.challenges.length ? list : h('div', { class: 'bro-sub', text: 'Установи хоть одну игру, и Game Bro подберёт задания.' }),
      h('div', { class: 'bro-note', text: `Время засчитывается за игры, запущенные из Lobby. Выполнено челленджей: ${b.done}.` })));
    const again = keep && [...root.querySelectorAll('[data-nav]')].find((e) => e.getAttribute('aria-label') === keep);
    if (again) focus(again, { scroll: false });
  };
  layer.refresh();
  pushLayer(layer);
}
// profile card: who you are, your stats and every reward on the way to level 50
const gameMinutes = (g) => g.minutes || 0;
function openProfile() {
  const root = h('div', {});
  const layer = { el: root, kind: 'profile', hints: [['A', 'Выбрать'], ['B', 'Назад']] };
  layer.refresh = () => {
    const b = S.bro || { level: 1, into: 0, need: 100, xp: 0, done: 0, prestige: 0 };
    const keep = S.focused && root.contains(S.focused) ? S.focused.dataset.key : null;
    const restore = keepScroll(root);
    const p = S.profile;
    const name = (p && p.personaName) || 'Игрок';
    const t = S.settings.title === 'none' ? null : titleFor();
    const games = S.games.filter((g) => !g.hidden);
    const total = games.reduce((m, g) => m + gameMinutes(g), 0);
    const fav = [...games].sort((x, y) => gameMinutes(y) - gameMinutes(x))[0];
    const ach = games.reduce((m, g) => m + ((g.ach && g.ach.u) || 0), 0);
    const stat = (v, l) => h('div', { class: 'pf-stat' }, h('b', { text: v }), h('span', { text: l }));
    const lv = unlockLv();
    const next = nextReward();
    const open = {
      frame: frameBox, badge: badgeBox, title: titleBoxPick, sfx: sfxBox, ambient: ambientBox, focus: focusBox,
      accent: () => openSettingsAt('accent'), launch: () => openSettingsAt('launchfx'), perk: openBro,
    };
    const saveKey = { frame: 'avatarFrame', badge: 'avatarIcon', title: 'title', sfx: 'sfxPack', ambient: 'ambient', focus: 'focusFx' };
    const pickFor = (r) => async () => {
      if (r.lvl > lv) { sound('bump'); toast(`Откроется на ${r.lvl} уровне`); return; }
      const v = await open[r.kind]();
      if (typeof v === 'string' && saveKey[r.kind]) { S.settings = await api.setSettings({ [saveKey[r.kind]]: v }); sound('toggle'); renderLevel(); layer.refresh(); }
    };
    // rewards grouped by level
    const byLv = new Map();
    for (const r of allRewards()) { if (!byLv.has(r.lvl)) byLv.set(r.lvl, []); byLv.get(r.lvl).push(r); }
    const list = [...byLv].map(([l, rs]) => h('div', { class: `pf-lv${l <= lv ? ' got' : ''}${next && next.lvl === l ? ' next' : ''}` },
      h('span', { class: 'pf-lvn' }, h('b', { text: l }), h('span', { text: 'ур.' })),
      h('div', { class: 'pf-rws' }, ...rs.map((r) => h('button', { class: `pf-rw${l <= lv ? '' : ' locked'}`, nav: `r${l}`, key: r.id + r.kind, act: pickFor(r) },
        rewardIcon(r, 44), h('span', { class: 'rw-txt' }, h('b', { text: r.kind === 'title' ? `«${r.name}»` : r.name }), h('span', { text: r.label })),
        l <= lv ? null : h('span', { class: 'fr-lock' }, I.lock(14)))))));
    const big = avatarPreview(frameFor(), 112);
    if (b.prestige) big.append(h('span', { class: 'av-stars', text: stars(b.prestige) }));
    const scroll = h('div', { class: 'sheet-scroll', 'data-scroll': 'y' },
      h('div', { class: 'pf-head' }, big,
        h('div', { class: 'pf-who' },
          t ? h('span', { class: 'eyebrow', text: t.name }) : null,
          h('h1', { text: name }),
          h('div', { class: 'pf-lvline' },
            h('span', { class: 'lvl-pill', text: `LV ${b.level}` }),
            b.prestige ? h('span', { class: 'prestige', text: `${stars(b.prestige)} престиж ${b.prestige}` }) : null,
            h('span', { class: 'ach-bar' }, h('span', { style: `width:${(b.into / b.need) * 100}%` })),
            h('span', { class: 'bro-sub', text: `${b.into} / ${b.need} XP` })))),
      h('div', { class: 'acts pf-acts' },
        h('button', { class: 'btn primary', nav: 'pa', key: 'bro', act: openBro }, 'Game Bro'),
        h('button', { class: 'btn', nav: 'pa', key: 'look', act: () => openSettingsAt('frame') }, 'Оформление'),
        b.canPrestige ? h('button', { class: 'btn gold', nav: 'pa', key: 'prestige', act: doPrestige }, 'Престиж ★') : null),
      h('div', { class: 'pf-stats' },
        stat(`${b.xp.toLocaleString('ru-RU')}`, 'опыта всего'),
        stat(`${b.done}`, plural(b.done, 'челлендж выполнен', 'челленджа выполнено', 'челленджей выполнено')),
        stat(fmtTime(total) === 'не запускалась' ? '0 ч' : fmtTime(total), 'в играх всего'),
        stat(`${ach}`, plural(ach, 'достижение', 'достижения', 'достижений')),
        stat(`${games.filter((g) => g.installed || g.source === 'custom').length}`, 'игр установлено'),
        stat(fav && gameMinutes(fav) ? fav.name : '—', 'любимая игра')),
      h('div', { class: 'group-label', text: next ? `Награды · следующая на ${next.lvl} уровне` : 'Награды · всё открыто' }),
      h('div', { class: 'pf-list' }, ...list));
    root.replaceChildren(h('div', { class: 'scrim' }), h('div', { class: 'sheet profile-sheet', role: 'dialog' }, scroll));
    restore();
    if (keep) { const el = root.querySelector(`[data-key="${keep}"]`); if (el) focus(el, { scroll: false }); }
  };
  layer.focusFirst = () => focus(root.querySelector('[data-key="bro"]'));
  layer.refresh();
  pushLayer(layer);
}
function doPrestige() {
  confirmBox('Престиж', 'Уровень начнётся заново с первого, а рядом с ником появится звезда. Все открытые награды и бонусы Game Bro останутся.', 'Начать заново', async () => {
    const r = await api.broPrestige();
    if (r.error) return toast(r.error, 'warn');
    S.bro = r.state;
    sound('launch'); setTimeout(() => sound('reward'), 400);
    toast(`Престиж ${r.prestige}! Новый путь к 50 уровню начался`);
    refreshAll();
  });
}
// settings opened straight at one row (from the profile card)
function openSettingsAt(key) {
  openSettings();
  requestAnimationFrame(() => {
    const top = topLayer();
    const el = top && top.el.querySelector(`[data-key="${key}"]`);
    if (el) focus(el);
  });
}
// levels gained outside a challenge (e.g. the softer XP curve in 1.7.5): show what they unlocked once
function catchUpRewards() {
  if (!S.bro) return;
  const now = unlockLv();
  let seen = null;
  try { seen = parseInt(localStorage.getItem('lvlSeen'), 10) || null; } catch { /* ignore */ }
  if (seen == null) {
    // first run of 1.7.5: the level this XP gave under the old curve
    seen = 1;
    let left = S.bro.xp;
    while (left >= Math.round(100 * Math.pow(seen, 1.4))) { left -= Math.round(100 * Math.pow(seen, 1.4)); seen++; }
  }
  try { localStorage.setItem('lvlSeen', String(now)); } catch { /* ignore */ }
  const got = now > seen ? rewardsBetween(seen, now) : [];
  if (!got.length) return;
  const box = h('div', { class: 'menu bro-pop lvup rewards', role: 'dialog' },
    h('div', { class: 'bro-pop-face' }, broFace(84, 'happy')),
    h('span', { class: 'eyebrow', text: 'Опыт пересчитан' }),
    h('h2', { text: `Уровень ${levelNow()}!` }),
    h('p', { text: 'Уровни теперь набираются быстрее, и твой опыт уже тянет на новый уровень. Вот что открылось:' }),
    h('div', { class: 'rw-new' }, h('div', { class: 'rw-list' }, ...got.slice(0, 8).map((r, k) => { const el = rewardChip(r); el.style.setProperty('--i', k); return el; }))),
    got.length > 8 ? h('p', { text: `и ещё ${got.length - 8}` }) : null,
    h('div', { class: 'sl-actions' },
      h('button', { class: 'btn primary', nav: 'bp', act: () => popLayer(layer) }, 'Круто!'),
      h('button', { class: 'btn', nav: 'bp', act: () => { popLayer(layer); openProfile(); } }, 'Все награды')));
  const layer = { el: h('div', {}, h('div', { class: 'scrim' }), box), kind: 'bropop', hints: [['A', 'Закрыть']] };
  pushLayer(layer);
  sound('launch'); setTimeout(() => sound('reward'), 500);
}
// a challenge finished: celebrate, and make a bigger deal of a new level
function broCelebrate(ev) {
  const c = ev.challenge;
  const lv = ev.levelUp;
  const got = lv && ev.to > (ev.from || 0) ? rewardsBetween(ev.from || 0, ev.to) : [];
  const box = h('div', { class: `menu bro-pop${lv ? ' lvup' : ''}${got.length ? ' rewards' : ''}`, role: 'dialog' },
    h('div', { class: 'bro-pop-face' }, broFace(84, 'happy')),
    h('span', { class: 'eyebrow', text: lv ? 'Новый уровень' : c.kind === 'week' ? 'Челлендж недели выполнен' : 'Челлендж выполнен' }),
    h('h2', { text: lv ? `Уровень ${lv}!` : BRO_PRAISE[Math.floor(Math.random() * BRO_PRAISE.length)] }),
    h('p', { text: lv ? `Ты апнулся до ${lv} уровня! За «${broText(c)}» +${c.xp} XP` : `${broText(c)} — +${c.xp} XP` }),
    got.length ? h('div', { class: 'rw-new' }, h('span', { class: 'eyebrow', text: got.length > 1 ? 'Новые награды' : 'Новая награда' }),
      h('div', { class: 'rw-list' }, ...got.map((r, k) => { const el = rewardChip(r); el.style.setProperty('--i', k); return el; }))) : null,
    got.length ? null : h('div', { class: 'bro-pop-xp', text: `+${c.xp} XP` }),
    h('div', { class: 'sl-actions' },
      h('button', { class: 'btn primary', nav: 'bp', act: () => popLayer(layer) }, lv ? 'Круто!' : 'Отлично'),
      got.length ? h('button', { class: 'btn', nav: 'bp', act: () => { popLayer(layer); openProfile(); } }, 'Все награды') : null));
  const layer = { el: h('div', {}, h('div', { class: 'scrim' }), box), kind: 'bropop', hints: [['A', 'Закрыть']] };
  pushLayer(layer);
  if (lv) { sound('launch'); setTimeout(() => sound('done'), 450); if (got.length) setTimeout(() => sound('reward'), 900); } else sound('done');
}
api.onBro((d) => {
  if (d.state) S.bro = d.state;
  try { localStorage.setItem('lvlSeen', String(unlockLv())); } catch { /* ignore */ }
  renderLevel();
  const xpBar = $('#profile');
  xpBar.classList.remove('xp-gain'); void xpBar.offsetWidth; xpBar.classList.add('xp-gain');
  let delay = 400;
  for (const ev of d.events || []) { setTimeout(() => broCelebrate(ev), delay); delay += 300; }
  refreshAll();
});

// =====================================================================
// updates
// =====================================================================
S.update = null;
function stripMd(t) {
  return String(t || '').replace(/\r\n?/g, '\n')
    .split('\n').filter((l) => !/full changelog/i.test(l)).join('\n')
    .replace(/\*\*|__|`/g, '').replace(/^#+[ \t]*/gm, '').replace(/^[ \t]*[-*][ \t]+/gm, '• ')
    .replace(/\n{3,}/g, '\n\n').trim();
}
function openUpdate() {
  const u = S.update;
  if (!u) return;
  const bar = h('div', { class: 'upd-bar' }, h('div', {}));
  const status = h('div', { class: 'upd-status', text: `${fmtBytes(u.size || 0)} · установится и перезапустится само` });
  const go = h('button', { class: 'btn primary', nav: 'ub', key: 'go', act: async () => {
    if (u.busy) return;
    u.busy = true;
    box.classList.add('dl');
    go.textContent = 'Загрузка…';
    const r = await api.updateDownload();
    if (!r.ok) { u.busy = false; box.classList.remove('dl'); go.textContent = 'Повторить'; status.textContent = r.error; return; }
    status.textContent = 'Устанавливаю… Lobby перезапустится через пару секунд';
    go.textContent = 'Установка…';
    await api.updateInstall();
  } }, 'Обновить сейчас');
  const box = h('div', { class: 'menu upd', role: 'dialog' },
    h('span', { class: 'eyebrow', text: 'Доступно обновление' }),
    h('h2', { text: `Lobby ${u.version}` }),
    h('div', { class: 'upd-notes', 'data-scroll': 'y', text: stripMd(u.notes) || 'Исправления и улучшения.' }),
    bar, status,
    h('div', { class: 'sl-actions' }, go, h('button', { class: 'btn', nav: 'ub', act: () => popLayer(layer) }, 'Позже')));
  const layer = { el: h('div', {}, h('div', { class: 'scrim' }), box), kind: 'update', hints: [['A', 'Выбрать'], ['B', 'Позже']] };
  layer.onUpdate = (d) => {
    if (d.state === 'downloading') { bar.firstChild.style.width = `${d.total ? (d.got / d.total) * 100 : 0}%`; status.textContent = `${fmtBytes(d.got)} из ${fmtBytes(d.total)}`; }
  };
  layer.focusFirst = () => focus(go);
  pushLayer(layer);
}
// controller battery next to the gamepad icon; XInput only knows 4 steps, so we draw bars, not a fake percentage
const BAT_TEXT = ['разряжен', 'низкий заряд', 'средний заряд', 'полный заряд'];
let batWarned = false;
function renderBattery(list) {
  const el = $('#pad-bat');
  const b = (list || [])[0];
  if (!b || !padConnected) { el.hidden = true; return; }
  el.hidden = false;
  el.className = `pad-bat lvl${b.level}${b.wired ? ' wired' : ''}`;
  el.title = b.wired ? 'Геймпад: по проводу' : `Геймпад: ${BAT_TEXT[b.level]}`;
  if (b.wired) {
    el.replaceChildren(icon(['M9 2v6', 'M15 2v6', 'M6 8h12v4a6 6 0 0 1-12 0z', 'M12 18v4'], { size: 18 }));
    return;
  }
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('width', '30'); svg.setAttribute('height', '16'); svg.setAttribute('viewBox', '0 0 30 16'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `<rect x="1" y="1" width="25" height="14" rx="3.5" fill="none" stroke="currentColor" stroke-width="2"/><rect x="27" y="5" width="2.5" height="6" rx="1" fill="currentColor"/>`
    + [0, 1, 2].map((k) => `<rect x="${4 + k * 7.2}" y="4" width="5.6" height="8" rx="1.2" fill="currentColor" opacity="${k < Math.max(1, b.level) ? 1 : 0.18}"/>`).join('');
  el.replaceChildren(svg);
  if (b.level <= 1 && !batWarned) { batWarned = true; toast(b.level === 0 ? 'Геймпад почти разряжен' : 'У геймпада низкий заряд', 'warn'); }
  if (b.level >= 2) batWarned = false;
}
let lastBattery = [];
api.onPadBattery((b) => { lastBattery = b; renderBattery(b); });

let winSoundAt = 0;
api.onWinState((k) => {
  if (performance.now() - winSoundAt < 350) return; // restore + show can arrive together
  winSoundAt = performance.now();
  sound(k === 'minimize' ? 'minimize' : 'restore');
});

api.onUpdate((d) => {
  if (d.state === 'available') {
    const isNew = !S.update || S.update.version !== d.version;
    S.update = { ...d };
    if (isNew) toast(`Доступна версия ${d.version} — обновить можно в настройках (≡)`);
    for (const l of layers) if (l.kind === 'settings') l.refresh();
  }
  for (const l of layers) if (l.onUpdate) l.onUpdate(d);
});
async function checkUpdates() {
  toast('Проверяю обновления…');
  const r = await api.updateCheck();
  if (r.error) return toast(r.error, 'warn');
  if (r.available) { S.update = { ...r }; openUpdate(); } else toast(`У тебя последняя версия — ${r.current}`);
}

// generic menu & confirm
function menuBox(title, text, items) {
  const box = h('div', { class: 'menu', role: 'dialog' }, h('h2', { text: title }), text ? h('p', { text }) : null);
  const layer = { el: h('div', {}, h('div', { class: 'scrim' }), box), kind: 'menu', hints: [['A', 'Выбрать'], ['B', 'Закрыть']] };
  items.forEach(([label, fn, cls], i) => box.append(h('button', {
    class: `srow ${cls || ''}`, nav: true, 'data-default': i === 0 ? '' : null,
    act: () => { popLayer(layer); fn(); },
  }, h('span', { class: 'l' }, h('b', { text: label })))));
  pushLayer(layer);
}
// value picker: left/right (stick, d-pad, arrows, mouse drag) moves, A confirms, B cancels
function sliderBox({ title, note, values, value, fmt, mark = null, onInput }) {
  return new Promise((resolve) => {
    let i = Math.max(0, values.indexOf(value));
    if (values.indexOf(value) < 0) i = values.reduce((b, v, k) => (Math.abs(v - value) < Math.abs(values[b] - value) ? k : b), 0);
    const big = h('div', { class: 'sl-value' });
    const fill = h('div', { class: 'sl-fill' });
    const thumb = h('div', { class: 'sl-thumb' });
    const ticks = h('div', { class: 'sl-ticks' }, ...values.map((v, k) => h('span', { class: `sl-tick${v === mark ? ' mark' : ''}`, style: `left:${(k / (values.length - 1)) * 100}%` })));
    const track = h('div', { class: 'sl-track' }, ticks, fill, thumb);
    const minus = h('button', { class: 'sl-step', nav: 'sl', 'aria-label': 'Меньше', 'data-sfx': 'none', act: () => step(-1) }, '−');
    const plus = h('button', { class: 'sl-step', nav: 'sl', 'aria-label': 'Больше', 'data-sfx': 'none', act: () => step(1) }, '+');
    const box = h('div', { class: 'menu slider', role: 'dialog' },
      h('h2', { text: title }), note ? h('p', { text: note }) : null,
      big,
      h('div', { class: 'sl-row' }, minus, track, plus),
      h('div', { class: 'sl-ends' }, h('span', { text: fmt(values[0]) }), h('span', { text: fmt(values[values.length - 1]) })),
      h('div', { class: 'sl-actions' },
        h('button', { class: 'btn primary', nav: 'slb', key: 'ok', act: () => finish(values[i]) }, 'Готово'),
        h('button', { class: 'btn', nav: 'slb', key: 'cancel', act: () => finish(null) }, 'Отмена')));
    const layer = { el: h('div', {}, h('div', { class: 'scrim' }), box), kind: 'slider', hints: [['A', 'Готово'], ['B', 'Отмена']] };
    let done = false;
    const finish = (v) => { if (done) return; done = true; popLayer(layer); resolve(v); };
    const draw = () => {
      const pct = (i / (values.length - 1)) * 100;
      fill.style.width = `${pct}%`;
      thumb.style.left = `${pct}%`;
      big.textContent = fmt(values[i]);
    };
    const set = (k) => {
      k = Math.max(0, Math.min(values.length - 1, k));
      if (k === i) { sound('bump'); return; }
      i = k; draw();
      if (onInput) onInput(values[i]); else sound('move');
      big.classList.remove('bump'); void big.offsetWidth; big.classList.add('bump');
    };
    const step = (d) => set(i + d);
    layer.onBack = () => finish(null);
    layer.handle = (btn) => {
      if (btn === 'left' || btn === 'right') { hideCursor(); step(btn === 'right' ? 1 : -1); return true; }
      return false;
    };
    layer.focusFirst = () => focus(box.querySelector('[data-key="ok"]'));
    const fromPointer = (e) => {
      const r = track.getBoundingClientRect();
      set(Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * (values.length - 1)));
    };
    track.addEventListener('pointerdown', (e) => { track.setPointerCapture(e.pointerId); fromPointer(e); });
    track.addEventListener('pointermove', (e) => { if (e.buttons & 1) fromPointer(e); });
    box.addEventListener('wheel', (e) => { e.preventDefault(); step(e.deltaY < 0 ? 1 : -1); }, { passive: false });
    draw();
    pushLayer(layer);
  });
}
function confirmBox(title, text, okLabel, fn) {
  menuBox(title, text, [[okLabel, fn], ['Отмена', () => {}]]);
}

// =====================================================================
// on-screen keyboard
// =====================================================================
const KB = {
  ru: ['йцукенгшщзхъ', 'фывапролджэ', 'ячсмитьбю'],
  en: ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'],
  digits: '1234567890-_',
  sym: '.,:/\\!?\'&@()',
};
let kbLang = 'ru';

function osk({ title, value = '', results = null }) {
  return new Promise((resolve) => {
    let caps = false;
    const input = h('input', { type: 'text', spellcheck: 'false', value: value || '' });
    const resBox = results ? h('div', { class: 'osk-results', 'data-scroll': 'x' }) : null;
    const keys = h('div', { class: 'keys' });
    const panel = h('div', { class: 'osk' }, h('h2', { text: title }), input, resBox, keys);
    const layer = { el: h('div', {}, h('div', { class: 'scrim' }), panel), kind: 'osk' };
    let done = false;
    const finish = (v) => { if (done) return; done = true; popLayer(layer); resolve(v); };
    layer.submit = () => finish(input.value);
    layer.onBack = () => finish(null);
    layer.hints = [['A', 'Ввод'], ['X', 'Стереть'], ['Y', 'Пробел'], ['VIEW', 'RU / EN'], ['MENU', 'Готово'], ['B', 'Отмена']];
    const insert = (txt) => {
      const s = input.selectionStart ?? input.value.length, e = input.selectionEnd ?? s;
      input.value = input.value.slice(0, s) + txt + input.value.slice(e);
      input.selectionStart = input.selectionEnd = s + txt.length;
      input.dispatchEvent(new Event('input'));
    };
    const backspace = () => {
      const s = input.selectionStart ?? input.value.length, e = input.selectionEnd ?? s;
      if (s !== e) input.value = input.value.slice(0, s) + input.value.slice(e);
      else if (s > 0) { input.value = input.value.slice(0, s - 1) + input.value.slice(s); input.selectionStart = input.selectionEnd = s - 1; }
      input.dispatchEvent(new Event('input'));
    };
    const build = () => {
      const keep = S.focused && keys.contains(S.focused) ? [...keys.querySelectorAll('.key')].indexOf(S.focused) : -1;
      const row = (chars, r) => h('div', { class: 'krow' }, ...[...chars].map((c) => {
        const ch = caps ? c.toUpperCase() : c;
        return h('button', { class: 'key', nav: `k${r}`, 'data-sfx': 'key', text: ch, act: () => insert(ch) });
      }));
      keys.replaceChildren(
        row(KB.digits, 0),
        ...KB[kbLang].map((r, i) => row(r, i + 1)),
        row(KB.sym, 4),
        h('div', { class: 'krow' },
          h('button', { class: 'key wide', nav: 'k5', text: caps ? '⇧ ABC' : '⇧ abc', act: () => { caps = !caps; build(); } }),
          h('button', { class: 'key wide', nav: 'k5', text: kbLang === 'ru' ? 'RU → EN' : 'EN → RU', act: () => { kbLang = kbLang === 'ru' ? 'en' : 'ru'; build(); } }),
          h('button', { class: 'key space', nav: 'k5', text: 'Пробел', act: () => insert(' ') }),
          h('button', { class: 'key wide', nav: 'k5', text: '⌫ Стереть', act: backspace }),
          h('button', { class: 'key wide go', nav: 'k5', key: 'go', text: 'Готово', act: () => finish(input.value) })),
      );
      if (keep >= 0) { const all = keys.querySelectorAll('.key'); focus(all[Math.min(keep, all.length - 1)], { scroll: false }); }
    };
    layer.handle = (btn) => {
      if (btn === 'X') { backspace(); return true; }
      if (btn === 'Y') { insert(' '); return true; }
      if (btn === 'VIEW') { kbLang = kbLang === 'ru' ? 'en' : 'ru'; build(); return true; }
      if (btn === 'MENU') { finish(input.value); return true; }
      return false;
    };
    layer.focusFirst = () => {
      const first = keys.querySelector('[data-row="k1"]');
      focus(first);
      input.focus();
      input.selectionStart = input.selectionEnd = input.value.length;
    };
    if (results) {
      const update = () => results(input.value, resBox, (v) => finish(v));
      input.addEventListener('input', update);
      update();
    }
    // keep typing focus in the field while the pad moves over the keys
    panel.addEventListener('mousedown', (e) => { if (e.target !== input) e.preventDefault(); });
    build();
    pushLayer(layer);
  });
}

function openSearch() {
  let picked = null;
  osk({
    title: 'Поиск по библиотеке',
    results: (q, box, close) => {
      const s = q.trim().toLowerCase();
      const list = s ? S.games.filter((g) => g.name.toLowerCase().includes(s)).sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, 14) : recentGames().slice(0, 10);
      box.replaceChildren(...(list.length ? list.map((g) => {
        const t = gameTile(g, 'cover', 'res');
        t._act = () => { picked = g.id; close(null); };
        t._alt = null;
        return t;
      }) : [h('span', { class: 'none', text: s ? 'Ничего не найдено' : 'Начни вводить название' })]));
      box.scrollLeft = 0;
    },
  }).then(() => { if (picked) openGame(picked); });
}

// =====================================================================
// settings
// =====================================================================
// a sheet rebuilt in place keeps its scroll position (set instantly, not with the smooth scroll)
function keepScroll(root) {
  const old = root.querySelector('.sheet-scroll');
  const top = old ? old.scrollTop : 0;
  return () => { const n = root.querySelector('.sheet-scroll'); if (n && top) n.scrollTo({ top, behavior: 'instant' }); };
}
function openSettings() {
  const root = h('div', {});
  const layer = { el: root, kind: 'settings', hints: [['A', 'Изменить'], ['B', 'Закрыть']] };
  const set = async (patch, resync) => {
    S.settings = await api.setSettings(patch);
    applyCosmetics();
    layer.refresh();
    if (resync) doSync();
  };
  layer.refresh = () => {
    const st = S.settings;
    const keep = S.focused && root.contains(S.focused) ? S.focused.dataset.key : null;
    const restore = keepScroll(root);
    const row = (key, label, sub, value, act) => h('button', { class: 'srow', nav: true, key, act },
      h('span', { class: 'l' }, h('b', { text: label }), sub ? h('span', { text: sub }) : null),
      value && value.nodeType ? value : h('span', { class: 'v', text: value || '' }));
    const tog = (on) => h('span', { class: `toggle${on ? ' on' : ''}` });
    const masked = st.steamKey ? `••••••••${st.steamKey.slice(-4)}` : 'не задан';
    const ai = accentInfo(st.accent || ACCENTS[0]);
    const sw = h('span', { class: 'swatches' }, h('span', { class: 'v', text: ai.name }), h('span', { class: 'swatch sel', style: `background:${ai.grad || ai.base}` }));
    const scroll = h('div', { class: 'sheet-scroll', 'data-scroll': 'y' },
      h('div', { class: 'group-label', text: 'Steam' }),
      row('sync', 'Синхронизировать сейчас', S.lastSync ? `Последняя: ${new Date(S.lastSync).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Ещё не выполнялась', S.syncing ? 'идёт…' : '', doSync),
      row('key', 'Ключ Steam Web API', 'Нужен, чтобы видеть и неустановленные игры', masked, async () => {
        const v = await osk({ title: 'Ключ Steam Web API (можно вставить Ctrl+V)', value: st.steamKey });
        if (v != null) set({ steamKey: v.trim() }, true);
      }),
      row('id', 'Аккаунт Steam', 'SteamID64, ссылка на профиль или пусто — определю сам', st.steamId || (S.profile && S.profile.steamId ? `авто: ${S.profile.personaName}` : 'авто'), async () => {
        const v = await osk({ title: 'SteamID64 или ссылка на профиль (пусто — авто)', value: st.steamId });
        if (v != null) set({ steamId: v.trim() }, true);
      }),
      row('path', 'Папка Steam', 'Пусто — найду через реестр', st.steamPath || 'авто', async () => {
        const v = await osk({ title: 'Путь к папке Steam, например C:\\Program Files (x86)\\Steam', value: st.steamPath });
        if (v != null) set({ steamPath: v.trim() }, true);
      }),
      h('div', { class: 'group-label', text: 'Epic Games' }),
      S.epic.account
        ? row('epic', 'Аккаунт Epic', 'Вся библиотека и время в играх', S.epic.account, () => menuBox(`Аккаунт ${S.epic.account}`, null, [
          ['Синхронизировать', doSync],
          ['Выйти из аккаунта', async () => { applyLibrary(await api.epicLogout()); refreshAll(); toast('Вышел из аккаунта Epic'); }],
          ['Отмена', () => {}],
        ]))
        : row('epic', 'Войти в Epic', 'Откроется официальная страница входа Epic', 'не выполнен', epicLoginFlow),
      S.epic.account ? null : row('epiccode', 'Вход по коду', 'Если окно входа не работает', '', epicCodeFlow),
      h('div', { class: 'group-label', text: 'Обложки' }),
      row('sgdb', 'Ключ SteamGridDB', 'Для выбора обложек и фонов из каталога', st.sgdbKey ? `••••••••${st.sgdbKey.slice(-4)}` : 'не задан', async () => {
        const v = await osk({ title: 'Ключ SteamGridDB (steamgriddb.com → Preferences → API), можно Ctrl+V', value: st.sgdbKey });
        if (v != null) set({ sgdbKey: v.trim() });
      }),
      h('div', { class: 'group-label', text: 'Профиль' }),
      row('frame', 'Рамка аватара', 'Открываются с уровнем Game Bro', h('span', { class: 'v', text: (FRAMES.find((f) => f.id === frameFor()) || FRAMES[0]).name + ((st.avatarFrame || 'auto') === 'auto' ? ' · авто' : '') }), async () => {
        const v = await frameBox();
        if (v) { await set({ avatarFrame: v }); renderLevel(); sound('toggle'); }
      }),
      row('badge', 'Значок аватара', 'Вместо аватара Steam', BADGES.find((x) => x.id === chosen(BADGES, 'avatarIcon', 'auto')).name, async () => {
        const v = await badgeBox();
        if (v) { await set({ avatarIcon: v }); renderLevel(); sound('toggle'); }
      }),
      row('title', 'Титул', 'Подпись под ником', st.title === 'none' ? 'без титула' : titleFor().name + ((st.title || 'auto') === 'auto' ? ' · авто' : ''), async () => {
        const v = await titleBoxPick();
        if (v) { await set({ title: v }); renderLevel(); sound('toggle'); }
      }),
      h('div', { class: 'group-label', text: 'Интерфейс' }),
      row('accent', 'Цвет акцента', 'Кнопки, рамка выбора, свечение', sw, async () => {
        const c = await colorBox(st.accent || ACCENTS[0]);
        if (c && c.toLowerCase() !== (st.accent || '').toLowerCase()) await set({ accent: c });
        else applyAccent();
      }),
      row('scale', 'Размер интерфейса', 'Ctrl + / Ctrl − на клавиатуре', `${st.uiScale || 100}%`, async () => {
        const v = await sliderBox({
          title: 'Размер интерфейса', note: 'Применится после «Готово»',
          values: UI_SCALES, value: st.uiScale || 100, fmt: (x) => `${x}%`, mark: 100,
        });
        if (v != null && v !== (st.uiScale || 100)) setScale(v);
      }),
      row('vol', 'Звуки интерфейса', 'Громкость щелчков и сигналов', (st.sfxVolume ?? 50) ? `${st.sfxVolume ?? 50}%` : 'выкл', async () => {
        const before = st.sfxVolume ?? 50;
        const v = await sliderBox({
          title: 'Звуки интерфейса', note: 'Слышно сразу, пока двигаешь',
          values: Array.from({ length: 21 }, (_, i) => i * 5), value: before, fmt: (x) => (x ? `${x}%` : 'Выкл'),
          onInput: (x) => { S.settings.sfxVolume = x; sound('move'); },
        });
        S.settings.sfxVolume = before;
        if (v != null && v !== before) { await set({ sfxVolume: v }); sound('toggle'); }
      }),
      row('sfxpack', 'Набор звуков', 'Новые открываются с уровнем', SFX_PACKS.find((x) => x.id === chosen(SFX_PACKS, 'sfxPack', 'classic')).name, async () => {
        const v = await sfxBox();
        if (v) { await set({ sfxPack: v }); sound('toggle'); }
      }),
      row('ambient', 'Живой фон', 'Туман, частицы или сияние за интерфейсом', AMBIENTS.find((x) => x.id === chosen(AMBIENTS, 'ambient', 'none')).name, async () => {
        const v = await ambientBox();
        if (v) { await set({ ambient: v }); sound('toggle'); }
      }),
      row('focusfx', 'Эффект выбора', 'Как подсвечивается выбранная игра', FOCUS_FX.find((x) => x.id === chosen(FOCUS_FX, 'focusFx', 'glow')).name, async () => {
        const v = await focusBox();
        if (v) { await set({ focusFx: v }); sound('toggle'); }
      }),
      row('launchfx', 'Анимация запуска игры', unlockLv() >= LAUNCH_FX_LVL ? 'Обложка раскрывается на весь экран' : `Откроется на ${LAUNCH_FX_LVL} уровне`,
        unlockLv() >= LAUNCH_FX_LVL ? tog(st.launchFx) : h('span', { class: 'v' }, I.lock(16)),
        () => (unlockLv() >= LAUNCH_FX_LVL ? set({ launchFx: !st.launchFx }) : (sound('bump'), toast(`Анимация запуска откроется на ${LAUNCH_FX_LVL} уровне`)))),
      row('full', 'Полноэкранный режим', 'Можно переключать клавишей F11', tog(st.fullscreen), () => set({ fullscreen: !st.fullscreen })),
      row('min', 'Сворачивать при запуске игры', 'Lobby вернётся, когда игра закроется', tog(st.minimizeOnLaunch), () => set({ minimizeOnLaunch: !st.minimizeOnLaunch })),
      row('auto', 'Запускать вместе с Windows', 'Стартует в фоне, без окна', tog(st.autostart), () => set({ autostart: !st.autostart })),
      row('guide', 'Кнопка Xbox открывает Lobby', 'Отключи в Windows: Параметры → Игры → Xbox Game Bar → кнопка контроллера', tog(st.guideButton), () => set({ guideButton: !st.guideButton })),
      row('bg', 'Работать в фоне', 'Закрытие окна убирает Lobby в трей, а не выключает', tog(st.background), () => set({ background: !st.background })),
      h('div', { class: 'group-label', text: 'Телефон' }),
      row('remote', 'Доступ с телефона', st.remote && S.remote && S.remote.running ? `Lobby Companion · ${(S.remote.ips[0] || 'нет сети')}:${S.remote.port}` : 'Управляй Lobby с телефона через приложение Lobby Companion',
        tog(st.remote), async () => { await set({ remote: !st.remote }); setTimeout(refreshRemote, 400); }),
      row('pair', 'Подключить телефон', 'Покажет QR-код для Lobby Companion', '', openPair),
      ...((S.remote && S.remote.devices) || []).map((d) => row(`dev-${d.id}`, d.name, `подключён ${fmtDate(d.added)}${d.seen ? ` · на связи ${fmtAgo(d.seen)}` : ''}`, h('span', { class: 'v', text: 'Отключить' }),
        () => confirmBox('Отключить телефон?', `«${d.name}» больше не сможет управлять Lobby. Подключить снова можно по QR-коду.`, 'Отключить', async () => { S.remote = await api.remoteRemove(d.id); layer.refresh(); }))),
      h('div', { class: 'group-label', text: 'Игры' }),
      row('add', 'Добавить свою игру', '.exe, ярлык .lnk или .url', '', () => { popLayer(layer); addGame(); }),
      h('div', { class: 'group-label', text: 'Приложение' }),
      S.update ? row('upd', `Обновить до ${S.update.version}`, 'Скачается и установится само', h('span', { class: 'upd-dot', text: 'Новое' }), openUpdate) : null,
      row('ver', `Версия ${S.version || ''}`, 'Проверить обновления', '', checkUpdates),
      row('autoupd', 'Проверять обновления', 'При запуске и раз в несколько часов', tog(st.autoUpdate), () => set({ autoUpdate: !st.autoUpdate })),
      row('minw', 'Свернуть Lobby', null, '', () => api.minimize()),
      row('quit', 'Выйти из Lobby', null, '', () => api.quit()),
    );
    root.replaceChildren(h('div', { class: 'scrim' }), h('div', { class: 'sheet', role: 'dialog' }, h('h1', { text: 'Настройки' }), scroll));
    restore();
    if (keep) { const el = root.querySelector(`[data-key="${keep}"]`); if (el) focus(el, { scroll: false }); }
  };
  layer.refresh();
  pushLayer(layer);
  refreshRemote();
}
async function refreshRemote() {
  S.remote = await api.remoteStatus();
  for (const l of layers) if (l.kind === 'settings') l.refresh();
}
// pairing a phone: QR code with the PC's addresses and a one-time code
async function openPair() {
  const info = await api.remotePair();
  if (!info || info.error) { toast((info && info.error) || 'Не получилось включить доступ с телефона', 'warn'); return; }
  S.settings.remote = true;
  const qr = h('div', { class: 'pair-qr' });
  qr.innerHTML = info.svg; // generated locally by qrcode-generator from our own link
  const left = h('span', { class: 'pair-left' });
  const box = h('div', { class: 'menu pair', role: 'dialog' },
    h('span', { class: 'eyebrow', text: 'Lobby Companion' }),
    h('h2', { text: 'Подключить телефон' }),
    h('div', { class: 'pair-body' }, qr,
      h('div', { class: 'pair-info' },
        h('p', { text: 'Открой Lobby Companion на телефоне, нажми «Подключить» и наведи камеру на код.' }),
        h('div', { class: 'pair-code' }, ...info.code.split('').map((c) => h('b', { text: c }))),
        h('p', { class: 'pair-manual', text: `Без камеры: адрес ${info.ips[0] || '—'}:${info.port}, код выше.` }),
        h('p', { class: 'pair-manual', text: 'Телефон и ПК должны быть в одной сети Wi-Fi. Если Windows спросит про брандмауэр, разреши доступ в частных сетях.' }),
        left)),
    h('div', { class: 'sl-actions' }, h('button', { class: 'btn', nav: 'pr', act: () => close() }, 'Закрыть')));
  const layer = { el: h('div', {}, h('div', { class: 'scrim' }), box), kind: 'pair', hints: [['B', 'Закрыть']] };
  const tick = () => {
    const s = Math.max(0, Math.round((info.until - Date.now()) / 1000));
    left.textContent = s ? `Код действует ещё ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : 'Код устарел — открой подключение заново';
    if (!s) { clearInterval(timer); box.classList.add('expired'); }
  };
  const timer = setInterval(tick, 1000);
  tick();
  let closed = false;
  const close = (paired) => {
    if (closed) return;
    closed = true;
    clearInterval(timer);
    if (!paired) api.remoteCancel();
    popLayer(layer);
    refreshRemote();
  };
  layer.onBack = () => close();
  layer.onPaired = (d) => { close(true); sound('done'); toast(`Телефон «${d.name}» подключён`); };
  pushLayer(layer);
}
api.onRemotePaired((d) => {
  const l = layers.find((x) => x.kind === 'pair');
  if (l) l.onPaired(d); else { toast(`Телефон «${d.name}» подключён`); refreshRemote(); }
});
api.onRemoteError((d) => toast(`Доступ с телефона не включился: ${d.error}`, 'warn'));
async function setScale(v) {
  if (!UI_SCALES.includes(v)) return;
  const stage = $('#stage');
  stage.classList.add('rescale');
  await new Promise((r) => setTimeout(r, 180));
  S.settings = await api.setSettings({ uiScale: v });
  fit();
  refitAll();
  for (const l of layers) if (l.kind === 'settings') l.refresh();
  requestAnimationFrame(() => {
    const top = topLayer();
    const row = top && top.kind === 'settings' ? top.el.querySelector('[data-key="scale"]') : null;
    if (row) focus(row, { scroll: false });
    if (S.focused) reveal(S.focused, false);
    stage.classList.remove('rescale');
  });
}
// accent picker: the whole interface previews the colour under the cursor; A keeps it, B goes back
function colorBox(current) {
  return new Promise((resolve) => {
    const cols = 8;
    const name = h('div', { class: 'cp-name' });
    const grid = h('div', { class: 'cp-grid' });
    let done = false;
    let pick = current;
    const show = (c) => {
      const a = accentInfo(c);
      applyAccent(c);
      name.textContent = a.special && !isOpen(a.special) ? `${a.name} · с ${a.special.lvl} уровня` : a.name;
      name.style.color = a.base;
    };
    ACCENT_LIST.forEach(([c, n], k) => {
      grid.append(h('button', {
        class: `cp-sw${c.toLowerCase() === String(current).toLowerCase() ? ' cur' : ''}`, nav: `c${Math.floor(k / cols)}`, key: c,
        'aria-label': n, style: `--c:${c}`, onfocus: () => { if (!done) { pick = c; show(c); } }, act: () => finish(c),
      }));
    });
    // special accents: try them on any time, keep them once unlocked
    const special = h('div', { class: 'cp-special' }, ...SPECIAL_ACCENTS.map((a) => h('button', {
      class: `cp-sw grad${a.id === current ? ' cur' : ''}${isOpen(a) ? '' : ' locked'}`, nav: 'cs', key: a.id, 'aria-label': a.name,
      style: `--c:${a.grad};--cc:${a.base}`,
      onfocus: () => { if (!done) { pick = isOpen(a) ? a.id : current; show(a.id); } },
      act: () => { if (isOpen(a)) finish(a.id); else { sound('bump'); toast(`«${a.name}» откроется на ${a.lvl} уровне — пока можно только примерить`); } },
    }, isOpen(a) ? null : I.lock(18))));
    const box = h('div', { class: 'menu colors', role: 'dialog' },
      h('h2', { text: 'Цвет акцента' }), h('p', { text: 'Весь интерфейс сразу примеряет выбранный цвет' }),
      name, grid,
      h('div', { class: 'group-label cp-label', text: 'Особые · открываются с уровнем' }), special,
      h('div', { class: 'sl-actions' },
        h('button', { class: 'btn primary', nav: 'cpb', key: 'ok', act: () => finish(pick) }, 'Готово'),
        h('button', { class: 'btn', nav: 'cpb', key: 'cancel', act: () => finish(null) }, 'Отмена')));
    const layer = { el: h('div', {}, h('div', { class: 'scrim' }), box), kind: 'colors', hints: [['A', 'Выбрать'], ['B', 'Отмена']] };
    const finish = (c) => {
      if (done) return;
      done = true;
      if (!c) applyAccent();
      popLayer(layer);
      resolve(c);
    };
    layer.onBack = () => finish(null);
    layer.focusFirst = () => focus(box.querySelector('.cp-sw.cur') || grid.firstChild);
    show(current);
    pushLayer(layer);
  });
}

// =====================================================================
// actions
// =====================================================================
async function doSync() {
  if (S.syncing) return;
  S.syncing = true;
  renderProfile();
  if (S.tab === 'home' && !S.games.length) renderHero();
  for (const l of layers) if (l.kind === 'settings') l.refresh();
  try {
    const r = await api.sync();
    applyLibrary(r);
    for (const w of r.warnings || []) toast(w, 'warn');
    if (r.steamFound && !r.usedApi && !S.settings.steamKey && !localStorage.getItem('keyHint')) {
      try { localStorage.setItem('keyHint', '1'); } catch { /* ignore */ }
      toast('Показаны установленные игры Steam. Добавь ключ Steam API в настройках, чтобы видеть всю библиотеку.');
    }
  } catch (e) {
    toast(`Не удалось синхронизировать: ${e.message}`, 'warn');
  }
  S.syncing = false;
  refreshAll();
}

async function addGame() {
  const r = await api.addGame();
  applyLibrary(r.library);
  if (r.added) {
    toast('Игра добавлена');
    refreshAll();
    openGame(r.added);
  }
}

async function epicLoginFlow() {
  toast('Войди в Epic в открывшемся окне — мышью и клавиатурой');
  const r = await api.epicLogin();
  if (r.cancelled) return;
  if (!r.ok) {
    toast(r.error || 'Не удалось войти', 'warn');
    return menuBox('Вход не удался', 'Можно войти через обычный браузер и вставить код.', [['Вход по коду', epicCodeFlow], ['Отмена', () => {}]]);
  }
  sound('done');
  toast(`Вход выполнен: ${r.account}. Загружаю библиотеку Epic…`);
  S.epic.account = r.account;
  for (const l of layers) if (l.kind === 'settings') l.refresh();
  doSync();
}
async function epicCodeFlow() {
  await api.epicLoginPage();
  const v = await osk({ title: 'Войди в браузере, затем скопируй всю страницу с "authorizationCode" (Ctrl+A, Ctrl+C) и вставь сюда Ctrl+V' });
  if (v == null || !v.trim()) return;
  const r = await api.epicLoginCode(v);
  if (!r.ok) return toast(r.error, 'warn');
  sound('done');
  toast(`Вход выполнен: ${r.account}. Загружаю библиотеку Epic…`);
  S.epic.account = r.account;
  for (const l of layers) if (l.kind === 'settings') l.refresh();
  doSync();
}

async function installGame(id) {
  const g = byId(id);
  if (!g) return;
  const r = await api.install(id);
  if (!r.ok) return toast(r.error || 'Не удалось начать установку', 'warn');
  toast(r.epic ? `Подтверди установку «${g.name}» в окне Epic` : `Подтверди установку «${g.name}» в окне Steam — прогресс будет здесь`);
}
async function uninstallFlow(g) {
  if (g.source === 'epic') {
    confirmBox(`Удалить «${g.name}» с диска?`,
      `${g.size ? `Освободится ${fmtBytes(g.size)}. ` : ''}Откроется библиотека Epic: там нажми «···» у игры → «Удалить». Lobby сам заметит, что игры больше нет. Время и обложки сохранятся.`,
      'Открыть Epic', async () => {
        const r = await api.uninstall(g.id);
        if (!r.ok) toast(r.error, 'warn');
      });
    return;
  }
  if (g.source === 'steam') {
    confirmBox(`Удалить «${g.name}» с диска?`,
      `${g.size ? `Освободится ${fmtBytes(g.size)}. ` : ''}Steam попросит подтвердить удаление. Время в игре и обложки сохранятся.`,
      'Удалить', async () => {
        const r = await api.uninstall(g.id);
        if (!r.ok) toast(r.error, 'warn'); else toast('Подтверди удаление в окне Steam');
      });
    return;
  }
  const dir = await api.gameFolder(g.id);
  if (!dir) return toast('Не удалось определить папку игры. Удали её вручную.', 'warn');
  confirmBox(`Удалить «${g.name}» с диска?`,
    `Папка ${dir} целиком переместится в Корзину Windows, а игра пропадёт из Lobby. Восстановить можно из Корзины.`,
    'Переместить в Корзину', async () => {
      const r = await api.uninstall(g.id);
      if (!r.ok) return toast(r.error, 'warn');
      applyLibrary(r.library);
      toast(`«${g.name}» перемещена в Корзину`);
      const page = layers.find((l) => l.kind === 'game' && l.gameId === g.id);
      if (page) popLayer(page);
      refreshAll();
    });
}

async function launch(id) {
  const g = byId(id);
  if (!g) return;
  const r = await api.launch(id);
  if (!r.ok) { toast(r.error || 'Не удалось запустить', 'warn'); return; }
  if (r.installing) { toast(`Подтверди установку «${g.name}» в окне Steam — прогресс будет здесь`); return; }
  sound('launch');
  launchFx(g);
  if (r.untracked) toast(`«${g.name}» запущена. Время не учитывается — укажи процесс игры на её странице.`);
}

// the cover opens up from the selected tile to the whole screen, then hands over to the running dialog
async function launchFx(g) {
  if (unlockLv() < LAUNCH_FX_LVL || S.settings.launchFx === false) return;
  const stage = $('#stage');
  const sr = stage.getBoundingClientRect();
  const sc = S.scale || 1;
  const W = stage.offsetWidth, H = stage.offsetHeight;
  const fr = S.focused && S.focused.isConnected ? S.focused.getBoundingClientRect() : null;
  const r = fr ? { l: (fr.left - sr.left) / sc, t: (fr.top - sr.top) / sc, w: fr.width / sc, h: fr.height / sc } : { l: W * 0.3, t: H * 0.3, w: W * 0.4, h: H * 0.4 };
  const art = h('div', { class: 'lfx-art' });
  const el = h('div', { class: 'lfx', 'aria-hidden': 'true' }, art, h('div', { class: 'lfx-shade' }),
    h('div', { class: 'lfx-txt' }, h('span', { class: 'eyebrow', text: 'Запуск' }), h('b', { text: g.customName || g.name }), h('span', { class: 'lfx-bar' }, h('span'))));
  stage.append(el);
  const url = await firstOk([...(g.art.hero || []), ...(g.art.wide || [])]);
  if (url) art.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`;
  else art.style.background = PALETTE[hash(g.name) % PALETTE.length][0];
  const from = `inset(${r.t}px ${W - r.l - r.w}px ${H - r.t - r.h}px ${r.l}px round 14px)`;
  el.animate([{ clipPath: from }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }], { duration: 520, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
  art.animate([{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 2200, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
  setTimeout(() => {
    const out = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, easing: 'ease', fill: 'both' });
    out.onfinish = () => el.remove();
  }, 1900);
}

// running-game dialog
let runLayer = null;
function showRunning(gameId) {
  const g = byId(gameId);
  if (!g) return;
  if (runLayer) popLayer(runLayer);
  const timer = h('div', { class: 'timer', text: 'запуск…' });
  const info = h('p', { text: 'Жду, пока игра откроется' });
  const box = h('div', { class: 'running', role: 'dialog' },
    h('div', { class: 'gp-cover' }, placeholder(g), artImg(g.art.cover)),
    h('div', {},
      h('h2', { text: g.name }), timer, info,
      h('div', { class: 'acts', style: 'margin-top:22px' },
        h('button', { class: 'btn', nav: true, 'data-default': '', act: () => popLayer(runLayer) }, 'Скрыть'),
        h('button', { class: 'btn', nav: true, act: () => api.minimize() }, 'Свернуть Lobby'),
        h('button', { class: 'btn danger', nav: true, act: () => api.stopTracking() }, 'Остановить учёт'))));
  runLayer = { el: h('div', {}, h('div', { class: 'scrim' }), box), kind: 'running', hints: [['A', 'Выбрать'], ['B', 'Скрыть']] };
  runLayer.tick = () => {
    const s = S.session;
    if (!s || s.gameId !== gameId) return;
    if (s.state === 'running') { timer.textContent = fmtClock(Date.now() - s.since); info.textContent = 'Время идёт в учёт. Lobby вернётся после выхода из игры.'; }
  };
  runLayer.onClose = () => { runLayer = null; };
  pushLayer(runLayer);
}

// Guide button: from the background it brings Lobby up; inside Lobby it goes back to the home screen
api.onGuide((d) => {
  setInput('pad');
  hideCursor();
  if (d.summoned) { sound('open'); return; }
  for (const l of [...layers].reverse()) if (l.kind !== 'running') popLayer(l);
  if (S.tab !== 'home') setTab('home');
  else {
    const scroller = $('.home-scroll');
    if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' });
    const play = $('#hero [data-key="play"]');
    if (play && !layers.length) focus(play, { scroll: false });
  }
  sound('tab');
});

let dlSig = '';
api.onDownloads((d) => {
  S.downloads = d.list || [];
  if (d.library) applyLibrary(d.library);
  for (const e of d.events || []) {
    if (e.type === 'installed') { sound('done'); toast(`«${e.name}» установлена — можно играть`); }
    if (e.type === 'uninstalled') toast(`«${e.name}» удалена с диска`);
  }
  const sig = S.downloads.map((x) => `${x.gid}:${x.state}`).join(',');
  if (sig !== dlSig || d.library) { dlSig = sig; refreshAll(); }
  updateProgressUI();
});

api.onSession((d) => {
  if (d.state === 'starting') { S.session = { gameId: d.gameId, state: 'starting' }; showRunning(d.gameId); }
  else if (d.state === 'running') { S.session = { gameId: d.gameId, state: 'running', since: d.since }; if (runLayer) runLayer.tick(); }
  else if (d.state === 'ended') {
    const g = byId(d.gameId);
    S.session = null;
    if (runLayer) popLayer(runLayer);
    applyLibrary(d.library);
    if (d.minutes > 0) { sound('done'); }
    if (d.minutes > 0) toast(`${g ? g.name : 'Игра'}: +${fmtTime(d.minutes)}`);
    else if (g) toast(`«${g.name}» не запустилась или закрылась сразу`, 'warn');
    refreshAll();
  }
  renderPill();
  if (S.tab === 'home' && !layers.length) renderHero();
});

// =====================================================================
// boot
// =====================================================================
async function boot() {
  S.settings = await api.getSettings();
  applyAccent();
  fit();
  applyAccent();
  applyLibrary(await api.getLibrary());
  S.downloads = await api.getDownloads();
  api.updateGet().then((u) => { S.version = u.current; if (u.info) S.update = u.info; });
  $('#btn-search')._act = openSearch;
  $('#btn-settings')._act = openSettings;
  $('#profile')._act = openProfile;
  S.bro = await api.broGet();
  renderTabs(); renderProfile(); tickClock();
  setInterval(tickClock, 1000);
  setInterval(() => { if (runLayer) runLayer.tick(); }, 1000);
  setTab('home');
  setTimeout(() => loadFriends(), 2500);
  if (S.session) showRunning(S.session.gameId);
  requestAnimationFrame(pollPads);
  hideCursor();
  await splashDone;
  const splash = $('#splash');
  splash.classList.add('out');
  $('#stage').classList.add('revealing');
  intro($('#view-home'));
  setTimeout(() => { splash.remove(); $('#stage').classList.remove('revealing'); }, 1100);
  setTimeout(catchUpRewards, 1500);
  doSync();
}
try { const a = localStorage.getItem('accent'); if (a) document.documentElement.style.setProperty('--accent', a); } catch { /* ignore */ }
// the logo animation plays for a fixed time; loading happens underneath it
const splashDone = new Promise((r) => setTimeout(r, 2900));
setTimeout(() => sound('boot'), 150);
boot();

// Lobby Companion: a small HTTP server on the home network for the phone app.
// Pairing: the PC shows a QR code with its addresses and a one-time 6-digit code; the phone trades the code
// for a token. Every other request needs that token. Live updates go out as server-sent events.
'use strict';
const http = require('http');
const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PAIR_TTL = 3 * 60e3;
const MAX_TRIES = 5;
const IMG_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon' };

const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

// IPv4 addresses on the local network, real adapters first
function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      if (/^169\.254\./.test(a.address)) continue; // no DHCP
      const virtual = /vEthernet|VirtualBox|VMware|WSL|Hyper-V|Loopback|docker|vbox|Tailscale|ZeroTier/i.test(name);
      out.push({ ip: a.address, virtual, name });
    }
  }
  return out.sort((a, b) => a.virtual - b.virtual).map((a) => a.ip);
}

function create({ file, port: wantPort, api, version }) {
  let store;
  try { store = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { store = null; }
  if (!store || !Array.isArray(store.devices)) store = { devices: [] };
  const save = () => { try { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(store, null, 2)); } catch { /* ignore */ } };

  let server = null;
  let port = 0;
  let pairing = null; // { code, until, tries }
  const clients = new Set(); // SSE responses
  let onPaired = () => {};

  const pcName = () => os.hostname() || 'ПК';

  function json(res, code, body) {
    const data = JSON.stringify(body);
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(data) });
    res.end(data);
  }
  function readBody(req) {
    return new Promise((resolve) => {
      let raw = '';
      req.on('data', (c) => { raw += c; if (raw.length > 64e3) req.destroy(); });
      req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
      req.on('error', () => resolve({}));
    });
  }
  function deviceFor(req) {
    const h = req.headers.authorization || '';
    const t = /^Bearer\s+([A-Za-z0-9_-]{20,})$/.exec(h);
    if (!t) return null;
    const hash = sha(t[1]);
    const d = store.devices.find((x) => x.hash === hash);
    if (d && Date.now() - (d.seen || 0) > 60e3) { d.seen = Date.now(); save(); }
    return d || null;
  }

  // images: https stays as is, local files go through /art so the phone never sees PC paths
  function sendFile(res, p) {
    const type = IMG_TYPES[path.extname(p).toLowerCase()];
    if (!type) return json(res, 404, { error: 'not found' });
    fs.stat(p, (err, st) => {
      if (err || !st.isFile()) return json(res, 404, { error: 'not found' });
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': 'private, max-age=86400' });
      fs.createReadStream(p).pipe(res);
    });
  }

  async function route(req, res) {
    const url = new URL(req.url, 'http://x');
    const p = url.pathname;
    const m = req.method;

    if (m === 'GET' && p === '/api/hello') return json(res, 200, { app: 'Lobby', version, pc: pcName() });

    if (m === 'POST' && p === '/api/pair') {
      const b = await readBody(req);
      if (!pairing || Date.now() > pairing.until) return json(res, 410, { error: 'Код устарел. Открой подключение на ПК заново' });
      if (String(b.code || '') !== pairing.code) {
        pairing.tries++;
        if (pairing.tries >= MAX_TRIES) pairing = null;
        return json(res, 403, { error: 'Неверный код' });
      }
      pairing = null;
      const token = crypto.randomBytes(32).toString('base64url');
      const device = { id: crypto.randomBytes(6).toString('hex'), name: String(b.device || 'Телефон').slice(0, 60), hash: sha(token), added: Date.now(), seen: Date.now() };
      store.devices.push(device);
      save();
      onPaired(device);
      return json(res, 200, { token, pc: pcName(), version });
    }

    const dev = deviceFor(req);
    if (!dev) return json(res, 401, { error: 'Телефон не подключён к этому ПК' });

    // images
    let a = /^\/art\/([^/]+)\/(cover|hero|wide|square)\/(\d+)$/.exec(p);
    if (m === 'GET' && a) {
      const local = api.artFile(decodeURIComponent(a[1]), a[2], Number(a[3]));
      return local ? sendFile(res, local) : json(res, 404, { error: 'not found' });
    }
    if (m === 'GET' && p === '/avatar') {
      const local = api.avatarFile();
      return local ? sendFile(res, local) : json(res, 404, { error: 'not found' });
    }

    if (m === 'GET' && p === '/api/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(`event: hello\ndata: ${JSON.stringify({ pc: pcName() })}\n\n`);
      clients.add(res);
      const ping = setInterval(() => res.write(': ping\n\n'), 25e3);
      req.on('close', () => { clearInterval(ping); clients.delete(res); });
      return;
    }

    try {
      if (m === 'GET' && p === '/api/state') return json(res, 200, { pc: pcName(), version, device: dev.name, ...(await api.state()) });
      if (m === 'GET' && p === '/api/games') return json(res, 200, { games: api.games() });
      a = /^\/api\/games\/([^/]+)\/(ach|launch|install)$/.exec(p);
      if (a) {
        const id = decodeURIComponent(a[1]);
        if (m === 'GET' && a[2] === 'ach') return json(res, 200, await api.ach(id));
        if (m === 'POST' && a[2] === 'launch') return json(res, 200, await api.launch(id));
        if (m === 'POST' && a[2] === 'install') return json(res, 200, await api.install(id));
      }
      if (m === 'GET' && p === '/api/bro') return json(res, 200, api.bro());
      if (m === 'POST' && p === '/api/bro/reroll') { const b = await readBody(req); return json(res, 200, api.reroll(String(b.id || ''))); }
      if (m === 'GET' && p === '/api/friends') return json(res, 200, await api.friends(url.searchParams.has('force')));
      if (m === 'GET' && p === '/api/downloads') return json(res, 200, { downloads: api.downloads() });
      if (m === 'POST' && p === '/api/summon') { api.summon(); return json(res, 200, { ok: true }); }
      if (m === 'POST' && p === '/api/unpair') { removeDevice(dev.id); return json(res, 200, { ok: true }); }
    } catch (e) {
      return json(res, 500, { error: e.message || 'Ошибка на ПК' });
    }
    return json(res, 404, { error: 'not found' });
  }

  function start() {
    if (server) return Promise.resolve(port);
    return new Promise((resolve, reject) => {
      const tryPort = (n, left) => {
        const s = http.createServer((req, res) => { route(req, res).catch(() => { try { json(res, 500, { error: 'Ошибка на ПК' }); } catch { /* closed */ } }); });
        s.once('error', (e) => { if (e.code === 'EADDRINUSE' && left > 0) tryPort(n + 1, left - 1); else reject(e); });
        s.listen(n, '0.0.0.0', () => { server = s; port = n; resolve(n); });
      };
      tryPort(wantPort, 5);
    });
  }
  function stop() {
    for (const c of clients) { try { c.end(); } catch { /* ignore */ } }
    clients.clear();
    if (server) { server.close(); server = null; }
    pairing = null;
  }

  function broadcast(event, data) {
    if (!clients.size) return;
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    for (const c of clients) { try { c.write(msg); } catch { /* closed */ } }
  }

  function beginPairing() {
    pairing = { code: String(crypto.randomInt(0, 1e6)).padStart(6, '0'), until: Date.now() + PAIR_TTL, tries: 0 };
    const ips = lanAddresses();
    return { code: pairing.code, until: pairing.until, ips, port, pc: pcName(), link: `lobby://pair?h=${ips.join(',')}&p=${port}&c=${pairing.code}&n=${encodeURIComponent(pcName())}` };
  }
  const cancelPairing = () => { pairing = null; };

  function removeDevice(id) {
    store.devices = store.devices.filter((d) => d.id !== id);
    save();
  }
  const devices = () => store.devices.map(({ id, name, added, seen }) => ({ id, name, added, seen }));

  return {
    start, stop, broadcast, beginPairing, cancelPairing, removeDevice, devices,
    running: () => !!server, port: () => port, addresses: lanAddresses,
    onPaired: (fn) => { onPaired = fn; },
  };
}

module.exports = { create, lanAddresses };

// Updates from GitHub Releases: find a newer Lobby-Setup-x.y.z.exe, download it, run it silently.
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const REPO = 'Vikmat01/Lobby';

const parse = (v) => String(v || '').replace(/^v/i, '').split('.').map((x) => parseInt(x, 10) || 0);
function newer(a, b) {
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
  return false;
}

function create({ current, tempDir }) {
  let latest = null;
  let downloaded = null;
  let busy = null;

  async function check() {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': `Lobby/${current}` },
    });
    if (r.status === 404) return { available: false, current }; // no releases yet
    if (!r.ok) throw new Error(`GitHub: ошибка ${r.status}`);
    const j = await r.json();
    const version = String(j.tag_name || '').replace(/^v/i, '');
    const asset = (j.assets || []).find((a) => /^Lobby-Setup-.*\.exe$/i.test(a.name));
    if (!asset || !newer(version, current)) { latest = null; return { available: false, current, version }; }
    latest = {
      version, notes: (j.body || '').trim(), url: asset.browser_download_url, size: asset.size,
      sha256: /^sha256:/i.test(asset.digest || '') ? asset.digest.slice(7).toLowerCase() : null,
      page: j.html_url,
    };
    return { available: true, current, ...latest };
  }

  async function download(onProgress) {
    if (!latest) throw new Error('Нет доступного обновления');
    if (busy) return busy;
    busy = (async () => {
      const u = new URL(latest.url);
      if (u.protocol !== 'https:' || u.hostname !== 'github.com') throw new Error('Недопустимый адрес обновления');
      const r = await fetch(latest.url, { headers: { 'User-Agent': `Lobby/${current}` } });
      if (!r.ok || !r.body) throw new Error(`Не удалось скачать обновление (${r.status})`);
      const file = path.join(tempDir, `Lobby-Setup-${latest.version}.exe`);
      const out = fs.createWriteStream(file);
      const hash = crypto.createHash('sha256');
      let got = 0;
      let last = 0;
      for await (const chunk of r.body) {
        out.write(chunk);
        hash.update(chunk);
        got += chunk.length;
        if (Date.now() - last > 150) { last = Date.now(); onProgress(got, latest.size); }
      }
      await new Promise((res, rej) => out.end((e) => (e ? rej(e) : res())));
      onProgress(got, latest.size);
      if (latest.size && got !== latest.size) throw new Error('Файл обновления скачался не полностью');
      if (latest.sha256 && hash.digest('hex') !== latest.sha256) throw new Error('Контрольная сумма обновления не совпала');
      downloaded = file;
      return file;
    })().finally(() => { busy = null; });
    return busy;
  }

  // the installer closes Lobby itself, installs silently and starts the new version (/relaunch)
  function install() {
    if (!downloaded || !fs.existsSync(downloaded)) throw new Error('Обновление не скачано');
    spawn(downloaded, ['/S', '/relaunch'], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  }

  return { check, download, install, latestInfo: () => latest };
}

module.exports = { create, newer };

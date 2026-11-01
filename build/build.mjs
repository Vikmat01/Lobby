// Builds dist/Lobby (portable) and dist/Lobby-Setup-<version>.exe.
// Runs on Windows or Linux; needs Node 20+ and NSIS (makensis) on PATH.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import extract from 'extract-zip';
import * as ResEdit from 'resedit';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUILD = path.join(ROOT, 'build');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(DIST, 'Lobby');
const ELECTRON = '45.2.1';
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'package.json'), 'utf8'));
const version = pkg.version;
const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });

// 1. Electron runtime for Windows x64 (cached between builds)
const zip = path.join(DIST, `electron-v${ELECTRON}-win32-x64.zip`);
fs.mkdirSync(DIST, { recursive: true });
if (!fs.existsSync(zip)) {
  console.log(`Downloading Electron ${ELECTRON}…`);
  const r = await fetch(`https://github.com/electron/electron/releases/download/v${ELECTRON}/electron-v${ELECTRON}-win32-x64.zip`);
  if (!r.ok) throw new Error(`Electron download failed: ${r.status}`);
  fs.writeFileSync(zip, Buffer.from(await r.arrayBuffer()));
}
fs.rmSync(OUT, { recursive: true, force: true });
await extract(zip, { dir: OUT });
fs.renameSync(path.join(OUT, 'electron.exe'), path.join(OUT, 'Lobby.exe'));
fs.rmSync(path.join(OUT, 'resources', 'default_app.asar'), { force: true });
for (const f of fs.readdirSync(path.join(OUT, 'locales'))) {
  if (!['en-US.pak', 'ru.pak'].includes(f)) fs.rmSync(path.join(OUT, 'locales', f));
}

// 2. the app itself, with the Windows build of koffi (gamepad Guide button)
const APP = path.join(OUT, 'resources', 'app');
fs.cpSync(path.join(ROOT, 'app'), APP, { recursive: true, filter: (s) => !s.includes('node_modules') });
run('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', '--os=win32', '--cpu=x64'], { cwd: APP });
// npm pulls koffi binaries for every platform; keep only Windows x64
const scoped = path.join(APP, 'node_modules', '@koromix');
for (const d of fs.readdirSync(scoped)) if (d !== 'koffi-win32-x64') fs.rmSync(path.join(scoped, d), { recursive: true, force: true });
for (const d of ['doc', 'vendor']) fs.rmSync(path.join(APP, 'node_modules', 'koffi', d), { recursive: true, force: true });
if (!fs.existsSync(path.join(scoped, 'koffi-win32-x64', 'win32_x64', 'koffi.node'))) throw new Error('koffi Windows binary missing');

// 3. icon and version info inside Lobby.exe
const exe = path.join(OUT, 'Lobby.exe');
const ne = ResEdit.NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
const res = ResEdit.NtExecutableResource.from(ne);
const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(BUILD, 'icon.ico')));
const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(res.entries, groups[0]?.id ?? 1, groups[0]?.lang ?? 1033, ico.icons.map((i) => i.data));
const vi = ResEdit.Resource.VersionInfo.fromEntries(res.entries)[0];
const lang = { lang: 1033, codepage: 1200 };
vi.setStringValues(lang, { ProductName: 'Lobby', FileDescription: 'Lobby', CompanyName: '', OriginalFilename: 'Lobby.exe', InternalName: 'Lobby' });
vi.removeStringValue(lang, 'LegalCopyright');
const [a, b, c] = version.split('.').map(Number);
vi.setFileVersion(a, b, c, 0);
vi.setProductVersion(a, b, c, 0);
vi.outputToResourceEntries(res.entries);
res.outputResource(ne);
fs.writeFileSync(exe, Buffer.from(ne.generate()));

// 4. installer
const sep = process.platform === 'win32' ? '/' : '-';
run('makensis', [`${sep}V2`, `${sep}DVERSION=${version}`, `${sep}DSRC=${OUT}`, `${sep}DOUTDIR=${DIST}`, path.join(BUILD, 'lobby.nsi')], { cwd: BUILD });
console.log(`\nDone: dist/Lobby (portable) and dist/Lobby-Setup-${version}.exe`);

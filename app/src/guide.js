// Xbox Guide button, read straight from XInput so it works while Lobby is in the background.
// The public XInputGetState hides the Guide bit; the hidden export #100 (XInputGetStateEx) reports it.
'use strict';

const GUIDE = 0x0400;
let api = null;

function init() {
  if (api !== null) return api;
  api = false;
  if (process.platform !== 'win32') return api;
  try {
    const koffi = require('koffi');
    const kernel32 = koffi.load('kernel32.dll');
    const LoadLibraryW = kernel32.func('void* __stdcall LoadLibraryW(const char16_t *name)');
    const GetProcAddress = kernel32.func('void* __stdcall GetProcAddress(void *mod, uintptr_t name)');
    const GetProcByName = kernel32.func('GetProcAddress', 'void *', ['void *', 'const char *']);
    let mod = null;
    for (const dll of ['xinput1_4.dll', 'xinput1_3.dll']) { mod = LoadLibraryW(dll); if (mod) break; }
    if (!mod) return api;
    const fn = GetProcAddress(mod, 100); // by ordinal
    if (!fn) return api;
    const State = koffi.struct('XINPUT_STATE_EX', {
      packet: 'uint32', buttons: 'uint16', lt: 'uint8', rt: 'uint8',
      lx: 'int16', ly: 'int16', rx: 'int16', ry: 'int16', pad: 'uint32',
    });
    const proto = koffi.proto('uint32 __stdcall XInputGetStateEx(uint32 idx, _Out_ XINPUT_STATE_EX *state)');
    const batFn = GetProcByName(mod, 'XInputGetBatteryInformation');
    const Battery = koffi.struct('XINPUT_BATTERY_INFORMATION', { type: 'uint8', level: 'uint8' });
    const batProto = koffi.proto('uint32 __stdcall XInputGetBatteryInformation(uint32 idx, uint8 devType, _Out_ XINPUT_BATTERY_INFORMATION *info)');
    const user32 = koffi.load('user32.dll');
    api = {
      read(i) {
        const st = {};
        const r = koffi.call(fn, proto, i, st);
        return r === 0 ? st : null;
      },
      // XInput reports 4 steps: 0 empty, 1 low, 2 medium, 3 full; type 1 = wired, 0 = none
      battery(i) {
        if (!batFn) return null;
        const b = {};
        return koffi.call(batFn, batProto, i, 0, b) === 0 ? b : null;
      },
      keybd: user32.func('void __stdcall keybd_event(uint8 vk, uint8 scan, uint32 flags, uintptr_t extra)'),
      setFg: user32.func('bool __stdcall SetForegroundWindow(void *hwnd)'),
      hwndOf: (buf) => koffi.decode(buf, 'void *'),
    };
  } catch (e) {
    api = false;
  }
  return api;
}

// Windows only lets the foreground app hand focus around; a synthetic Alt tap unlocks that for us.
function forceForeground(win) {
  const a = init();
  if (!a || !win) return;
  try {
    a.keybd(0x12, 0, 0, 0);
    a.keybd(0x12, 0, 2, 0);
    a.setFg(a.hwndOf(win.getNativeWindowHandle()));
  } catch { /* fall back to Electron's focus */ }
}

// calls onPress once per Guide press on any of the 4 controllers
function watch(onPress) {
  const a = init();
  if (!a) return { ok: false, stop() {} };
  const down = [false, false, false, false];
  const connected = [true, true, true, true];
  let tick = 0;
  const timer = setInterval(() => {
    tick++;
    for (let i = 0; i < 4; i++) {
      if (!connected[i] && tick % 40) continue; // empty slots are rechecked every ~2 s
      const st = a.read(i);
      connected[i] = !!st;
      const g = !!(st && (st.buttons & GUIDE));
      if (g && !down[i]) onPress(i);
      down[i] = g;
    }
  }, 50);
  return { ok: true, stop: () => clearInterval(timer) };
}

// battery of every connected controller: [{ slot, wired, level 0..3 }]
function batteries() {
  const a = init();
  if (!a) return [];
  const out = [];
  for (let i = 0; i < 4; i++) {
    if (!a.read(i)) continue;
    const b = a.battery(i);
    if (!b || b.type === 0) continue;
    out.push({ slot: i, wired: b.type === 1, level: b.type === 1 ? 3 : Math.min(3, b.level) });
  }
  return out;
}

module.exports = { watch, forceForeground, batteries, available: () => !!init() };

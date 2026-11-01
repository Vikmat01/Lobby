'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const call = (ch) => (...a) => ipcRenderer.invoke(ch, ...a);

contextBridge.exposeInMainWorld('api', {
  getSettings: call('settings:get'),
  setSettings: call('settings:set'),
  getLibrary: call('library:get'),
  sync: call('library:sync'),
  launch: call('game:launch'),
  stopTracking: call('game:stopTracking'),
  updateGame: call('game:update'),
  removeGame: call('game:remove'),
  pickArt: call('game:pickArt'),
  resetArt: call('game:resetArt'),
  addGame: call('game:add'),
  toggleFullscreen: call('app:fullscreen'),
  quit: call('app:quit'),
  minimize: call('app:minimize'),
  openUrl: call('app:openUrl'),
  sgdbSearch: call('sgdb:search'),
  sgdbImages: call('sgdb:images'),
  sgdbApply: call('sgdb:apply'),
  install: call('game:install'),
  uninstall: call('game:uninstall'),
  gameFolder: call('game:folder'),
  getDownloads: call('downloads:get'),
  steamDownloads: call('app:steamDownloads'),
  epicLogin: call('epic:login'),
  epicLoginCode: call('epic:loginCode'),
  epicLoginPage: call('epic:loginPage'),
  epicLogout: call('epic:logout'),
  guideStatus: call('app:guideStatus'),
  onGuide: (fn) => ipcRenderer.on('guide', (_e, d) => fn(d)),
  onDownloads: (fn) => ipcRenderer.on('downloads', (_e, d) => fn(d)),
  onSession: (fn) => ipcRenderer.on('session', (_e, d) => fn(d)),
});

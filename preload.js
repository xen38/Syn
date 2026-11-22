const { contextBridge, ipcRenderer } = require('electron')

const synAPI = {
  // Config
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (updates) => ipcRenderer.invoke('config:set', updates),

  // Harnesses / sources
  addHarness: (dirPath, harness) => ipcRenderer.invoke('harness:add', dirPath, harness),
  removeHarness: (dirPath) => ipcRenderer.invoke('harness:remove', dirPath),
  listHarnesses: () => ipcRenderer.invoke('harness:list'),
  getHarnessSettings: () => ipcRenderer.invoke('harness:settings:get'),
  setHarnessSetting: (name, enabled) => ipcRenderer.invoke('harness:settings:set', name, enabled),
  autodetectHarnesses: () => ipcRenderer.invoke('harness:autodetect'),

  // Source indexing
  indexSource: (sourceId) => ipcRenderer.invoke('source:index', sourceId),
  indexAllSources: (options) => ipcRenderer.invoke('source:indexAll', options),
  incrementalIndex: (options) => ipcRenderer.invoke('source:incrementalIndex', options),

  // Sessions
  listSessions: (sourcePath) => ipcRenderer.invoke('session:list', sourcePath),
  listAllSessions: () => ipcRenderer.invoke('session:listAll'),
  readSession: (sessionId) => ipcRenderer.invoke('session:read', sessionId),
  deleteSession: (sessionId) => ipcRenderer.invoke('session:delete', sessionId),
  searchSessions: (query, options) => ipcRenderer.invoke('session:search', query, options),
  getContext: (sessionId, messageIndex, before, after) =>
    ipcRenderer.invoke('session:getContext', sessionId, messageIndex, before, after),

  // Brainmaxxing (Memory Vault)
  brainIndex: () => ipcRenderer.invoke('brain:index'),
  getBrainIndex: () => ipcRenderer.invoke('brain:getIndex'),
  brainRead: (relativePath) => ipcRenderer.invoke('brain:read', relativePath),
  brainWrite: (relativePath, content) => ipcRenderer.invoke('brain:write', relativePath, content),
  brainRename: (oldPath, newPath) => ipcRenderer.invoke('brain:rename', oldPath, newPath),
  brainDelete: (relativePath) => ipcRenderer.invoke('brain:delete', relativePath),
  brainList: () => ipcRenderer.invoke('brain:list'),
  brainNextSerial: () => ipcRenderer.invoke('brain:nextSerial'),
  brainImport: (sourcePath) => ipcRenderer.invoke('brain:import', sourcePath),
  brainSetDir: (newDir) => ipcRenderer.invoke('brain:setDir', newDir),
  brainReflect: (sessionId) => ipcRenderer.invoke('brain:reflect', sessionId),
  brainMeditate: (sessionId) => ipcRenderer.invoke('brain:meditate', sessionId),
  brainRuminate: (sessionId) => ipcRenderer.invoke('brain:ruminate', sessionId),
  brainPlan: (sessionId) => ipcRenderer.invoke('brain:plan', sessionId),
  brainReview: (sessionId) => ipcRenderer.invoke('brain:review', sessionId),

  // Brain Vault window
  brainVaultOpen: () => ipcRenderer.invoke('brainVault:open'),
  brainVaultWindowMinimize: () => ipcRenderer.invoke('brainVaultWindow:minimize'),
  brainVaultWindowMaximize: () => ipcRenderer.invoke('brainVaultWindow:maximize'),
  brainVaultWindowClose: () => ipcRenderer.invoke('brainVaultWindow:close'),
  brainVaultWindowSetBounds: (bounds) => ipcRenderer.invoke('brainVaultWindow:setBounds', bounds),
  brainVaultWindowGetBounds: () => ipcRenderer.invoke('brainVaultWindow:getBounds'),
  brainDir: () => ipcRenderer.invoke('brain:dir'),

  // Brain Vault window shown notification (for canvas resize)
  onBvWindowShown: (cb) => ipcRenderer.on('bv:window-shown', cb),

  // File dialogs
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
  showItemInFolder: (fullPath) => ipcRenderer.invoke('shell:showItemInFolder', fullPath),

  // Database health (Gate G7)
  dbHealth: () => ipcRenderer.invoke('db:health'),
  dbRebuild: (preserveCorrupt = true) => ipcRenderer.invoke('db:rebuild', preserveCorrupt)
}

// Expose as synAPI, with locateAPI alias for backward compatibility.
contextBridge.exposeInMainWorld('synAPI', synAPI)
contextBridge.exposeInMainWorld('locateAPI', synAPI)

import { contextBridge, ipcRenderer } from 'electron'

export interface SynAPI {
  // Config
  getConfig: () => Promise<unknown>
  setConfig: (updates: Record<string, unknown>) => Promise<unknown>

  // Harnesses / sources
  addHarness: (dirPath: string, harness: string) => Promise<unknown>
  removeHarness: (dirPath: string) => Promise<unknown>
  listHarnesses: () => Promise<unknown>
  getHarnessSettings: () => Promise<unknown>
  setHarnessSetting: (name: string, enabled: boolean) => Promise<unknown>
  autodetectHarnesses: () => Promise<unknown>

  // Source indexing
  indexSource: (sourceId: string) => Promise<unknown>
  indexAllSources: (options: Record<string, unknown>) => Promise<unknown>
  incrementalIndex: (options: Record<string, unknown>) => Promise<unknown>

  // Sessions
  listSessions: (sourcePath: string) => Promise<unknown>
  listAllSessions: () => Promise<unknown>
  readSession: (sessionId: string) => Promise<unknown>
  deleteSession: (sessionId: string) => Promise<unknown>
  searchSessions: (query: string, options: Record<string, unknown>) => Promise<unknown>
  getContext: (sessionId: string, messageIndex: number, before: number, after: number) => Promise<unknown>

  // Brainmaxxing (Memory Vault)
  brainIndex: () => Promise<unknown>
  getBrainIndex: () => Promise<unknown>
  brainRead: (relativePath: string) => Promise<unknown>
  brainWrite: (relativePath: string, content: string) => Promise<unknown>
  brainRename: (oldPath: string, newPath: string) => Promise<unknown>
  brainDelete: (relativePath: string) => Promise<unknown>
  brainList: () => Promise<unknown>
  brainNextSerial: () => Promise<unknown>
  brainImport: (sourcePath: string) => Promise<unknown>
  brainSetDir: (newDir: string) => Promise<unknown>
  brainReflect: (sessionId: string) => Promise<unknown>
  brainMeditate: (sessionId: string) => Promise<unknown>
  brainRuminate: (sessionId: string) => Promise<unknown>
  brainPlan: (sessionId: string) => Promise<unknown>
  brainReview: (sessionId: string) => Promise<unknown>

  // Brain Vault window
  brainVaultOpen: () => Promise<unknown>
  brainVaultWindowMinimize: () => Promise<unknown>
  brainVaultWindowMaximize: () => Promise<unknown>
  brainVaultWindowClose: () => Promise<unknown>
  brainVaultWindowSetBounds: (bounds: Record<string, unknown>) => Promise<unknown>
  brainVaultWindowGetBounds: () => Promise<unknown>
  brainDir: () => Promise<unknown>

  // Main window controls (custom title bar)
  synWindow: {
    minimize: () => Promise<unknown>
    maximize: () => Promise<unknown>
    close: () => Promise<unknown>
  }

  // Brain Vault window shown notification (for canvas resize)
  onBvWindowShown: (cb: (...args: unknown[]) => void) => void
  onBvEnterFullscreen: (cb: (...args: unknown[]) => void) => void
  onBvLeaveFullscreen: (cb: (...args: unknown[]) => void) => void

  // File dialogs
  openFileDialog: () => Promise<unknown>
  openFolderDialog: () => Promise<unknown>
  showItemInFolder: (fullPath: string) => Promise<unknown>

  // Database health (Gate G7)
  dbHealth: () => Promise<unknown>
  dbRebuild: (preserveCorrupt?: boolean) => Promise<unknown>
}

const synAPI: SynAPI = {
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

  // Main window controls (custom title bar)
  synWindow: {
    minimize: () => ipcRenderer.invoke('SynWindow:minimize'),
    maximize: () => ipcRenderer.invoke('SynWindow:maximize'),
    close: () => ipcRenderer.invoke('SynWindow:close')
  },

  // Brain Vault window shown notification (for canvas resize)
  onBvWindowShown: (cb) => ipcRenderer.on('bv:window-shown', cb),
  onBvEnterFullscreen: (cb) => ipcRenderer.on('bv:enter-fullscreen', cb),
  onBvLeaveFullscreen: (cb) => ipcRenderer.on('bv:leave-fullscreen', cb),

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

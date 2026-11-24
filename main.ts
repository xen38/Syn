import { app, BrowserWindow, ipcMain, dialog, Menu, shell as electronShell } from 'electron'
import path from 'path'
import fs from 'fs'
import { IndexingEngine } from './packages/core/index'
import * as brainmaxxing from './packages/core/brainmaxxing'

// Configuration file path (user data dir)
const CONFIG_FILE = path.join(app.getPath('userData'), 'syn', 'config.json')

// Shared index database path — same location used by the MCP server so both
// components share a single index.
const INDEX_DB_PATH = path.join(app.getPath('userData'), 'syn', 'syn-index.db')

interface SynConfig {
  harnessDirectories: string[]
  batchSize: number
  windowBounds: { width: number; height: number }
  harnessSettings: Record<string, boolean>
  redactSecrets: boolean
  secretPatterns: { name: string; pattern: RegExp; replacement: string }[] | undefined
  excludedPaths: string[]
}

// Default configuration
const DEFAULT_CONFIG: SynConfig = {
  harnessDirectories: [],
  batchSize: 10,
  windowBounds: { width: 1200, height: 800 },
  harnessSettings: {},
  // Phase 8: Privacy & Security
  redactSecrets: true,
  secretPatterns: undefined, // undefined = use built-in DEFAULT_SECRET_PATTERNS
  excludedPaths: []
}

let config: SynConfig = { ...DEFAULT_CONFIG }

// Load config
function loadConfig (): void {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8')
      config = { ...DEFAULT_CONFIG, ...JSON.parse(data) } as SynConfig
    }
  } catch (e) {
    console.error('Failed to load config:', (e as Error).message)
    config = { ...DEFAULT_CONFIG }
  }
}

// Save config
function saveConfig (): void {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8')
  } catch (e) {
    console.error('Failed to save config:', (e as Error).message)
  }
}

// All possible harnesses that can appear in the settings menu,
// even if not yet indexed on this machine. This lets users pre-enable
// or pre-disable harnesses before they are detected.
const ALL_POSSIBLE_HARNESSES: string[] = [
  'Cline',
  'Codex',
  'GitHub Copilot',
  'Cursor',
  'Pi',
  'T3 Code',
  'Claude Code',
  'OpenCode',
  'OpenCode / Crush',
  'Windsurf',
  'Continue',
  'Zed',
  'Roo',
  'Aider',
  'Gemini CLI'
]

// Harnesses whose sessions should be shown in lists/search.
// T3 Code is disabled by default because it aggregates other harnesses'
// sessions (causing duplicates); every other harness is enabled by default.
function getEnabledHarnesses (): string[] {
  const all = ALL_POSSIBLE_HARNESSES
  const settings = config.harnessSettings || {}
  return all.filter(name => {
    if (name in settings) return !!settings[name]
    return name !== 'T3 Code'
  })
}

loadConfig()

// ── Core Indexing Engine (shared with MCP server) ──────────────────────────

const engine = new IndexingEngine(INDEX_DB_PATH, {
  redactSecrets: config.redactSecrets,
  secretPatterns: config.secretPatterns,
  excludedPaths: config.excludedPaths
})

let mainWindow: BrowserWindow | null = null
let brainVaultWindow: BrowserWindow | null = null

function createWindow (): void {
  console.log('Creating window...')
  const windowIcon = path.join(__dirname, 'assets', 'icon.png')

  mainWindow = new BrowserWindow({
    width: config.windowBounds.width || 1200,
    height: config.windowBounds.height || 800,
    minWidth: 900,
    minHeight: 600,
    icon: windowIcon,
    frame: false, // custom title bar; window controls handled via SynWindow IPC
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Syn',
    backgroundColor: '#000000'
  })

  console.log('Window created, loading index.html...')
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html')).then(() => {
    console.log('index.html loaded')
  }).catch(e => {
    console.error('Failed to load index.html:', e)
  })

  // Remove default Electron menu bar (File, Edit, View, Window, Help)
  Menu.setApplicationMenu(null)

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.on('resize', () => {
    if (mainWindow) {
      const [w, h] = mainWindow.getSize()
      config.windowBounds = { width: w, height: h }
      saveConfig()
    }
  })
}

// ── Brain Vault window (separate draggable/resizable BrowserWindow) ─────
function createBrainVaultWindow (): void {
  const windowIcon = path.join(__dirname, 'assets', 'icon.png')

  // Spawn filling the middle column (after Sessions sidebar, before Terminal)
  const spawnX = 300
  const spawnY = 80

  brainVaultWindow = new BrowserWindow({
    x: spawnX,
    y: spawnY,
    width: 1003,
    height: 933,
    minWidth: 500,
    minHeight: 400,
    icon: windowIcon,
    frame: false, // custom title bar; window controls handled via IPC
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'Brain Vault — Syn',
    backgroundColor: '#000000',
    show: false // don't show until loaded
  })

  const bw = brainVaultWindow!
  bw.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Brain Vault failed to load:', errorCode, errorDescription, validatedURL)
  })

  bw.webContents.on('render-process-gone', (event, details) => {
    console.error('Brain Vault render process gone:', details)
  })

  bw.loadFile(path.join(__dirname, 'renderer', 'brain-vault.html')).then(() => {
    bw.show()
    // Notify renderer that window is visible so it can size the graph canvas correctly
    bw.webContents.send('bv:window-shown')
  }).catch(e => {
    console.error('Failed to load brain-vault.html:', e)
  })

  bw.on('closed', () => {
    brainVaultWindow = null
  })

  // Notify renderer on fullscreen state changes so the graph can recenter
  const bw2 = brainVaultWindow
  if (bw2) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bw2.on('enter-fullscreen' as any, () => {
      bw2.webContents.send('bv:enter-fullscreen')
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bw2.on('leave-fullscreen' as any, () => {
      bw2.webContents.send('bv:leave-fullscreen')
    })
  }
}

// Open or focus the brain vault window
function openBrainVaultWindow (): void {
  const bw = brainVaultWindow
  if (bw) {
    if (bw.isMinimized()) bw.restore()
    bw.focus()
    return
  }
  createBrainVaultWindow()
}

// ── Session-start hook: inject brain/index.md ────────────────────────────
// Reads brain/index.md (rebuilt by watchBrainIndex) and exposes it via
// synAPI.getBrainIndex() so the renderer can present the vault at launch.
let brainIndexMd = ''

function injectBrainIndex (): void {
  try {
    brainIndexMd = brainmaxxing.readIndexMd()
    console.log(`[syn] Brain index injected at session start (${brainIndexMd.length} chars)`)
  } catch (e) {
    console.error('[syn] Failed to read brain index:', (e as Error).message)
    brainIndexMd = ''
  }
}

// ── Auto-index hook: rebuild brain/index.md when brain/ files change ─────
let rebuildIndexTimer: NodeJS.Timeout | null = null
function watchBrainIndex (): void {
  const brainDir = brainmaxxing.BRAIN_DIR
  if (!fs.existsSync(brainDir)) return
  try {
    fs.watch(brainDir, { recursive: true }, (eventType, filename) => {
      if (!filename || !filename.endsWith('.md')) return
      // Skip index.md changes — rebuildIndex() writes index.md itself, which
      // would otherwise trigger another watch event → infinite loop.
      if (filename === 'index.md') return
      // Debounce: batch rapid file changes into a single rebuild
      if (rebuildIndexTimer) clearTimeout(rebuildIndexTimer)
      rebuildIndexTimer = setTimeout(() => {
        try {
          brainmaxxing.rebuildIndex()
          console.log(`[syn] Auto-indexed brain/ (${eventType}): ${filename}`)
        } catch (e) {
          console.error('[syn] Auto-index failed:', (e as Error).message)
        }
        rebuildIndexTimer = null
      }, 300)
    })
  } catch (e) {
    console.error('[syn] Failed to watch brain/:', (e as Error).message)
  }
}

app.whenReady().then(async () => {
  try {
    await engine.open()
    if (engine.dbHealth === 'healthy') {
      console.log('Index engine opened successfully')
    } else if (engine.dbHealth === 'corrupt') {
      console.error('Index engine: corrupt DB detected at ' + INDEX_DB_PATH +
        '. Original preserved, backup created. Use "Rebuild index" to recover.')
    } else {
      console.error('Index engine: unknown health state: ' + engine.dbHealth)
    }
  } catch (e) {
    console.error('Failed to open index engine:', e)
  }
  injectBrainIndex()
  watchBrainIndex()

  // Auto-register the Memory Vault (brain/) as an indexing source so its
  // contents are searchable through the engine alongside harness sources.
  try {
    const brainDir = brainmaxxing.BRAIN_DIR
    if (fs.existsSync(brainDir)) {
      const existing = engine.listSources().find(s => s.path === brainDir)
      if (!existing) {
        const sourceId = engine.addSource(brainDir, 'Brain Vault')
        console.log(`[syn] Auto-registered brain/ vault as source ${sourceId}`)
      }
    }
  } catch (e) {
    console.error('[syn] Failed to auto-register brain/ vault:', (e as Error).message)
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── SynWindow IPC handlers (custom title bar for main window) ─────────────
ipcMain.handle('SynWindow:minimize', async () => {
  if (mainWindow) mainWindow.minimize()
})
ipcMain.handle('SynWindow:maximize', async () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  }
})
ipcMain.handle('SynWindow:close', async () => {
  if (mainWindow) mainWindow.close()
})

// IPC: Get configuration
ipcMain.handle('config:get', async () => {
  return config
})

// IPC: Get database health status (Gate G7)
ipcMain.handle('db:health', async () => {
  return {
    health: engine.dbHealth,
    dbPath: INDEX_DB_PATH,
    initialized: engine.initialized
  }
})

// IPC: Rebuild index database from source archives (Gate G7)
ipcMain.handle('db:rebuild', async (_event, preserveCorrupt = true) => {
  if (engine.dbHealth === 'healthy') {
    return { status: 'no-rebuild-needed', health: engine.dbHealth }
  }
  const result = await engine.rebuild(preserveCorrupt)
  return { status: 'rebuilt', health: engine.dbHealth, ...result }
})

// IPC: Update configuration
ipcMain.handle('config:set', async (_event, updates: Partial<SynConfig>) => {
  config = { ...config, ...updates }
  saveConfig()
  return config
})

// IPC: Add a harness directory (register as indexing source)
ipcMain.handle('harness:add', async (_event, dirPath: string, harness?: string) => {
  try {
    const normalized = path.resolve(dirPath)
    if (!fs.existsSync(normalized)) {
      throw new Error(`Directory does not exist: ${normalized}`)
    }
    // Prevent duplicate sources in the engine
    const existing = engine.listSources().find(s => s.path === normalized)
    if (existing) {
      return { sourceId: existing.id, path: normalized, harnesses: config.harnessDirectories }
    }
    const sourceId = engine.addSource(normalized, harness || undefined)
    if (!config.harnessDirectories.includes(normalized)) {
      config.harnessDirectories.push(normalized)
      saveConfig()
    }
    return { sourceId, path: normalized, harnesses: config.harnessDirectories }
  } catch (e) {
    console.error('Failed to add harness:', (e as Error).message)
    throw e
  }
})

// IPC: Remove a harness directory
ipcMain.handle('harness:remove', async (_event, dirPath: string) => {
  try {
    const normalized = path.resolve(dirPath)
    engine.removeSource(normalized)
    config.harnessDirectories = config.harnessDirectories.filter(d => d !== normalized)
    saveConfig()
    return config.harnessDirectories
  } catch (e) {
    console.error('Failed to remove harness:', (e as Error).message)
    throw e
  }
})

// IPC: List all harness directories (sources)
ipcMain.handle('harness:list', async () => {
  const sources = engine.listSources()
  return sources.map(s => ({
    path: s.path,
    name: s.name,
    harness: s.harness,
    status: s.status,
    session_count: s.session_count,
    indexed_count: s.indexed_count,
    last_scan: s.last_scan,
    error: s.error
  }))
})

// IPC: Get all available harnesses with their enabled state
ipcMain.handle('harness:settings:get', async () => {
  try {
    const settings = config.harnessSettings || {}
    return ALL_POSSIBLE_HARNESSES.map(name => ({
      name,
      // Default: enabled for all harnesses except T3 Code (aggregates others, causes duplicates)
      enabled: name in settings ? !!settings[name] : name !== 'T3 Code'
    }))
  } catch (e) {
    console.error('Failed to get harness settings:', (e as Error).message)
    return []
  }
})

// IPC: Set enabled state for a single harness
ipcMain.handle('harness:settings:set', async (_event, name: string, enabled: boolean) => {
  try {
    config.harnessSettings = { ...config.harnessSettings, [name]: !!enabled }
    saveConfig()
    return config.harnessSettings
  } catch (e) {
    console.error('Failed to set harness setting:', (e as Error).message)
    throw e
  }
})

// IPC: Open folder picker dialog
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select harness folder to scan'
  })
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0]
  }
  return null
})

// IPC: List sessions (optionally filtered by source path)
ipcMain.handle('session:list', async (_event, sourcePath?: string) => {
  try {
    const enabled = getEnabledHarnesses()
    let sessions: { session_id: string; title: string; harness: string; source_path: string; file_path: string; created_at: string; indexed_at: string }[]
    if (sourcePath) {
      const normalized = path.resolve(sourcePath)
      const all = engine.listSessions({ enabledHarnesses: enabled })
      sessions = all.filter(s => s.source_path === normalized)
    } else {
      sessions = engine.listSessions({ enabledHarnesses: enabled })
    }
    return sessions.map(s => ({
      id: s.session_id,
      session_id: s.session_id,
      title: s.title,
      harness: s.harness,
      source_path: s.source_path,
      file_path: s.file_path,
      created_at: s.created_at,
      indexed_at: s.indexed_at
    }))
  } catch (e) {
    console.error('Failed to list sessions:', (e as Error).message)
    return []
  }
})

// IPC: List all sessions across all sources
ipcMain.handle('session:listAll', async () => {
  try {
    const sessions = engine.listSessions({ enabledHarnesses: getEnabledHarnesses() })
    return sessions.map(s => ({
      id: s.session_id,
      session_id: s.session_id,
      title: s.title,
      harness: s.harness,
      source_path: s.source_path,
      file_path: s.file_path,
      created_at: s.created_at,
      indexed_at: s.indexed_at
    }))
  } catch (e) {
    console.error('Failed to list all sessions:', (e as Error).message)
    return []
  }
})

// IPC: Read a single session by session ID
ipcMain.handle('session:read', async (_event, sessionId: string) => {
  try {
    const session = engine.getSession(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }
    return {
      session_id: session.session_id,
      title: session.title,
      harness: session.harness,
      source_path: session.source_path,
      file_path: session.file_path,
      created_at: session.created_at,
      indexed_at: session.indexed_at,
      messages: session.messages || []
    }
  } catch (e) {
    throw new Error(`Failed to read session ${sessionId}: ${(e as Error).message}`)
  }
})

// Get all available drive roots on Windows (C: through Z:)
function getDriveRoots (): string[] {
  const roots: string[] = []
  for (let code = 67; code <= 90; code++) { // C-Z
    const drive = String.fromCharCode(code) + ':\\'
    try {
      if (fs.existsSync(drive)) roots.push(drive)
    } catch (e) {}
  }
  return roots
}

// IPC: Autodetect harness directories across all drives
ipcMain.handle('harness:autodetect', async () => {
  const knownHarnessDirs = [
    '.copilot', '.codex', '.cursor', '.cline', '.windsurf',
    '.t3', '.pi', '.opencode', '.claude', '.continue', '.zed',
    '.roo', '.aider', '.devin'
  ]

  const detected: string[] = []
  const driveRoots = getDriveRoots()

  // Delay helper to yield to UI thread between drive scans
  const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms))

  for (const root of driveRoots) {
    const usersDir = path.join(root, 'Users')
    try {
      if (!fs.existsSync(usersDir)) continue

      const entries = fs.readdirSync(usersDir, { withFileTypes: true })
      for (const entry of entries) {
        if (!entry.isDirectory()) continue
        const userDir = path.join(usersDir, entry.name)

        try {
          const subEntries = fs.readdirSync(userDir, { withFileTypes: true })
          for (const sub of subEntries) {
            if (!sub.isDirectory()) continue
            const lower = sub.name.toLowerCase()
            if (knownHarnessDirs.includes(lower)) {
              detected.push(path.join(userDir, sub.name))
            }
          }
        } catch (e) {
          // skip inaccessible user dirs
        }
      }
    } catch (e) {
      // skip inaccessible roots
    }

    // Yield between drives to keep UI responsive
    await sleep(30)
  }

  return detected
})

// IPC: Index a source explicitly
ipcMain.handle('source:index', async (_event, sourceId: number) => {
  try {
    const result = await engine.indexSource(sourceId)
    return result
  } catch (e) {
    console.error('Failed to index source:', (e as Error).message)
    throw e
  }
})

// IPC: Index all sources
ipcMain.handle('source:indexAll', async (_event, options: { batchSize?: number } = {}) => {
  try {
    return await engine.indexAllSources(options)
  } catch (e) {
    console.error('Failed to index all sources:', (e as Error).message)
    throw e
  }
})

// IPC: Incremental indexing (check for new/modified/deleted)
ipcMain.handle('source:incrementalIndex', async (_event, options: { batchSize?: number } = {}) => {
  try {
    return await engine.incrementalIndex(options)
  } catch (e) {
    console.error('Failed incremental indexing:', (e as Error).message)
    throw e
  }
})

// IPC: Search across all sessions (FTS5 via IndexingEngine)
// Synchronous search — no worker needed since FTS5 queries are fast.
ipcMain.handle('session:search', async (_event, query: string, options: Record<string, unknown> = {}) => {
  try {
    // Coerce and validate search filter types before handing to the engine.
    const limit = Number.isFinite(Number(options.limit)) ? Number(options.limit) : 50
    const excerptLength = Number.isFinite(Number(options.excerptLength)) ? Number(options.excerptLength) : 200
    const harness = options.harness ? String(options.harness) : undefined
    const role = options.role ? String(options.role) : undefined
    const project = options.project ? String(options.project) : undefined
    const brain = options.brain === true || options.brain === 'true'
    const dateFrom = options.dateFrom ? String(options.dateFrom) : undefined
    const dateTo = options.dateTo ? String(options.dateTo) : undefined
    const enabledHarnesses = Array.isArray(options.enabledHarnesses)
      ? options.enabledHarnesses.map(String)
      : getEnabledHarnesses()

    const results = engine.search(query, {
      harness,
      role,
      project,
      brain,
      dateFrom,
      dateTo,
      enabledHarnesses,
      limit,
      excerptLength
    })
    return results.map(r => ({
      id: r.session_id,
      session_id: r.session_id,
      title: r.title,
      harness: r.harness,
      source_path: r.source_path,
      file_path: r.file_path,
      created_at: r.created_at,
      rank: r.rank,
      snippet: r.snippet,
      excerpt: r.excerpt
    }))
  } catch (e) {
    console.error('Search failed:', (e as Error).message)
    throw e
  }
})

// IPC: Get context around a message
ipcMain.handle('session:getContext', async (_event, sessionId: string, messageIndex: number, before = 5, after = 5) => {
  try {
    return engine.getContext(sessionId, messageIndex, before, after)
  } catch (e) {
    throw new Error(`Failed to get context: ${(e as Error).message}`)
  }
})

// IPC: Remove a session from the index (undoable via refresh/re-index)
ipcMain.handle('session:delete', async (_event, sessionId: string) => {
  try {
    engine.removeSession(sessionId)
    return { success: true }
  } catch (e) {
    throw new Error(`Failed to delete session: ${(e as Error).message}`)
  }
})

// IPC: Archive deletion is disabled by default (G2 — preserve source archives).
// Returns an unsupported error; no filesystem deletion is performed.
// Keep index-only `session:delete` for reversible removal from the search index.
ipcMain.handle('session:deleteFile', async (_event, sessionId: string) => {
  throw new Error(`Archive deletion is not supported: session:deleteFile is disabled (session ${sessionId}). Use session:delete for index-only removal.`)
})

// ── Brainmaxxing IPC handlers ───────────────────────────────────────────
// IPC: Get brain index (session-start injected content)
ipcMain.handle('brain:getIndex', async () => {
  return { ok: true, content: brainIndexMd }
})

// IPC: Rebuild brain index on demand
ipcMain.handle('brain:index', async () => {
  try {
    return brainmaxxing.rebuildIndex()
  } catch (e) {
    throw new Error(`Brain index failed: ${(e as Error).message}`)
  }
})

ipcMain.handle('brain:read', async (_event, relativePath: string) => {
  try {
    return brainmaxxing.brainRead(relativePath)
  } catch (e) {
    throw new Error(`Brain read failed: ${(e as Error).message}`)
  }
})

ipcMain.handle('brain:write', async (_event, relativePath: string, content: string) => {
  try {
    const result = await brainmaxxing.brainWrite(relativePath, content)
    // Keep the in-memory brainIndexMd cache in sync when index.md is written,
    // so brain:getIndex returns fresh content without requiring a restart.
    if (relativePath === 'index.md' && result.ok) {
      brainIndexMd = content
    }
    return result
  } catch (e) {
    throw new Error(`Brain write failed: ${(e as Error).message}`)
  }
})

ipcMain.handle('brain:list', async () => {
  try {
    return brainmaxxing.brainList()
  } catch (e) {
    throw new Error(`Brain list failed: ${(e as Error).message}`)
  }
})
// IPC: Get next serial number tag (#000000-#999999) for vault notes
ipcMain.handle('brain:nextSerial', async () => {
  try {
    return brainmaxxing.brainNextSerial()
  } catch (e) {
    throw new Error(`Brain nextSerial failed: ${(e as Error).message}`)
  }
})

ipcMain.handle('brain:reflect', async (_event, sessionId: string) => {
  try {
    return brainmaxxing.reflect(sessionId, engine)
  } catch (e) {
    throw new Error(`Reflect failed: ${(e as Error).message}`)
  }
})

ipcMain.handle('brain:meditate', async () => {
  try {
    return brainmaxxing.meditate(engine)
  } catch (e) {
    throw new Error(`Meditate failed: ${(e as Error).message}`)
  }
})

ipcMain.handle('brain:ruminate', async () => {
  try {
    return brainmaxxing.ruminate(engine)
  } catch (e) {
    throw new Error(`Ruminate failed: ${(e as Error).message}`)
  }
})

ipcMain.handle('brain:plan', async (_event, task: string) => {
  try {
    return brainmaxxing.plan(task, engine)
  } catch (e) {
    throw new Error(`Plan failed: ${(e as Error).message}`)
  }
})

ipcMain.handle('brain:review', async (_event, content: string) => {
  try {
    return brainmaxxing.review(content, engine)
  } catch (e) {
    throw new Error(`Review failed: ${(e as Error).message}`)
  }
})

// ── Brain Vault window IPC ─────────────────────────────────────────────
ipcMain.handle('brainVault:open', async () => {
  openBrainVaultWindow()
  return { ok: true }
})

ipcMain.handle('brain:dir', async () => {
  return { path: brainmaxxing.BRAIN_DIR }
})

ipcMain.handle('brainVaultWindow:minimize', async () => {
  if (brainVaultWindow) brainVaultWindow.minimize()
  return { ok: true }
})

ipcMain.handle('brainVaultWindow:maximize', async () => {
  if (brainVaultWindow) {
    if (brainVaultWindow.isMaximized()) brainVaultWindow.unmaximize()
    else brainVaultWindow.maximize()
  }
  return { ok: true }
})

ipcMain.handle('brainVaultWindow:close', async () => {
  if (brainVaultWindow) brainVaultWindow.close()
  return { ok: true }
})

ipcMain.handle('brainVaultWindow:setBounds', async (_event, bounds: Electron.Rectangle) => {
  if (brainVaultWindow) {
    try {
      await brainVaultWindow.setBounds(bounds)
      return { ok: true }
    } catch (e) {
      throw new Error(`Failed to set bounds: ${(e as Error).message}`)
    }
  }
  return { ok: false }
})

ipcMain.handle('brainVaultWindow:getBounds', async () => {
  if (brainVaultWindow) {
    try {
      return brainVaultWindow.getBounds()
    } catch (e) {
      throw new Error(`Failed to get bounds: ${(e as Error).message}`)
    }
  }
  return null
})

ipcMain.handle('brain:rename', async (_event, oldPath: string, newPath: string) => {
  try {
    return brainmaxxing.brainRename(oldPath, newPath)
  } catch (e) {
    throw new Error(`Brain rename failed: ${(e as Error).message}`)
  }
})

ipcMain.handle('brain:delete', async (_event, relativePath: string) => {
  try {
    return brainmaxxing.brainDelete(relativePath)
  } catch (e) {
    throw new Error(`Brain delete failed: ${(e as Error).message}`)
  }
})

ipcMain.handle('brain:import', async (_event, sourcePath: string) => {
  try {
    return brainmaxxing.brainImport(sourcePath)
  } catch (e) {
    throw new Error(`Brain import failed: ${(e as Error).message}`)
  }
})

ipcMain.handle('brain:setDir', async (_event, newDir: string) => {
  try {
    brainmaxxing.setBrainDir(newDir)
    return { ok: true, path: brainmaxxing.BRAIN_DIR }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
})

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Markdown files', extensions: ['md'] }],
    title: 'Select .md file(s) to import into Brain Vault'
  })
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths
  }
  return null
})

ipcMain.handle('shell:showItemInFolder', async (_event, fullPath: string) => {
  await electronShell.showItemInFolder(fullPath)
  return { ok: true }
})

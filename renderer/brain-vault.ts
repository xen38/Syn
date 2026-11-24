/**
 * Brain Vault window - standalone draggable/resizable BrowserWindow.
 *
 * Features:
 * - Graph view with force-directed layout of [[wikilink]] notes
 * - Note tabs with inline editing, Save button, dirty-state tracking
 * - Unsaved-changes confirm on tab close / window close
 * - Double-click note tab name to rename document
 * - Drag session from Syn main window onto graph to create .md
 * - Graph background right-click: Create, Create Group, Import, Open Brain folder
 * - Node right-click: Open, Copy, Delete
 */

// === Global error handler: surface any renderer JS errors on screen ===
window.addEventListener('error', (e: ErrorEvent) => {
  const msg = 'Brain Vault renderer error: ' + (e.message || e.error || String(e))
  console.error(msg)
  const el = document.getElementById('bvGraphEmpty')
  if (el) {
    el.textContent = msg
    el.style.display = 'block'
  }
})

window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  const msg = 'Brain Vault unhandled rejection: ' + (event.reason && event.reason.message ? event.reason.message : String(event.reason))
  console.error(msg)
  const el = document.getElementById('bvGraphEmpty')
  if (el) {
    el.textContent = msg
    el.style.display = 'block'
  }
})

// synAPI is exposed via contextBridge by preload.ts; read it from window
const synAPI = window.synAPI

// === Startup diagnostic: show synAPI status on screen ===
function showDiagnostic (msg: string) {
  const el = document.getElementById('bvGraphEmpty')
  if (el) {
    el.textContent = msg
    el.style.display = 'block'
    el.style.color = '#ffaa00'
    el.style.background = '#1a1a1a'
    el.style.padding = '12px'
    el.style.border = '1px solid #333333'
    el.style.borderRadius = '6px'
  }
  if (bvStatusText) bvStatusText.textContent = msg
  console.error('[Brain Vault diagnostic]', msg)
}

// === Update status bar with current state ===
function updateStatus (msg: string) {
  if (bvStatusText) bvStatusText.textContent = msg
  if (bvStatusBar) bvStatusBar.style.display = 'flex'
}

// === DOM elements ===
const bvTabs = document.getElementById('bvTabs') as HTMLElement | null
const bvTabNotes = document.getElementById('bvTabNotes') as HTMLElement | null
const bvBrainIndexContent = document.getElementById('bvBrainIndexContent') as HTMLElement | null

// Graph elements
const bvGraphCanvas = document.getElementById('bvGraphCanvas') as HTMLCanvasElement | null
const bvGraphContainer = document.getElementById('bvGraphContainer') as HTMLElement | null
const bvGraphEmpty = document.getElementById('bvGraphEmpty') as HTMLElement | null
const bvGraphTooltip = document.getElementById('bvGraphTooltip') as HTMLElement | null

// Status bar
const bvStatusBar = document.getElementById('bvStatusBar') as HTMLElement | null
const bvStatusText = document.getElementById('bvStatusText') as HTMLElement | null

// Window controls
const bvBtnClose = document.getElementById('bvBtnClose') as HTMLElement | null
const bvBtnMinimize = document.getElementById('bvBtnMinimize') as HTMLElement | null
const bvBtnMaximize = document.getElementById('bvBtnMaximize') as HTMLElement | null

// Action buttons
const bvBtnCreateNote = document.getElementById('bvBtnCreateNote') as HTMLElement | null
const bvBtnSettings = document.getElementById('bvBtnSettings') as HTMLElement | null

// Context menus
const bvGraphCtxMenu = document.getElementById('bvGraphCtxMenu') as HTMLElement | null
const bvNodeCtxMenu = document.getElementById('bvNodeCtxMenu') as HTMLElement | null
const bvSettingsCtxMenu = document.getElementById('bvSettingsCtxMenu') as HTMLElement | null

// Overlays
const bvConfirmOverlay = document.getElementById('bvConfirmOverlay') as HTMLElement | null
const bvConfirmTitle = document.getElementById('bvConfirmTitle') as HTMLElement | null
const bvConfirmMessage = document.getElementById('bvConfirmMessage') as HTMLElement | null
const bvConfirmCancel = document.getElementById('bvConfirmCancel') as HTMLElement | null
const bvConfirmDiscard = document.getElementById('bvConfirmDiscard') as HTMLElement | null
const bvConfirmSave = document.getElementById('bvConfirmSave') as HTMLElement | null

const bvRenameOverlay = document.getElementById('bvRenameOverlay') as HTMLElement | null
const bvRenameInput = document.getElementById('bvRenameInput') as HTMLInputElement | null
const bvRenameError = document.getElementById('bvRenameError') as HTMLElement | null
const bvRenameCancel = document.getElementById('bvRenameCancel') as HTMLElement | null
const bvRenameSave = document.getElementById('bvRenameSave') as HTMLElement | null

const bvCreateOverlay = document.getElementById('bvCreateOverlay') as HTMLElement | null
const bvCreateInput = document.getElementById('bvCreateInput') as HTMLInputElement | null
const bvCreateError = document.getElementById('bvCreateError') as HTMLElement | null
const bvCreateCancel = document.getElementById('bvCreateCancel') as HTMLElement | null
const bvCreateSave = document.getElementById('bvCreateSave') as HTMLElement | null

const bvImportOverlay = document.getElementById('bvImportOverlay') as HTMLElement | null
const bvImportCancel = document.getElementById('bvImportCancel') as HTMLElement | null
const bvImportFile = document.getElementById('bvImportFile') as HTMLElement | null
const bvImportFolder = document.getElementById('bvImportFolder') as HTMLElement | null

// === State ===
let brainFiles: string[] = []
type BvNode = { id: string; label: string; x: number; y: number; vx: number; vy: number; fixed: boolean; labelY?: number }

let nodes: Map<string, BvNode> = new Map()
let edges: Array<{ source: string; target: string }> = []
let selectedNode: BvNode | null = null
let hoveredNode: BvNode | null = null
let ctxTargetNode: BvNode | null = null

let ctx: CanvasRenderingContext2D | null = null
let scale = 1
let offsetX = 0
let offsetY = 0
let isPanning = false
let panStart = { x: 0, y: 0 }
let isDragging = false
let dragStart = { x: 0, y: 0 }

const MIN_SCALE = 0.3
const MAX_SCALE = 2.5
const ITERATIONS = 200
const REPULSION = 9000
const ATTRACTION = 0.04
const DAMPING = 0.85
const MIN_DIST = 320

// Note editing state
const noteDirty = new Map<string, boolean>()
const noteContentMap = new Map<string, string>()
const noteFileMap = new Map<string, string>()
const notesOpening = new Set<string>()
let pendingCloseTabId: string | null = null

let brainVaultInitialized = false

// === Resize handles (frameless window borders) ===
const resizeHandles = document.querySelectorAll<HTMLElement>('.bv-resize')

// === Resize state ===
let isResizing = false
let resizeEdge = ''
let resizeStart = { x: 0, y: 0 }
let resizeStartBounds = { x: 0, y: 0, width: 0, height: 0 }

// === Resize handle wiring ===
async function startResize (edge: string, e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  isResizing = true
  resizeEdge = edge
  resizeStart = { x: e.clientX, y: e.clientY }
  if (synAPI && typeof synAPI.brainVaultWindowGetBounds === 'function') {
    try {
      const bounds = await synAPI.brainVaultWindowGetBounds() as { x: number; y: number; width: number; height: number } | undefined
      if (bounds) resizeStartBounds = bounds
    } catch (err) {
      // ignore
    }
  }
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeUp)
}

function onResizeMove (e: MouseEvent) {
  if (!isResizing) return
  const dx = e.clientX - resizeStart.x
  const dy = e.clientY - resizeStart.y
  let w = resizeStartBounds.width
  let h = resizeStartBounds.height
  let x = resizeStartBounds.x
  let y = resizeStartBounds.y
  const minW = 600
  const minH = 400
  if (resizeEdge.includes('w')) {
    w = Math.max(minW, w - dx)
    x = resizeStartBounds.x + dx
  }
  if (resizeEdge.includes('e')) {
    w = Math.max(minW, w + dx)
  }
  if (resizeEdge.includes('n')) {
    h = Math.max(minH, h - dy)
    y = resizeStartBounds.y + dy
  }
  if (resizeEdge.includes('s')) {
    h = Math.max(minH, h + dy)
  }
  if (synAPI && typeof synAPI.brainVaultWindowSetBounds === 'function') {
    synAPI.brainVaultWindowSetBounds({ x, y, width: w, height: h }).catch(() => {})
  }
  // Also resize canvas immediately for responsiveness
  resizeCanvas()
}

function onResizeUp () {
  isResizing = false
  resizeEdge = ''
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeUp)
}

resizeHandles.forEach(handle => {
  handle.addEventListener('mousedown', (e: MouseEvent) => {
    const cls = handle.classList
    let edge = ''
    if (cls.contains('bv-resize-n')) edge = 'n'
    else if (cls.contains('bv-resize-s')) edge = 's'
    else if (cls.contains('bv-resize-e')) edge = 'e'
    else if (cls.contains('bv-resize-w')) edge = 'w'
    if (edge) startResize(edge, e)
  })
})

// === Window controls (native OS buttons via IPC) ===
if (bvBtnClose) {
  bvBtnClose.addEventListener('click', async (e: MouseEvent) => {
    e.stopPropagation()
    try {
      if (await checkUnsavedClose()) {
        await synAPI.brainVaultWindowClose()
      }
    } catch (err) {
      showDiagnostic('Close failed: ' + escapeHtmlBv((err as Error).message || String(err)))
    }
  })
}

if (bvBtnMinimize) {
  bvBtnMinimize.addEventListener('click', () => {
    try { synAPI.brainVaultWindowMinimize() } catch (err) {
      showDiagnostic('Minimize failed: ' + escapeHtmlBv((err as Error).message || String(err)))
    }
  })
}

if (bvBtnMaximize) {
  bvBtnMaximize.addEventListener('click', () => {
    try { synAPI.brainVaultWindowMaximize() } catch (err) {
      showDiagnostic('Maximize failed: ' + escapeHtmlBv((err as Error).message || String(err)))
    }
    try { resizeCanvas(); centerGraph() } catch (e) { console.error('bv:maximize error:', e) }
  })
}

// === Escape / click outside closes context menus ===
document.addEventListener('click', (e: MouseEvent) => {
  if (bvGraphCtxMenu && bvGraphCtxMenu.style.display === 'block' && !bvGraphCtxMenu.contains(e.target as Node)) {
    bvGraphCtxMenu.style.display = 'none'
  }
  if (bvNodeCtxMenu && bvNodeCtxMenu.style.display === 'block' && !bvNodeCtxMenu.contains(e.target as Node)) {
    bvNodeCtxMenu.style.display = 'none'
  }
})

document.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Escape') {
    if (bvGraphCtxMenu) bvGraphCtxMenu.style.display = 'none'
    if (bvNodeCtxMenu) bvNodeCtxMenu.style.display = 'none'
    if (bvConfirmOverlay && bvConfirmOverlay.style.display === 'flex') hideConfirm()
    if (bvRenameOverlay && bvRenameOverlay.style.display === 'flex' && !bvRenameOverlay.classList.contains('hidden')) hideRename()
    if (bvCreateOverlay && bvCreateOverlay.style.display === 'flex' && !bvCreateOverlay.classList.contains('hidden')) hideCreate()
    if (bvImportOverlay && bvImportOverlay.style.display === 'flex' && !bvImportOverlay.classList.contains('hidden')) hideImport()
  }
})

// === Initialize ===
let loadBrainVaultRunning = false

// Timeout for IPC calls (ms) — prevents hanging forever if main process
// doesn't respond (e.g. brainList() never resolves).
const IPC_TIMEOUT_MS = 10000

function withTimeout <T> (promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | null = null
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`IPC timeout after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

async function init () {
  try {
    await loadBrainVault()
  } catch (e) {
    console.error('Failed to init brain vault:', e)
    if (bvGraphEmpty) {
      bvGraphEmpty.textContent = 'Failed to load brain vault: ' + escapeHtmlBv((e as Error).message)
      bvGraphEmpty.style.display = 'block'
    }
  }
}

// Prominent startup diagnostic if synAPI bridge is not available.
// This helps distinguish "preload not loaded" from "brainList() failed".
if (!synAPI) {
  showDiagnostic('Brain Vault: synAPI bridge not available (contextBridge may not be exposed in this window). ' +
    'Check that preload.js is loaded and contextBridge.exposeInMainWorld("synAPI", ...) is called.')
  if (bvStatusText) bvStatusText.textContent = 'synAPI bridge not available'
}

// Re-run loadBrainVault once the BrowserWindow is actually shown so the graph
// canvas gets a real size (it's 0x0 while the window is hidden). window.onload
// fires after show(), so this is the reliable trigger; onBvWindowShown is a
// secondary trigger in case the IPC lands first.
window.addEventListener('load', () => {
  try {
    // loadBrainVault already ran during init() (with canvas possibly at
    // fallback size while the window was hidden). Now that the window is
    // shown, force a canvas resize + center so the graph is centered on
    // the real canvas dimensions.
    resizeCanvas()
    centerGraph()
  } catch (e) { console.error('Brain vault onload error:', e) }
})

window.addEventListener('resize', () => { resizeCanvas(); recenterGraph() })

// Only wire up the window-shown trigger if synAPI is available.
// If synAPI is undefined (contextBridge not exposed), init() will still
// attempt loadBrainVault() on its own (but will show the diagnostic above).
if (synAPI && typeof synAPI.onBvWindowShown === 'function') {
  synAPI.onBvWindowShown(() => {
    try {
      resizeCanvas()
      centerGraph()
    } catch (e) { console.error('Brain vault window-shown error:', e) }
  })
} else {
  console.warn('synAPI not available - Brain Vault IPC features will be limited')
}

// Handle fullscreen toggle: recenter graph when entering or leaving fullscreen
// (Electron may not fire a resize event on fullscreen toggle on Windows)
if (synAPI && typeof synAPI.onBvEnterFullscreen === 'function') {
  synAPI.onBvEnterFullscreen(() => {
    try { resizeCanvas(); centerGraph() } catch (e) { console.error('bv:enter-fullscreen error:', e) }
  })
  synAPI.onBvLeaveFullscreen(() => {
    try { resizeCanvas(); centerGraph() } catch (e) { console.error('bv:leave-fullscreen error:', e) }
  })
}

// Kick off loadBrainVault directly so the graph starts even if window.onload
// or the bv:window-shown IPC races past before listeners are registered.
// window.onload and onBvWindowShown remain as re-triggers for correctness.
init()

// === Load brain vault ===
async function loadBrainVault () {
  // Guard against concurrent execution (init() + onload + onBvWindowShown can race)
  if (loadBrainVaultRunning) {
    console.log('[Brain Vault] loadBrainVault already running, skipping duplicate call')
    return
  }
  loadBrainVaultRunning = true

  try {
    if (!synAPI) {
      showDiagnostic('Brain Vault: synAPI bridge not available (contextBridge may not be exposed in this window).')
      loadBrainVaultRunning = false
      return
    }

    if (!bvGraphCanvas || !bvGraphContainer || !bvGraphEmpty) {
      showDiagnostic('Brain Vault: required DOM elements missing.')
      loadBrainVaultRunning = false
      return
    }

    let files: string[]
    try {
      files = await withTimeout(synAPI.brainList() as Promise<string[]>, IPC_TIMEOUT_MS)
    } catch (e) {
      showDiagnostic('Brain Vault: brainList() failed - ' + escapeHtmlBv((e as Error).message))
      loadBrainVaultRunning = false
      return
    }
    brainFiles = files || []
    updateStatus('synAPI OK . ' + brainFiles.length + ' vault files')

    if (brainFiles.length === 0) {
      showDiagnostic('Brain Vault: brainList() returned 0 files. Check that brain/ directory exists at ' + (synAPI.brainDir ? (await synAPI.brainDir() as { path: string }).path : 'unknown'))
      if (bvGraphCanvas) bvGraphCanvas.style.display = 'none'
      if (bvGraphEmpty) bvGraphEmpty.style.display = 'block'
      loadBrainVaultRunning = false
      return
    }
    ctx = bvGraphCanvas.getContext('2d')

    if (!brainFiles || brainFiles.length === 0) {
      if (bvGraphCanvas) bvGraphCanvas.style.display = 'none'
      if (bvGraphEmpty) bvGraphEmpty.style.display = 'block'
      return
    }

    if (bvGraphCanvas) bvGraphCanvas.style.display = 'block'
    if (bvGraphEmpty) bvGraphEmpty.style.display = 'none'

    // Read each file and extract [[wikilink]] references
    nodes = new Map()
    edges = []

    for (const file of brainFiles) {
      nodes.set(file, { id: file, label: file.replace(/\.md$/, ''), x: 0, y: 0, vx: 0, vy: 0, fixed: false })
    }

    for (const file of brainFiles) {
      let result: { ok?: boolean; content?: string; error?: string }
      try {
        result = await synAPI.brainRead(file) as { ok?: boolean; content?: string; error?: string }
      } catch (e) {
        console.error('Failed to read ' + file + ':', e)
        continue
      }
      if (!result.ok) continue
      const content = result.content || ''
      const linkRe = /\[\[([^\]]+)\]\]/g
      let match: RegExpExecArray | null
      while ((match = linkRe.exec(content)) !== null) {
        const target = match[1].replace(/\.md$/, '')
        const targetFile = nodes.has(target + '.md')
          ? target + '.md'
          : nodes.has(target) ? target : null
        if (targetFile && targetFile !== file) {
          edges.push({ source: file, target: targetFile })
        }
      }
    }

    // Resize canvas first so layout can fall back to canvas dimensions
    // when the container hasn't laid out yet (0x0 client size).
    resizeCanvas()

    // Force-directed layout
    const nodeArr = Array.from(nodes.values())
    const centerX = (bvGraphContainer.clientWidth || bvGraphCanvas!.width) / 2
    const centerY = (bvGraphContainer.clientHeight || bvGraphCanvas!.height) / 2

    nodeArr.forEach((n, i) => {
      // Place nodes inside a round form, not just on the perimeter.
      // Vary radius so it's not a perfect circle; place some nodes inside.
      const angle = (i / nodeArr.length) * 2 * Math.PI + (Math.random() - 0.5) * 0.8
      const baseR = Math.min(centerX, centerY) * 0.3
      const r = baseR * (0.45 + Math.random() * 0.55) // 45%-100% of base radius
      n.x = centerX + Math.cos(angle) * r
      n.y = centerY + Math.sin(angle) * r
      n.vx = 0
      n.vy = 0
    })

    for (let iter = 0; iter < ITERATIONS; iter++) {
      for (let i = 0; i < nodeArr.length; i++) {
        for (let j = i + 1; j < nodeArr.length; j++) {
          const a = nodeArr[i]
          const b = nodeArr[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist2 = dx * dx + dy * dy
          const dist = Math.sqrt(dist2) || 1
          const force = REPULSION / dist2
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          a.vx += fx
          a.vy += fy
          b.vx -= fx
          b.vy -= fy
        }
      }

      for (const e of edges) {
        const a = nodes.get(e.source)
        const b = nodes.get(e.target)
        if (!a || !b) continue
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = (dist - MIN_DIST) * ATTRACTION
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        a.vx += fx
        a.vy += fy
        b.vx -= fx
        b.vy -= fy
      }

      for (const n of nodeArr) {
        n.vx *= DAMPING
        n.vy *= DAMPING
        const dx = centerX - n.x
        const dy = centerY - n.y
        n.vx += dx * 0.005
        n.vy += dy * 0.005
        n.x += n.vx
        n.y += n.vy
      }
    }

    // Center the initial graph layout on the canvas
    centerGraph()

    // Draw now so the graph appears even when loadBrainVault() runs after the
    // window has been shown (the canvas was 0x0 on the first hidden run).
    updateStatus('synAPI OK . ' + brainFiles.length + ' files . ' + nodes.size + ' nodes . ' + edges.length + ' links . canvas ' + bvGraphCanvas!.width + 'x' + bvGraphCanvas!.height)
    render()

    // === Idempotency: event listeners once ===
    if (!brainVaultInitialized) {
      brainVaultInitialized = true

      // === Mouse interactions ===
      if (bvGraphCanvas) {
        bvGraphCanvas.addEventListener('mousedown', (e: MouseEvent) => {
          // Middle-click: start panning the canvas
          if (e.button === 1) {
            e.preventDefault()
            e.stopPropagation()
            isPanning = true
            panStart = { x: e.clientX, y: e.clientY }
            bvGraphCanvas.style.cursor = 'move'
            return
          }
          // Right-click opens background menu
          if (e.button === 2) {
            e.preventDefault()
            const rect = bvGraphCanvas.getBoundingClientRect()
            const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
            const node = getNodeAt(world.x, world.y)
            if (node) {
              // Node right-click: show node menu
              e.stopPropagation()
              ctxTargetNode = node
              showNodeMenu(e.clientX, e.clientY)
            } else {
              // Background right-click: show graph menu
              e.stopPropagation()
              showGraphMenu(e.clientX, e.clientY)
            }
            return
          }

          const rect = bvGraphCanvas.getBoundingClientRect()
          const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
          const node = getNodeAt(world.x, world.y)
          if (node) {
            e.preventDefault()
            e.stopPropagation()
            selectedNode = node
            openNote(node.id)
            isDragging = false
          } else {
            isDragging = true
            dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top }
          }
        })

        bvGraphCanvas.addEventListener('mousemove', (e: MouseEvent) => {
          const rect = bvGraphCanvas.getBoundingClientRect()
          const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
          const node = getNodeAt(world.x, world.y)
          hoveredNode = node
          bvGraphCanvas.style.cursor = node ? 'pointer' : 'grab'
          if (node) {
            const s = worldToScreen(node.x, node.y)
            if (bvGraphTooltip) {
              bvGraphTooltip.style.display = 'block'
              bvGraphTooltip.style.left = (s.x + 18) + 'px'
              bvGraphTooltip.style.top = (s.y - 28) + 'px'
              bvGraphTooltip.textContent = node.label
            }
          } else {
            if (bvGraphTooltip) bvGraphTooltip.style.display = 'none'
          }
          if (isPanning) {
            offsetX += (e.clientX - panStart.x) / scale
            offsetY += (e.clientY - panStart.y) / scale
            panStart = { x: e.clientX, y: e.clientY }
          } else if (isDragging) {
            offsetX += (e.clientX - rect.left - dragStart.x) / scale
            offsetY += (e.clientY - rect.top - dragStart.y) / scale
            dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top }
          }
        })

        bvGraphCanvas.addEventListener('mouseup', (_e: MouseEvent) => {
          isDragging = false
          isPanning = false
          bvGraphCanvas.style.cursor = 'grab'
        })

        bvGraphCanvas.addEventListener('wheel', (e: WheelEvent) => {
          e.preventDefault()
          const rect = bvGraphCanvas.getBoundingClientRect()
          const worldBefore = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
          const delta = -e.deltaY * 0.001
          let newScale = scale * (1 + delta)
          newScale = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE)
          const worldAfter = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
          offsetX += worldBefore.x - worldAfter.x
          offsetY += worldBefore.y - worldAfter.y
          scale = newScale
        }, { passive: false })
      }

      // Zoom controls
      const zoomIn = document.getElementById('bvGraphZoomIn') as HTMLElement | null
      const zoomOut = document.getElementById('bvGraphZoomOut') as HTMLElement | null
      const zoomReset = document.getElementById('bvGraphReset') as HTMLElement | null
      const zoomVal = document.getElementById('bvGraphZoomVal') as HTMLElement | null

      if (zoomIn) {
        zoomIn.addEventListener('click', () => {
          scale = Math.min(scale * 1.2, MAX_SCALE)
          if (zoomVal) zoomVal.textContent = Math.round(scale * 100).toString()
          updateStatusBarCanvasDims()
        })
      }
      if (zoomOut) {
        zoomOut.addEventListener('click', () => {
          scale = Math.max(scale / 1.2, MIN_SCALE)
          if (zoomVal) zoomVal.textContent = Math.round(scale * 100).toString()
          updateStatusBarCanvasDims()
        })
      }
      if (zoomReset) {
        zoomReset.addEventListener('click', () => {
          centerGraph()
        })
      }
    } // end idempotency guard
  } finally {
    loadBrainVaultRunning = false
  }
}

// === Resize canvas ===
function resizeCanvas () {
  let w = bvGraphContainer ? bvGraphContainer.clientWidth : 0
  let h = bvGraphContainer ? bvGraphContainer.clientHeight : 0
  // Fallback to window dimensions when the flex chain hasn't laid out yet
  // (body has height:100% but no display:flex, so container can report 0x0).
  if (!w || !h) {
    const rect = bvGraphContainer ? bvGraphContainer.getBoundingClientRect() : { width: 0, height: 0 }
    w = rect.width || window.innerWidth || 900
    h = rect.height || Math.max(window.innerHeight - 120, 400)
  }
  // Ensure minimum dimensions so the canvas is never 0x0
  w = Math.max(w, 400)
  h = Math.max(h, 300)
  if (bvGraphCanvas && (bvGraphCanvas.width !== w || bvGraphCanvas.height !== h)) {
    bvGraphCanvas.width = w
    bvGraphCanvas.height = h
    // Recenter graph when canvas size changes (e.g. fullscreen/resize)
    if (nodes.size > 0) {
      offsetX = 0
      offsetY = 0
      recenterGraph()
    }
  }
}

// Recenter all nodes around the canvas center (keeps relative layout).
// Does NOT reset pan/zoom - call centerGraph() for a full reset.
function recenterGraph () {
  if (nodes.size === 0) return
  const cx = bvGraphCanvas ? bvGraphCanvas.width / 2 : 0
  const cy = bvGraphCanvas ? bvGraphCanvas.height / 2 : 0
  const nodeArr = Array.from(nodes.values())
  // Compute current average position
  let sumX = 0
  let sumY = 0
  nodeArr.forEach(n => { sumX += n.x; sumY += n.y })
  const avgX = sumX / nodeArr.length
  const avgY = sumY / nodeArr.length
  // Shift all nodes so average lands at canvas center
  const dx = cx - avgX
  const dy = cy - avgY
  nodeArr.forEach(n => { n.x += dx; n.y += dy })
}

// Full center/reset: reset pan and zoom, then recenter nodes.
function centerGraph () {
  scale = 1
  offsetX = 0
  offsetY = 0
  recenterGraph()
  const zoomEl = document.getElementById('bvGraphZoomVal')
  if (zoomEl) zoomEl.textContent = '100'
  updateStatusBarCanvasDims()
}

// === Update canvas dims portion of status bar ===
function updateStatusBarCanvasDims () {
  if (!bvStatusText) return
  const zoomPct = document.getElementById('bvGraphZoomVal')
  const zoom = zoomPct ? zoomPct.textContent : '100'
  // Preserve existing brain vault status text, just refresh canvas dims
  const current = bvStatusText.textContent
  // Remove any previous canvas dims segment
  const cleaned = current.replace(/ . canvas \d+x\d+ . zoom \d+%/, '')
  bvStatusText.textContent = cleaned + ' . canvas ' + (bvGraphCanvas ? bvGraphCanvas.width : 0) + 'x' + (bvGraphCanvas ? bvGraphCanvas.height : 0) + ' . zoom ' + zoom + '%'
}

function worldToScreen (x: number, y: number) {
  return { x: (x + offsetX) * scale, y: (y + offsetY) * scale }
}
function screenToWorld (x: number, y: number) {
  return { x: x / scale - offsetX, y: y / scale - offsetY }
}

function getNodeAt (wx: number, wy: number) {
  for (const n of nodes.values()) {
    const dx = n.x - wx
    const dy = n.y - wy
    if (dx * dx + dy * dy < 40 * 40) return n
  }
  return null
}

function drawNode (ctx: CanvasRenderingContext2D, n: { id: string; label: string; x: number; y: number; vx: number; vy: number; fixed: boolean; labelY?: number }, isHover: boolean, isSelected: boolean) {
  const s = worldToScreen(n.x, n.y)
  const r = 14
  ctx.beginPath()
  ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
  ctx.fillStyle = isSelected ? '#53C68B' : (isHover ? '#4a90e2' : '#6b7280')
  ctx.fill()
  ctx.strokeStyle = isSelected || isHover ? '#53C68B' : '#9ca3af'
  ctx.lineWidth = 2
  ctx.stroke()
  // Draw label with collision-avoided vertical offset
  const labelY = n.labelY !== undefined ? n.labelY : s.y + r + 14
  ctx.fillStyle = '#cccccc'
  ctx.font = '11px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(n.label, s.x, labelY)
}

// === Resolve label overlaps by nudging labels vertically ===
function resolveLabelOverlaps () {
  const nodeArr = Array.from(nodes.values())
  const labelH = 14 // approximate label height in screen px
  const labelGap = 6 // minimum gap between labels
  // Initialize labelY for each node
  for (const n of nodeArr) {
    const s = worldToScreen(n.x, n.y)
    ;(n as { labelY?: number }).labelY = s.y + 14 + labelH / 2
  }
  // Iteratively resolve overlaps
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < nodeArr.length; i++) {
      for (let j = i + 1; j < nodeArr.length; j++) {
        const a = nodeArr[i]
        const b = nodeArr[j]
        const sa = worldToScreen(a.x, a.y)
        const sb = worldToScreen(b.x, b.y)
        const dx = Math.abs(sa.x - sb.x)
        const dy = Math.abs((a as { labelY?: number }).labelY! - (b as { labelY?: number }).labelY!)
        // Labels overlap horizontally if centers are close enough
        if (dx < 90) {
          const overlap = labelH + labelGap - dy
          if (overlap > 0) {
            const move = overlap / 2
            if ((a as { labelY?: number }).labelY! <= (b as { labelY?: number }).labelY!) {
              ;(a as { labelY?: number }).labelY! -= move
              ;(b as { labelY?: number }).labelY! += move
            } else {
              ;(a as { labelY?: number }).labelY! += move
              ;(b as { labelY?: number }).labelY! -= move
            }
          }
        }
      }
    }
  }
}

function drawEdge (ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }) {
  const sa = worldToScreen(a.x, a.y)
  const sb = worldToScreen(b.x, b.y)
  const gradient = ctx.createLinearGradient(sa.x, sa.y, sb.x, sb.y)
  gradient.addColorStop(0, '#4f46e5')
  gradient.addColorStop(1, '#7c3aed')
  const cx = (sa.x + sb.x) / 2
  const cy = (sa.y + sb.y) / 2
  const dx = sb.x - sa.x
  const dy = sb.y - sa.y
  const dist = Math.sqrt(dx * dx + dy * dy) || 1
  const perpX = -dy / dist
  const perpY = dx / dist
  const curve = Math.min(dist * 0.25, 60)
  ctx.beginPath()
  ctx.moveTo(sa.x, sa.y)
  ctx.bezierCurveTo(
    cx + perpX * curve, cy + perpY * curve,
    cx + perpX * curve, cy + perpY * curve,
    sb.x, sb.y
  )
  ctx.strokeStyle = gradient
  ctx.lineWidth = 1.5
  ctx.stroke()
}

function render () {
  if (!ctx) return
  // Ensure canvas is always sized correctly, even if loadBrainVault() ran
  // while the container had 0x0 dimensions (flex chain not yet laid out).
  resizeCanvas()
  ctx.clearRect(0, 0, bvGraphCanvas!.width, bvGraphCanvas!.height)

  // Fallback: if no nodes, draw a centered hint on the canvas
  if (nodes.size === 0) {
    ctx.fillStyle = '#666666'
    ctx.font = '14px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('No vault notes yet. Right-click graph to Create or Import.', bvGraphCanvas!.width / 2, bvGraphCanvas!.height / 2)
    requestAnimationFrame(render)
    return
  }

  // Diagnostic: check if all nodes are off-canvas in screen space
  // (accounting for pan offset and zoom). Only warn if every node is off-screen,
  // which indicates a real layout problem rather than normal panning.
  const nodeArr = Array.from(nodes.values())
  let allOffScreen = true
  for (const n of nodeArr) {
    const s = worldToScreen(n.x, n.y)
    if (s.x >= -50 && s.x <= bvGraphCanvas!.width + 50 &&
        s.y >= -50 && s.y <= bvGraphCanvas!.height + 50) {
      allOffScreen = false
      break
    }
  }
  if (allOffScreen && bvGraphCanvas!.width > 0 && bvGraphCanvas!.height > 0) {
    showDiagnostic('Render warning: ' + nodeArr.length + ' nodes off-canvas (canvas ' + bvGraphCanvas!.width + 'x' + bvGraphCanvas!.height + ')')
  }

  // Resolve label overlaps before drawing
  resolveLabelOverlaps()

  const seenEdges = new Set<string>()
  for (const e of edges) {
    const key = e.source + '->' + e.target
    if (seenEdges.has(key)) continue
    seenEdges.add(key)
    const a = nodes.get(e.source)
    const b = nodes.get(e.target)
    if (a && b) drawEdge(ctx, a, b)
  }

  for (const n of Array.from(nodes.values())) {
    drawNode(ctx, n, n === hoveredNode, n === selectedNode)
  }

  requestAnimationFrame(render)
}

// === Render note content ===
function renderNoteContent (file: string, content: string) {
  let html = escapeHtmlBv(content)
  html = html.replace(/\[\[([^\]]+)\]\]/g, (match, link) => {
    const label = link.replace(/\.md$/, '')
    return '<span class="wiki-link" data-link="' + escapeHtmlBv(label) + '">' + escapeHtmlBv(label) + '</span>'
  })
  html = html.replace(/\n/g, '<br>')
  return html
}

// === Open a note in a new tab ===
async function openNote (file: string) {
  // If already open, switch to it
  const tabId = 'note-' + escapeCssId(file)
  const existingTab = document.querySelector('.brain-vault-tab[data-tab="' + tabId + '"]')
  if (existingTab) {
    switchBvTab(tabId)
    return
  }

  // Prevent duplicate concurrent opens of the same file
  if (notesOpening.has(file)) return
  notesOpening.add(file)
  try {
    const result = await synAPI.brainRead(file) as { ok?: boolean; content?: string; error?: string }
    if (!result.ok) {
      alert('Failed to read ' + file + ': ' + result.error)
      return
    }

    // Check again after async read - another call may have created the tab while we waited
    const existingTab2 = document.querySelector('.brain-vault-tab[data-tab="' + tabId + '"]')
    if (existingTab2) {
      switchBvTab(tabId)
      return
    }

    const content = result.content || ''
    const label = file.replace(/\.md$/, '')
    const html = renderNoteContent(file, content)

    createBvTab(tabId, label, html, file, content)
    switchBvTab(tabId)
  } finally {
    notesOpening.delete(file)
  }
}

// === Create a brain vault tab ===
function createBvTab (tabId: string, label: string, html: string, file: string, content: string) {
  // Deactivate all tabs
  document.querySelectorAll('.brain-vault-tab').forEach(tab => tab.classList.remove('active'))
  document.querySelectorAll('.brain-vault-tab-content').forEach(c => c.classList.remove('active'))

  // Create tab button with label + Edit button + close X
  const tabBtn = document.createElement('button')
  tabBtn.className = 'brain-vault-tab active'
  tabBtn.dataset.tab = tabId
  tabBtn.innerHTML =
    '<span class="bv-tab-label">' + escapeHtmlBv(label) + '</span>' +
    ' <button class="bv-edit-btn" data-tab="' + tabId + '" title="Edit this note">e</button>' +
    ' <span class="tab-close" data-tab="' + tabId + '">&#215;</span>'

  // Create content div
  const contentDiv = document.createElement('div')
  contentDiv.className = 'brain-vault-tab-content active brain-vault-note-content'
  contentDiv.dataset.tab = tabId
  contentDiv.innerHTML = html

  if (bvTabs) bvTabs.appendChild(tabBtn)
  if (bvTabNotes) bvTabNotes.appendChild(contentDiv)

  // Track state
  noteFileMap.set(tabId, file)
  noteContentMap.set(tabId, content)
  noteDirty.set(tabId, false)

  // Wire up wikilink clicks
  contentDiv.querySelectorAll<HTMLElement>('.wiki-link').forEach(link => {
    link.addEventListener('click', (e: MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const targetFile = link.dataset.link + '.md'
      openNote(targetFile)
    })
  })

  // === Double-click tab label to rename ===
  const labelSpan = tabBtn.querySelector<HTMLElement>('.bv-tab-label')
  if (labelSpan) {
    labelSpan.addEventListener('dblclick', (e: MouseEvent) => {
      e.stopPropagation()
      startRename(tabId, file, labelSpan)
    })
  }

  // Edit button: open edit mode with Save button beside tab label
  const editBtn = tabBtn.querySelector<HTMLElement>('.bv-edit-btn')
  if (editBtn) {
    editBtn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation()
      if (noteDirty.get(tabId)) return // already editing
      startEditMode(contentDiv, tabId, file)
    })
  }

  // Tab close button
  const closeBtn = tabBtn.querySelector<HTMLElement>('.tab-close')
  if (closeBtn) {
    closeBtn.addEventListener('click', (e: MouseEvent) => {
      e.stopPropagation()
      closeNoteTab(tabId)
    })
  }

  // Tab click to switch (not on edit button or close)
  tabBtn.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.classList.contains('bv-edit-btn')) return
    if (target.classList.contains('tab-close')) return
    switchBvTab(tabId)
  })
}

// === Start inline edit mode ===
function startEditMode (contentDiv: HTMLElement, tabId: string, _file: string) {
  if (noteDirty.get(tabId)) return // already editing

  // Mark dirty immediately (synchronously) to prevent re-entering edit mode on the same tab
  noteDirty.set(tabId, true)

  const currentContent = noteContentMap.get(tabId) || ''
  const textarea = document.createElement('textarea')
  textarea.className = 'bv-note-editor'
  textarea.value = currentContent
  textarea.style.width = '100%'
  textarea.style.height = '100%'
  textarea.style.minHeight = '400px'
  textarea.style.fontFamily = 'ui-monospace, SFMono-Regular, Consolas, monospace'
  textarea.style.fontSize = '13px'
  textarea.style.lineHeight = '1.6'
  textarea.style.background = '#0a0a0a'
  textarea.style.color = '#cccccc'
  textarea.style.border = 'none'
  textarea.style.outline = 'none'
  textarea.style.padding = '0'
  textarea.style.resize = 'vertical'

  // Save button appears beside doc name
  const tabBtn = document.querySelector('.brain-vault-tab[data-tab="' + tabId + '"]') as HTMLElement | null
  const saveBtn = document.createElement('button')
  saveBtn.className = 'bv-save-btn'
  saveBtn.title = 'Save changes'
  saveBtn.textContent = 'Save'
  saveBtn.style.display = 'inline-block'
  saveBtn.style.marginLeft = '8px'
  saveBtn.style.padding = '2px 8px'
  saveBtn.style.fontSize = '11px'
  saveBtn.style.background = '#53C68B'
  saveBtn.style.color = '#000'
  saveBtn.style.border = 'none'
  saveBtn.style.borderRadius = '4px'
  saveBtn.style.cursor = 'pointer'

  const labelSpan = tabBtn?.querySelector('.bv-tab-label') as HTMLElement | null
  if (labelSpan) {
    labelSpan.style.display = 'inline-flex'
    labelSpan.style.alignItems = 'center'
    labelSpan.appendChild(saveBtn)
  }

  // Replace content with textarea
  contentDiv.innerHTML = ''
  contentDiv.appendChild(textarea)
  textarea.focus()

  // Track dirty state
  textarea.addEventListener('input', () => {
    const newVal = textarea.value
    noteContentMap.set(tabId, newVal)
    noteDirty.set(tabId, newVal !== (noteFileMap.get(tabId) ? '' : ''))
    // Compare against original by re-reading? Simpler: mark dirty on any change
    noteDirty.set(tabId, true)
    if (saveBtn) saveBtn.style.display = 'inline-block'
  })

  saveBtn.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation()
    saveNote(tabId, textarea.value)
  })

  // Click outside textarea to stop editing? Keep editing until Save or switch tab.
}

// === Save a note ===
async function saveNote (tabId: string, content: string) {
  const file = noteFileMap.get(tabId)
  if (!file) return

  const result = await synAPI.brainWrite(file, content) as { ok?: boolean; error?: string }
  if (result.ok) {
    noteContentMap.set(tabId, content)
    noteDirty.set(tabId, false)
    const saveBtn = document.querySelector('.bv-save-btn') as HTMLElement | null
    if (saveBtn) saveBtn.style.display = 'none'

    // Re-render content as read-only
    const contentDiv = document.querySelector('.brain-vault-tab-content[data-tab="' + tabId + '"]') as HTMLElement | null
    const html = renderNoteContent(file, content)
    if (contentDiv) contentDiv.innerHTML = html

    // Re-wire wiki links
    if (contentDiv) {
      contentDiv.querySelectorAll<HTMLElement>('.wiki-link').forEach(link => {
        link.addEventListener('click', (e: MouseEvent) => {
          e.preventDefault()
          e.stopPropagation()
          const targetFile = link.dataset.link + '.md'
          openNote(targetFile)
        })
      })
    }
  } else {
    alert('Save failed: ' + result.error)
  }
}

// === Close a note tab ===
function closeNoteTab (tabId: string) {
  if (noteDirty.get(tabId)) {
    pendingCloseTabId = tabId
    if (bvConfirmTitle) bvConfirmTitle.textContent = 'Unsaved changes'
    if (bvConfirmMessage) bvConfirmMessage.textContent = 'This document has been edited; are you sure you don\'t want to [proceed]?'
    if (bvConfirmOverlay) bvConfirmOverlay.style.display = 'flex'
    return
  }
  doCloseTab(tabId)
}

if (bvConfirmCancel) {
  bvConfirmCancel.addEventListener('click', () => {
    hideConfirm()
    pendingCloseTabId = null
  })
}

if (bvConfirmDiscard) {
  bvConfirmDiscard.addEventListener('click', () => {
    hideConfirm()
    if (pendingCloseTabId) {
      doCloseTab(pendingCloseTabId)
      pendingCloseTabId = null
    }
  })
}

if (bvConfirmSave) {
  bvConfirmSave.addEventListener('click', async () => {
    hideConfirm()
    if (pendingCloseTabId) {
      const content = noteContentMap.get(pendingCloseTabId) || ''
      await saveNote(pendingCloseTabId, content)
      doCloseTab(pendingCloseTabId)
      pendingCloseTabId = null
    }
  })
}

function doCloseTab (tabId: string) {
  const tabBtn = document.querySelector('.brain-vault-tab[data-tab="' + tabId + '"]') as HTMLElement | null
  const content = document.querySelector('.brain-vault-tab-content[data-tab="' + tabId + '"]') as HTMLElement | null
  if (tabBtn) tabBtn.remove()
  if (content) content.remove()

  noteDirty.delete(tabId)
  noteContentMap.delete(tabId)
  noteFileMap.delete(tabId)

  const activeTab = document.querySelector('.brain-vault-tab.active')
  if (!activeTab) {
    const vaultTab = document.querySelector('.brain-vault-tab[data-tab="vault"]') as HTMLElement | null
    if (vaultTab) switchBvTab('vault')
    else {
      const indexTab = document.querySelector('.brain-vault-tab[data-tab="index"]') as HTMLElement | null
      if (indexTab) switchBvTab('index')
    }
  }
}

// === Switch tab ===
function switchBvTab (tabId: string) {
  document.querySelectorAll<HTMLElement>('.brain-vault-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabId)
  })
  document.querySelectorAll<HTMLElement>('.brain-vault-tab-content').forEach(content => {
    content.classList.toggle('active', content.dataset.tab === tabId)
  })
}

// === Double-click rename ===
function startRename (tabId: string, oldFile: string, labelSpan: HTMLElement) {
  if (bvRenameInput) bvRenameInput.value = oldFile.replace(/\.md$/, '')
  if (bvRenameError) { bvRenameError.style.display = 'none' }
  if (bvRenameOverlay) { bvRenameOverlay.style.display = 'flex' }
  if (bvRenameOverlay) bvRenameOverlay.classList.remove('hidden')
  if (bvRenameInput) bvRenameInput.focus()

  const onRenameSave = async () => {
    const newName = (bvRenameInput ? bvRenameInput.value : '').trim()
    if (!newName) {
      if (bvRenameError) {
        bvRenameError.textContent = 'Name cannot be empty'
        bvRenameError.style.display = 'block'
      }
      return
    }
    const newFile = newName.endsWith('.md') ? newName : newName + '.md'
    const result = await synAPI.brainRename(oldFile, newFile) as { ok?: boolean; error?: string }
    if (result.ok) {
      hideRename()
      // Update tab label
      labelSpan.textContent = newFile.replace(/\.md$/, '')
      // Update file map
      noteFileMap.set(tabId, newFile)
      // Refresh graph to reflect rename
      await loadBrainVault()
    } else {
      if (bvRenameError) {
        bvRenameError.textContent = result.error ?? ''
        bvRenameError.style.display = 'block'
      }
    }
  }

  if (bvRenameSave) {
    bvRenameSave.onclick = onRenameSave
  }
  if (bvRenameCancel) {
    bvRenameCancel.onclick = hideRename
  }

  if (bvRenameInput) {
    bvRenameInput.addEventListener('keydown', function enterHandler (e: KeyboardEvent) {
      if (e.key === 'Enter') {
        e.preventDefault()
        bvRenameInput.blur()
        onRenameSave()
      }
    }, { once: true })
  }
}

function hideRename () {
  if (bvRenameOverlay) { bvRenameOverlay.style.display = 'none' }
  if (bvRenameOverlay) bvRenameOverlay.classList.add('hidden')
}

// === Tab switching event delegation ===
if (bvTabs) {
  bvTabs.addEventListener('click', (e: Event) => {
    const closeBtn = (e.target as Element).closest('.tab-close') as HTMLElement | null
    if (closeBtn) {
      e.stopPropagation()
      closeNoteTab(closeBtn.dataset.tab || '')
      return
    }
    const tab = (e.target as Element).closest('.brain-vault-tab') as HTMLElement | null
    if (!tab) return
    if ((e.target as Element).classList.contains('bv-save-btn')) return
    e.stopPropagation()
    switchBvTab(tab.dataset.tab || '')
    if (tab.dataset.tab === 'index') {
      loadBrainIndexContent()
    }
  })
}

// === Load brain index content ===
async function loadBrainIndexContent () {
  try {
    const result = await synAPI.brainRead('index.md') as { ok?: boolean; content?: string; error?: string }
    if (result.ok && bvBrainIndexContent) {
      bvBrainIndexContent.innerHTML = renderNoteContent('index.md', result.content || '')
      bvBrainIndexContent.querySelectorAll('.wiki-link').forEach(link => {
        const linkEl = link as HTMLElement
        linkEl.addEventListener('click', (e: MouseEvent) => {
          e.preventDefault()
          const targetFile = linkEl.dataset.link + '.md'
          openNote(targetFile)
        })
      })
    } else {
      const idx = await synAPI.getBrainIndex() as { content?: string }
      if (bvBrainIndexContent) bvBrainIndexContent.textContent = idx.content || '(brain index empty - rebuild via /brain index)'
    }
  } catch (e) {
    console.error('Failed to load brain index:', e)
    if (bvBrainIndexContent) bvBrainIndexContent.textContent = '(brain index unavailable)'
  }
}

// === Create new note ===
if (bvBtnCreateNote) {
  bvBtnCreateNote.addEventListener('click', () => {
    showCreate()
  })
}

// === Settings button ===
let settingsMenuOpen = false
if (bvBtnSettings) {
  bvBtnSettings.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (bvGraphCtxMenu) bvGraphCtxMenu.style.display = 'none'
    if (bvNodeCtxMenu) bvNodeCtxMenu.style.display = 'none'
    if (bvSettingsCtxMenu) {
      if (settingsMenuOpen) {
        bvSettingsCtxMenu.style.display = 'none'
        settingsMenuOpen = false
        return
      }
      const rect = bvBtnSettings.getBoundingClientRect()
      bvSettingsCtxMenu.style.left = (rect.left - 150) + 'px'
      bvSettingsCtxMenu.style.top = (rect.bottom + 5) + 'px'
      bvSettingsCtxMenu.style.display = 'block'
      settingsMenuOpen = true
    }
  })
}

// Close settings menu when clicking outside
document.addEventListener('click', (e: MouseEvent) => {
  if (settingsMenuOpen && bvSettingsCtxMenu && !bvSettingsCtxMenu.contains(e.target as Node) && e.target !== bvBtnSettings) {
    bvSettingsCtxMenu.style.display = 'none'
    settingsMenuOpen = false
  }
})

// === Settings menu actions ===
if (bvSettingsCtxMenu) {
  const changeDirBtn = document.getElementById('bvCtxSettingsChangeDir') as HTMLElement | null
  const rebuildIndexBtn = document.getElementById('bvCtxSettingsRebuildIndex') as HTMLElement | null
  const editIndexBtn = document.getElementById('bvCtxSettingsEditIndex') as HTMLElement | null

  if (changeDirBtn) {
    changeDirBtn.addEventListener('click', async (e: MouseEvent) => {
      e.stopPropagation()
      bvSettingsCtxMenu.style.display = 'none'
      try {
        const newDir = await synAPI.openFolderDialog()
        if (newDir) {
          const result = await synAPI.brainSetDir(newDir as string) as { ok?: boolean; error?: string }
          if (result.ok) {
            await loadBrainVault()
          } else {
            alert('Failed to change Brain directory: ' + result.error)
          }
        }
      } catch (err) {
        alert('Failed to change directory: ' + escapeHtmlBv((err as Error).message))
      }
    })
  }

  if (rebuildIndexBtn) {
    rebuildIndexBtn.addEventListener('click', async (e: MouseEvent) => {
      e.stopPropagation()
      bvSettingsCtxMenu.style.display = 'none'
      try {
        const result = await synAPI.brainIndex() as { files?: number }
        alert('Brain index rebuilt: ' + (result.files || 0) + ' files')
        await loadBrainVault()
      } catch (err) {
        alert('Failed to rebuild index: ' + escapeHtmlBv((err as Error).message))
      }
    })
  }

  if (editIndexBtn) {
    editIndexBtn.addEventListener('click', async (e: MouseEvent) => {
      e.stopPropagation()
      bvSettingsCtxMenu.style.display = 'none'
      try {
        await openNote('index.md')
        // Trigger edit mode on the just-opened tab
        const tabId = 'note-index-md'
        const editBtn = document.querySelector('.bv-edit-btn[data-tab="' + tabId + '"]') as HTMLElement | null
        if (editBtn) {
          editBtn.click()
        } else {
          alert('Brain index tab opened but edit button not found.')
        }
      } catch (err) {
        alert('Failed to edit brain index: ' + escapeHtmlBv((err as Error).message))
      }
    })
  }
}

// === Graph background right-click menu ===
function showGraphMenu (x: number, y: number) {
  if (bvNodeCtxMenu) bvNodeCtxMenu.style.display = 'none'
  if (bvGraphCtxMenu) {
    bvGraphCtxMenu.style.left = x + 'px'
    bvGraphCtxMenu.style.top = y + 'px'
    bvGraphCtxMenu.style.display = 'block'
  }
}

// === Node right-click menu ===
function showNodeMenu (x: number, y: number) {
  if (bvGraphCtxMenu) bvGraphCtxMenu.style.display = 'none'
  if (bvNodeCtxMenu) {
    bvNodeCtxMenu.style.left = x + 'px'
    bvNodeCtxMenu.style.top = y + 'px'
    bvNodeCtxMenu.style.display = 'block'
  }
}

// === Graph menu actions ===
const ctxCreateNote = document.getElementById('bvCtxCreateNote') as HTMLElement | null
const ctxCreateGroup = document.getElementById('bvCtxCreateGroup') as HTMLElement | null
const ctxImport = document.getElementById('bvCtxImport') as HTMLElement | null
const ctxOpenFolder = document.getElementById('bvCtxOpenFolder') as HTMLElement | null

if (ctxCreateNote) {
  ctxCreateNote.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation()
    if (bvGraphCtxMenu) bvGraphCtxMenu.style.display = 'none'
    showCreate()
  })
}

if (ctxCreateGroup) {
  ctxCreateGroup.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation()
    if (bvGraphCtxMenu) bvGraphCtxMenu.style.display = 'none'
    showCreateGroup()
  })
}

if (ctxImport) {
  ctxImport.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation()
    if (bvGraphCtxMenu) bvGraphCtxMenu.style.display = 'none'
    showImport()
  })
}

if (ctxOpenFolder) {
  ctxOpenFolder.addEventListener('click', async (e: MouseEvent) => {
    e.stopPropagation()
    if (bvGraphCtxMenu) bvGraphCtxMenu.style.display = 'none'
    try {
      const dirResult = await synAPI.brainDir() as { path?: string }
      const brainPath = dirResult.path
      if (brainPath) {
        await synAPI.showItemInFolder(brainPath)
      }
    } catch (err) {
      alert('Could not open Brain folder: ' + escapeHtmlBv((err as Error).message))
    }
  })
}

// === Node menu actions ===
const ctxNodeOpen = document.getElementById('bvCtxNodeOpen') as HTMLElement | null
const ctxNodeCopy = document.getElementById('bvCtxNodeCopy') as HTMLElement | null
const ctxNodeDelete = document.getElementById('bvCtxNodeDelete') as HTMLElement | null

if (ctxNodeOpen) {
  ctxNodeOpen.addEventListener('click', (e: MouseEvent) => {
    e.stopPropagation()
    if (bvNodeCtxMenu) bvNodeCtxMenu.style.display = 'none'
    if (ctxTargetNode) openNote(ctxTargetNode.id)
    ctxTargetNode = null
  })
}

if (ctxNodeCopy) {
  ctxNodeCopy.addEventListener('click', async (e: MouseEvent) => {
    e.stopPropagation()
    if (bvNodeCtxMenu) bvNodeCtxMenu.style.display = 'none'
    if (ctxTargetNode) {
      const result = await synAPI.brainRead(ctxTargetNode.id) as { ok?: boolean; content?: string; error?: string }
      if (result.ok) {
        await navigator.clipboard.writeText(result.content || '')
      } else {
        alert('Failed to read ' + ctxTargetNode.id + ': ' + result.error)
      }
    }
    ctxTargetNode = null
  })
}

if (ctxNodeDelete) {
  ctxNodeDelete.addEventListener('click', async (e: MouseEvent) => {
    e.stopPropagation()
    if (bvNodeCtxMenu) bvNodeCtxMenu.style.display = 'none'
    if (ctxTargetNode) {
      const confirmed = await confirmDelete(ctxTargetNode.id)
      if (confirmed) {
        const result = await synAPI.brainDelete(ctxTargetNode.id) as { ok?: boolean; error?: string }
        if (result.ok) {
          await loadBrainVault()
        } else {
          alert('Failed to delete: ' + result.error)
        }
      }
    }
    ctxTargetNode = null
  })
}

async function confirmDelete (file: string): Promise<boolean> {
  return new Promise(resolve => {
    if (bvConfirmTitle) bvConfirmTitle.textContent = 'Delete note'
    if (bvConfirmMessage) bvConfirmMessage.textContent = 'Delete "' + file + '" from the Brain Vault?'
    if (bvConfirmOverlay) bvConfirmOverlay.style.display = 'flex'
    const onSave = async () => {
      hideConfirm()
      resolve(true)
    }
    const onDiscard = () => {
      hideConfirm()
      resolve(false)
    }
    const onCancel = () => {
      hideConfirm()
      resolve(false)
    }
    if (bvConfirmSave) bvConfirmSave.onclick = onSave
    if (bvConfirmDiscard) bvConfirmDiscard.onclick = onDiscard
    if (bvConfirmCancel) bvConfirmCancel.onclick = onCancel
  })
}

// === Create Group: select 2+ notes, link with #serial ===
async function showCreateGroup () {
  const files = brainFiles
  if (files.length < 2) {
    alert('Need at least 2 notes in the vault to create a group.')
    return
  }

  // Build a simple multi-select UI via prompt list
  const list = files.map((f, i) => (i + 1) + '. ' + f.replace(/\.md$/, '')).join('\n')
  const input = prompt('Enter note numbers to group (comma-separated, 2+):\n\n' + list)
  if (!input) return

  const selected = input.split(',').map(s => parseInt(s.trim(), 10)).filter(n => n >= 1 && n <= files.length)
  if (selected.length < 2) {
    alert('Select at least 2 notes.')
    return
  }

  // Auto-generate the next serial number tag (#000000-#999999)
  const serialResult = await synAPI.brainNextSerial() as { ok?: boolean; tag?: string; error?: string }
  if (!serialResult.ok) {
    alert('Failed to generate serial number: ' + serialResult.error)
    return
  }
  const serialTag = serialResult.tag // e.g. #000001

  for (const idx of selected) {
    const file = files[idx - 1]
    const result = await synAPI.brainRead(file) as { ok?: boolean; content?: string; error?: string }
    if (!result.ok) continue
    let content = result.content || ''
    const tagLine = 'Serial: [[Serial: ' + serialTag + ']]'
    if (!content.includes(tagLine)) {
      content = content.trim() + '\n\n' + tagLine + '\n'
      await synAPI.brainWrite(file, content)
    }
  }

  // Rebuild graph to show new links
  await loadBrainVault()
  alert('Grouped ' + selected.length + ' notes with ' + serialTag)
}

// === Import ===
function showImport () {
  if (bvImportOverlay) { bvImportOverlay.style.display = 'flex' }
  if (bvImportOverlay) bvImportOverlay.classList.remove('hidden')
}

if (bvImportCancel) {
  bvImportCancel.addEventListener('click', hideImport)
}
if (bvImportFile) {
  bvImportFile.addEventListener('click', async () => {
    hideImport()
    const files = await synAPI.openFileDialog() as string[]
    if (files) {
      for (const f of files) {
        const result = await synAPI.brainImport(f) as { ok?: boolean; errors?: Array<{ error: string }>; error?: string }
        if (!result.ok) alert('Import failed: ' + (result.errors && result.errors[0] ? result.errors[0].error : result.error))
      }
      await loadBrainVault()
    }
  })
}
if (bvImportFolder) {
  bvImportFolder.addEventListener('click', async () => {
    hideImport()
    const folder = await synAPI.openFolderDialog() as string
    if (folder) {
      const result = await synAPI.brainImport(folder) as { imported?: number; errors?: Array<unknown>; error?: string }
      alert('Imported ' + (result.imported || 0) + ' file(s).' + (result.errors && result.errors.length ? ' Errors: ' + result.errors.length : ''))
      await loadBrainVault()
    }
  })
}

// === Overlay helpers ===
function hideConfirm () {
  if (bvConfirmOverlay) bvConfirmOverlay.style.display = 'none'
}

function hideCreate () {
  if (bvCreateOverlay) { bvCreateOverlay.style.display = 'none' }
  if (bvCreateOverlay) bvCreateOverlay.classList.add('hidden')
}

function hideImport () {
  if (bvImportOverlay) { bvImportOverlay.style.display = 'none' }
  if (bvImportOverlay) bvImportOverlay.classList.add('hidden')
}

function showCreate () {
  if (bvCreateInput) bvCreateInput.value = ''
  if (bvCreateError) { bvCreateError.style.display = 'none' }
  if (bvCreateOverlay) { bvCreateOverlay.style.display = 'flex' }
  if (bvCreateOverlay) bvCreateOverlay.classList.remove('hidden')
  if (bvCreateInput) bvCreateInput.focus()
}

if (bvCreateCancel) {
  bvCreateCancel.addEventListener('click', hideCreate)
}
if (bvCreateSave) {
  bvCreateSave.addEventListener('click', async () => {
    const name = (bvCreateInput ? bvCreateInput.value : '').trim()
    if (!name) {
      if (bvCreateError) {
        bvCreateError.textContent = 'Name cannot be empty'
        bvCreateError.style.display = 'block'
      }
      return
    }
    const file = name.endsWith('.md') ? name : name + '.md'
    const result = await synAPI.brainWrite(file, '# ' + name.replace(/\.md$/, '') + '\n\n') as { ok?: boolean; error?: string }
    if (result.ok) {
      hideCreate()
      await loadBrainVault()
      openNote(file)
    } else {
      if (bvCreateError) {
        bvCreateError.textContent = result.error ?? ''
        bvCreateError.style.display = 'block'
      }
    }
  })
}

// === Check unsaved before close ===
async function checkUnsavedClose (): Promise<boolean> {
  const dirtyTabs = [...noteDirty.entries()].filter(([_, d]) => d)
  if (dirtyTabs.length === 0) return true

  // Save all dirty tabs
  for (const [tabId] of dirtyTabs) {
    const content = noteContentMap.get(tabId) || ''
    await saveNote(tabId, content)
  }
  return true
}

// === Unload / beforeunload ===
window.addEventListener('beforeunload', (e: BeforeUnloadEvent) => {
  const hasDirty = [...noteDirty.values()].some(Boolean)
  if (hasDirty) {
    e.preventDefault()
    e.returnValue = ''
  }
})

// === Helpers ===
function escapeHtmlBv (text: string) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function escapeCssId (id: string) {
  return id.replace(/[^a-z0-9]/gi, '-')
}

// === Start ===

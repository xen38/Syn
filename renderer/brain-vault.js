/**
 * Brain Vault window — standalone draggable/resizable BrowserWindow.
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

// ── Global error handler: surface any renderer JS errors on screen ──
window.addEventListener('error', (e) => {
  const msg = 'Brain Vault renderer error: ' + (e.message || e.error || String(e))
  console.error(msg)
  const el = document.getElementById('bvGraphEmpty')
  if (el) {
    el.textContent = msg
    el.style.display = 'block'
  }
})

window.addEventListener('unhandledrejection', (e) => {
  const msg = 'Brain Vault unhandled rejection: ' + (e.reason && e.reason.message ? e.reason.message : String(e.reason))
  console.error(msg)
  const el = document.getElementById('bvGraphEmpty')
  if (el) {
    el.textContent = msg
    el.style.display = 'block'
  }
})

const synAPI = window.synAPI

// ── Startup diagnostic: show synAPI status on screen ──
function showDiagnostic (msg) {
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

// ── Update status bar with current state ──
function updateStatus (msg) {
  if (bvStatusText) bvStatusText.textContent = msg
  if (bvStatusBar) bvStatusBar.style.display = 'flex'
}

// ── DOM elements ──
const bvTabs = document.getElementById('bvTabs')
const bvTabNotes = document.getElementById('bvTabNotes')
const bvBrainIndexContent = document.getElementById('bvBrainIndexContent')

// Graph elements
const bvGraphCanvas = document.getElementById('bvGraphCanvas')
const bvGraphContainer = document.getElementById('bvGraphContainer')
const bvGraphEmpty = document.getElementById('bvGraphEmpty')
const bvGraphTooltip = document.getElementById('bvGraphTooltip')

// Status bar
const bvStatusBar = document.getElementById('bvStatusBar')
const bvStatusText = document.getElementById('bvStatusText')

// Window controls
const bvBtnClose = document.getElementById('bvBtnClose')
const bvBtnMinimize = document.getElementById('bvBtnMinimize')
const bvBtnMaximize = document.getElementById('bvBtnMaximize')

// Action buttons
const bvBtnCreateNote = document.getElementById('bvBtnCreateNote')

// Context menus
const bvGraphCtxMenu = document.getElementById('bvGraphCtxMenu')
const bvNodeCtxMenu = document.getElementById('bvNodeCtxMenu')

// Overlays
const bvConfirmOverlay = document.getElementById('bvConfirmOverlay')
const bvConfirmTitle = document.getElementById('bvConfirmTitle')
const bvConfirmMessage = document.getElementById('bvConfirmMessage')
const bvConfirmCancel = document.getElementById('bvConfirmCancel')
const bvConfirmDiscard = document.getElementById('bvConfirmDiscard')
const bvConfirmSave = document.getElementById('bvConfirmSave')

const bvRenameOverlay = document.getElementById('bvRenameOverlay')
const bvRenameInput = document.getElementById('bvRenameInput')
const bvRenameError = document.getElementById('bvRenameError')
const bvRenameCancel = document.getElementById('bvRenameCancel')
const bvRenameSave = document.getElementById('bvRenameSave')

const bvCreateOverlay = document.getElementById('bvCreateOverlay')
const bvCreateInput = document.getElementById('bvCreateInput')
const bvCreateError = document.getElementById('bvCreateError')
const bvCreateCancel = document.getElementById('bvCreateCancel')
const bvCreateSave = document.getElementById('bvCreateSave')

const bvImportOverlay = document.getElementById('bvImportOverlay')
const bvImportCancel = document.getElementById('bvImportCancel')
const bvImportFile = document.getElementById('bvImportFile')
const bvImportFolder = document.getElementById('bvImportFolder')

// ── State ──
let brainFiles = []
let nodes = new Map()
let edges = []
let selectedNode = null
let hoveredNode = null
let ctxTargetNode = null

let ctx // 2d context of the graph canvas
let scale = 1
let offsetX = 0
let offsetY = 0
let isDragging = false
let dragStart = { x: 0, y: 0 }

const MIN_SCALE = 0.3
const MAX_SCALE = 2.5
const ITERATIONS = 120
const REPULSION = 5000
const ATTRACTION = 0.06
const DAMPING = 0.85
const MIN_DIST = 250

// Note editing state
const noteDirty = new Map() // tabId -> true if unsaved changes
const noteContentMap = new Map() // tabId -> current content string
const noteFileMap = new Map() // tabId -> file path (relative to BRAIN_DIR)
let pendingCloseTabId = null // tabId waiting for confirm

let brainVaultInitialized = false

// ── Window controls (native OS buttons via IPC) ──
if (bvBtnClose) {
  bvBtnClose.addEventListener('click', async (e) => {
    e.stopPropagation()
    try {
      if (await checkUnsavedClose()) {
        await synAPI.brainVaultWindowClose()
      }
    } catch (err) {
      showDiagnostic('Close failed: ' + escapeHtml(err.message || String(err)))
    }
  })
}

if (bvBtnMinimize) {
  bvBtnMinimize.addEventListener('click', () => {
    try { synAPI.brainVaultWindowMinimize() } catch (err) {
      showDiagnostic('Minimize failed: ' + escapeHtml(err.message || String(err)))
    }
  })
}

if (bvBtnMaximize) {
  bvBtnMaximize.addEventListener('click', () => {
    try { synAPI.brainVaultWindowMaximize() } catch (err) {
      showDiagnostic('Maximize failed: ' + escapeHtml(err.message || String(err)))
    }
  })
}

// ── Escape / click outside closes context menus ──
document.addEventListener('click', (e) => {
  if (bvGraphCtxMenu && bvGraphCtxMenu.style.display === 'block' && !bvGraphCtxMenu.contains(e.target)) {
    bvGraphCtxMenu.style.display = 'none'
  }
  if (bvNodeCtxMenu && bvNodeCtxMenu.style.display === 'block' && !bvNodeCtxMenu.contains(e.target)) {
    bvNodeCtxMenu.style.display = 'none'
  }
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (bvGraphCtxMenu) bvGraphCtxMenu.style.display = 'none'
    if (bvNodeCtxMenu) bvNodeCtxMenu.style.display = 'none'
    if (bvConfirmOverlay && bvConfirmOverlay.style.display === 'flex') hideConfirm()
    if (bvRenameOverlay && bvRenameOverlay.style.display === 'flex' && !bvRenameOverlay.classList.contains('hidden')) hideRename()
    if (bvCreateOverlay && bvCreateOverlay.style.display === 'flex' && !bvCreateOverlay.classList.contains('hidden')) hideCreate()
    if (bvImportOverlay && bvImportOverlay.style.display === 'flex' && !bvImportOverlay.classList.contains('hidden')) hideImport()
  }
})

// ── Initialize ──
async function init () {
  try {
    await loadBrainVault()
  } catch (e) {
    console.error('Failed to init brain vault:', e)
    bvGraphEmpty.textContent = 'Failed to load brain vault: ' + escapeHtml(e.message)
    bvGraphEmpty.style.display = 'block'
  }
}

// Re-run loadBrainVault once the BrowserWindow is actually shown so the graph
// canvas gets a real size (it's 0x0 while the window is hidden). window.onload
// fires after show(), so this is the reliable trigger; onBvWindowShown is a
// secondary trigger in case the IPC lands first.
window.addEventListener('load', () => {
  try { loadBrainVault() } catch (e) { console.error('Brain vault onload error:', e) }
})

window.addEventListener('resize', resizeCanvas)

// Only wire up the window-shown trigger if synAPI is available.
// If synAPI is undefined (contextBridge not exposed), init() will still
// attempt loadBrainVault() on its own.
if (synAPI && typeof synAPI.onBvWindowShown === 'function') {
  synAPI.onBvWindowShown(() => {
    try { loadBrainVault() } catch (e) { console.error('Brain vault window-shown error:', e) }
  })
} else {
  console.warn('synAPI not available — Brain Vault IPC features will be limited')
}

// Kick off loadBrainVault directly so the graph starts even if window.onload
// or the bv:window-shown IPC races past before listeners are registered.
// window.onload and onBvWindowShown remain as re-triggers for correctness.
init()

// ── Load brain vault ──
async function loadBrainVault () {
  if (!synAPI) {
    showDiagnostic('Brain Vault: synAPI bridge not available (contextBridge may not be exposed in this window).')
    return
  }

  if (!bvGraphCanvas || !bvGraphContainer || !bvGraphEmpty) {
    showDiagnostic('Brain Vault: required DOM elements missing.')
    return
  }

  let files
  try {
    files = await synAPI.brainList()
  } catch (e) {
    showDiagnostic('Brain Vault: brainList() failed — ' + escapeHtml(e.message))
    return
  }
  brainFiles = files || []
  updateStatus('synAPI OK · ' + brainFiles.length + ' vault files')

  if (brainFiles.length === 0) {
    showDiagnostic('Brain Vault: brainList() returned 0 files. Check that brain/ directory exists at ' + (await synAPI.brainDir ? (await synAPI.brainDir()).path : 'unknown'))
    bvGraphCanvas.style.display = 'none'
    bvGraphEmpty.style.display = 'block'
    return
  }
  ctx = bvGraphCanvas.getContext('2d')

  if (!brainFiles || brainFiles.length === 0) {
    bvGraphCanvas.style.display = 'none'
    bvGraphEmpty.style.display = 'block'
    return
  }

  bvGraphCanvas.style.display = 'block'
  bvGraphEmpty.style.display = 'none'

  // Read each file and extract [[wikilink]] references
  nodes = new Map()
  edges = []

  for (const file of brainFiles) {
    nodes.set(file, { id: file, label: file.replace(/\.md$/, ''), x: 0, y: 0, vx: 0, vy: 0, fixed: false })
  }

  for (const file of brainFiles) {
    let result
    try {
      result = await synAPI.brainRead(file)
    } catch (e) {
      console.error('Failed to read ' + file + ':', e)
      continue
    }
    if (!result.ok) continue
    const content = result.content || ''
    const linkRe = /\[\[([^\]]+)\]\]/g
    let match
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
  // when the container hasn't laid out yet (0×0 client size).
  resizeCanvas()

  // Force-directed layout
  const nodeArr = Array.from(nodes.values())
  const centerX = (bvGraphContainer.clientWidth || bvGraphCanvas.width) / 2
  const centerY = (bvGraphContainer.clientHeight || bvGraphCanvas.height) / 2

  nodeArr.forEach((n, i) => {
    const angle = (i / nodeArr.length) * 2 * Math.PI
    const r = Math.min(centerX, centerY) * 0.35 + Math.random() * 60
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

  // Draw now so the graph appears even when loadBrainVault() runs after the
  // window has been shown (the canvas was 0x0 on the first hidden run).
  updateStatus('synAPI OK · ' + brainFiles.length + ' files · ' + nodes.size + ' nodes · ' + edges.length + ' links · canvas ' + bvGraphCanvas.width + '×' + bvGraphCanvas.height)
  render()

  // ── Idempotency: event listeners once ──
  if (!brainVaultInitialized) {
    brainVaultInitialized = true

    // ── Mouse interactions ──
    bvGraphCanvas.addEventListener('mousedown', (e) => {
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

    bvGraphCanvas.addEventListener('mousemove', (e) => {
      const rect = bvGraphCanvas.getBoundingClientRect()
      const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
      const node = getNodeAt(world.x, world.y)
      hoveredNode = node
      bvGraphCanvas.style.cursor = node ? 'pointer' : 'grab'
      if (node) {
        const s = worldToScreen(node.x, node.y)
        bvGraphTooltip.style.display = 'block'
        bvGraphTooltip.style.left = (s.x + 18) + 'px'
        bvGraphTooltip.style.top = (s.y - 28) + 'px'
        bvGraphTooltip.textContent = node.label
      } else {
        bvGraphTooltip.style.display = 'none'
      }
      if (isDragging) {
        offsetX += (e.clientX - rect.left - dragStart.x) / scale
        offsetY += (e.clientY - rect.top - dragStart.y) / scale
        dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      }
    })

    bvGraphCanvas.addEventListener('mouseup', () => { isDragging = false })

    bvGraphCanvas.addEventListener('wheel', (e) => {
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

    // ── Drag & Drop: accept session dragged from Syn main window ──
    bvGraphContainer.addEventListener('dragover', (e) => {
      e.preventDefault()
      bvGraphContainer.classList.add('drag-over')
    })

    bvGraphContainer.addEventListener('dragleave', () => {
      bvGraphContainer.classList.remove('drag-over')
    })

    bvGraphContainer.addEventListener('drop', async (e) => {
      e.preventDefault()
      bvGraphContainer.classList.remove('drag-over')
      const sessionId = e.dataTransfer.getData('text/syn-session-id')
      if (sessionId) {
        await createNoteFromSession(sessionId)
      }
    })

    // Zoom controls
    document.getElementById('bvGraphZoomIn').addEventListener('click', () => {
      scale = Math.min(scale * 1.2, MAX_SCALE)
      document.getElementById('bvGraphZoomVal').textContent = Math.round(scale * 100)
    })
    document.getElementById('bvGraphZoomOut').addEventListener('click', () => {
      scale = Math.max(scale / 1.2, MIN_SCALE)
      document.getElementById('bvGraphZoomVal').textContent = Math.round(scale * 100)
    })
    document.getElementById('bvGraphReset').addEventListener('click', () => {
      scale = 1
      offsetX = 0
      offsetY = 0
      document.getElementById('bvGraphZoomVal').textContent = '100'
    })
  } // end idempotency guard
}

// ── Resize canvas ──
function resizeCanvas () {
  let w = bvGraphContainer.clientWidth
  let h = bvGraphContainer.clientHeight
  // Fallback to window dimensions when the flex chain hasn't laid out yet
  // (body has height:100% but no display:flex, so container can report 0×0).
  if (!w || !h) {
    const rect = bvGraphContainer.getBoundingClientRect()
    w = rect.width || window.innerWidth || 900
    h = rect.height || Math.max(window.innerHeight - 120, 400)
  }
  // Ensure minimum dimensions so the canvas is never 0x0
  w = Math.max(w, 400)
  h = Math.max(h, 300)
  if (bvGraphCanvas.width !== w || bvGraphCanvas.height !== h) {
    bvGraphCanvas.width = w
    bvGraphCanvas.height = h
  }
}

function worldToScreen (x, y) {
  return { x: (x + offsetX) * scale, y: (y + offsetY) * scale }
}
function screenToWorld (x, y) {
  return { x: x / scale - offsetX, y: y / scale - offsetY }
}

function getNodeAt (wx, wy) {
  for (const n of nodes.values()) {
    const dx = n.x - wx
    const dy = n.y - wy
    if (dx * dx + dy * dy < 40 * 40) return n
  }
  return null
}

function drawNode (ctx, n, isHover, isSelected) {
  const s = worldToScreen(n.x, n.y)
  const r = 14
  ctx.beginPath()
  ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
  ctx.fillStyle = isSelected ? '#53C68B' : (isHover ? '#4a90e2' : '#6b7280')
  ctx.fill()
  ctx.strokeStyle = isSelected || isHover ? '#53C68B' : '#9ca3af'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = '#cccccc'
  ctx.font = '11px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(n.label, s.x, s.y + r + 14)
}

function drawEdge (ctx, a, b) {
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
  // while the container had 0×0 dimensions (flex chain not yet laid out).
  resizeCanvas()
  ctx.clearRect(0, 0, bvGraphCanvas.width, bvGraphCanvas.height)

  // Fallback: if no nodes, draw a centered hint on the canvas
  if (nodes.size === 0) {
    ctx.fillStyle = '#666666'
    ctx.font = '14px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('No vault notes yet. Right-click graph to Create or Import.', bvGraphCanvas.width / 2, bvGraphCanvas.height / 2)
    requestAnimationFrame(render)
    return
  }

  // Diagnostic: if all nodes are at or near origin / off-canvas, log it.
  const nodeArr = Array.from(nodes.values())
  const offScreen = nodeArr.filter(n =>
    Math.abs(n.x) > bvGraphCanvas.width * 10 ||
    Math.abs(n.y) > bvGraphCanvas.height * 10 ||
    (n.x === 0 && n.y === 0)).length
  if (offScreen > 0 && bvGraphCanvas.width > 0 && bvGraphCanvas.height > 0) {
    showDiagnostic('Render warning: ' + offScreen + '/' + nodeArr.length + ' nodes off-canvas (canvas ' + bvGraphCanvas.width + '×' + bvGraphCanvas.height + ')')
  }

  const seenEdges = new Set()
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

// ── Render note content ──
function renderNoteContent (file, content) {
  let html = escapeHtml(content)
  html = html.replace(/\[\[([^\]]+)\]\]/g, (match, link) => {
    const label = link.replace(/\.md$/, '')
    return '<span class="wiki-link" data-link="' + escapeHtml(label) + '">' + escapeHtml(label) + '</span>'
  })
  html = html.replace(/\n/g, '<br>')
  return html
}

// ── Open a note in a new tab ──
async function openNote (file) {
  // If already open, switch to it
  const existingTab = document.querySelector('.brain-vault-tab[data-tab="note-' + escapeCssId(file) + '"]')
  if (existingTab) {
    switchBvTab('note-' + escapeCssId(file))
    return
  }

  const result = await synAPI.brainRead(file)
  if (!result.ok) {
    alert('Failed to read ' + file + ': ' + result.error)
    return
  }

  const content = result.content || ''
  const label = file.replace(/\.md$/, '')
  const html = renderNoteContent(file, content)
  const tabId = 'note-' + escapeCssId(file)

  createBvTab(tabId, label, html, file, content)
  switchBvTab(tabId)
}

// ── Create a brain vault tab ──
function createBvTab (tabId, label, html, file, content) {
  // Deactivate all tabs
  document.querySelectorAll('.brain-vault-tab').forEach(tab => tab.classList.remove('active'))
  document.querySelectorAll('.brain-vault-tab-content').forEach(c => c.classList.remove('active'))

  // Create tab button with label + close X
  const tabBtn = document.createElement('button')
  tabBtn.className = 'brain-vault-tab active'
  tabBtn.dataset.tab = tabId
  tabBtn.innerHTML =
    '<span class="bv-tab-label">' + escapeHtml(label) + '</span>' +
    ' <span class="tab-close" data-tab="' + tabId + '">&#215;</span>'

  // Create content div
  const contentDiv = document.createElement('div')
  contentDiv.className = 'brain-vault-tab-content active brain-vault-note-content'
  contentDiv.dataset.tab = tabId
  contentDiv.innerHTML = html

  bvTabs.appendChild(tabBtn)
  bvTabNotes.appendChild(contentDiv)

  // Track state
  noteFileMap.set(tabId, file)
  noteContentMap.set(tabId, content)
  noteDirty.set(tabId, false)

  // Wire up wikilink clicks
  contentDiv.querySelectorAll('.wiki-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const targetFile = link.dataset.link + '.md'
      openNote(targetFile)
    })
  })

  // ── Inline editing: click content to edit ──
  contentDiv.addEventListener('click', (e) => {
    if (e.target.classList.contains('wiki-link')) return
    if (e.target.classList.contains('tab-close')) return
    startEditMode(contentDiv, tabId, file)
  })

  // ── Double-click tab label to rename ──
  const labelSpan = tabBtn.querySelector('.bv-tab-label')
  labelSpan.addEventListener('dblclick', (e) => {
    e.stopPropagation()
    startRename(tabId, file, labelSpan)
  })

  // Tab close button
  const closeBtn = tabBtn.querySelector('.tab-close')
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    closeNoteTab(tabId)
  })

  // Tab click to switch
  tabBtn.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab-close')) return
    switchBvTab(tabId)
  })
}

// ── Start inline edit mode ──
function startEditMode (contentDiv, tabId, file) {
  if (noteDirty.get(tabId)) return // already editing

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
  const tabBtn = document.querySelector('.brain-vault-tab[data-tab="' + tabId + '"]')
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

  const labelSpan = tabBtn.querySelector('.bv-tab-label')
  labelSpan.style.display = 'inline-flex'
  labelSpan.style.alignItems = 'center'
  labelSpan.appendChild(saveBtn)

  // Replace content with textarea
  contentDiv.innerHTML = ''
  contentDiv.appendChild(textarea)
  textarea.focus()

  // Track dirty state
  const saveTimeout = null
  textarea.addEventListener('input', () => {
    const newVal = textarea.value
    noteContentMap.set(tabId, newVal)
    noteDirty.set(tabId, newVal !== (noteFileMap.get(tabId) ? '' : ''))
    // Compare against original by re-reading? Simpler: mark dirty on any change
    noteDirty.set(tabId, true)
    saveBtn.style.display = 'inline-block'

    if (saveTimeout) clearTimeout(saveTimeout)
    // Auto-save after 3s of inactivity? Not requested; manual Save button only.
  })

  saveBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    saveNote(tabId, textarea.value)
  })

  // Click outside textarea to stop editing? Keep editing until Save or switch tab.
}

// ── Save a note ──
async function saveNote (tabId, content) {
  const file = noteFileMap.get(tabId)
  if (!file) return

  const result = await synAPI.brainWrite(file, content)
  if (result.ok) {
    noteContentMap.set(tabId, content)
    noteDirty.set(tabId, false)
    const saveBtn = document.querySelector('.bv-save-btn')
    if (saveBtn) saveBtn.style.display = 'none'

    // Re-render content as read-only
    const contentDiv = document.querySelector('.brain-vault-tab-content[data-tab="' + tabId + '"]')
    const html = renderNoteContent(file, content)
    contentDiv.innerHTML = html

    // Re-wire click-to-edit
    contentDiv.addEventListener('click', (e) => {
      if (e.target.classList.contains('wiki-link')) return
      if (e.target.classList.contains('tab-close')) return
      startEditMode(contentDiv, tabId, file)
    })

    // Re-wire wiki links
    contentDiv.querySelectorAll('.wiki-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const targetFile = link.dataset.link + '.md'
        openNote(targetFile)
      })
    })
  } else {
    alert('Save failed: ' + result.error)
  }
}

// ── Close a note tab ──
function closeNoteTab (tabId) {
  if (noteDirty.get(tabId)) {
    pendingCloseTabId = tabId
    bvConfirmTitle.textContent = 'Unsaved changes'
    bvConfirmMessage.textContent = 'This document has been edited; are you sure you don\'t want to [proceed]?'
    bvConfirmOverlay.style.display = 'flex'
    return
  }
  doCloseTab(tabId)
}

bvConfirmCancel.addEventListener('click', () => {
  hideConfirm()
  pendingCloseTabId = null
})

bvConfirmDiscard.addEventListener('click', () => {
  hideConfirm()
  if (pendingCloseTabId) {
    doCloseTab(pendingCloseTabId)
    pendingCloseTabId = null
  }
})

bvConfirmSave.addEventListener('click', async () => {
  hideConfirm()
  if (pendingCloseTabId) {
    const content = noteContentMap.get(pendingCloseTabId) || ''
    await saveNote(pendingCloseTabId, content)
    doCloseTab(pendingCloseTabId)
    pendingCloseTabId = null
  }
})

function doCloseTab (tabId) {
  const tabBtn = document.querySelector('.brain-vault-tab[data-tab="' + tabId + '"]')
  const content = document.querySelector('.brain-vault-tab-content[data-tab="' + tabId + '"]')
  if (tabBtn) tabBtn.remove()
  if (content) content.remove()

  noteDirty.delete(tabId)
  noteContentMap.delete(tabId)
  noteFileMap.delete(tabId)

  const activeTab = document.querySelector('.brain-vault-tab.active')
  if (!activeTab) {
    const vaultTab = document.querySelector('.brain-vault-tab[data-tab="vault"]')
    if (vaultTab) switchBvTab('vault')
    else {
      const indexTab = document.querySelector('.brain-vault-tab[data-tab="index"]')
      if (indexTab) switchBvTab('index')
    }
  }
}

// ── Switch tab ──
function switchBvTab (tabId) {
  document.querySelectorAll('.brain-vault-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabId)
  })
  document.querySelectorAll('.brain-vault-tab-content').forEach(content => {
    content.classList.toggle('active', content.dataset.tab === tabId)
  })
}

// ── Double-click rename ──
function startRename (tabId, oldFile, labelSpan) {
  bvRenameInput.value = oldFile.replace(/\.md$/, '')
  bvRenameError.style.display = 'none'
  bvRenameOverlay.style.display = 'flex'
  bvRenameOverlay.classList.remove('hidden')
  bvRenameInput.focus()

  const onRenameSave = async () => {
    const newName = bvRenameInput.value.trim()
    if (!newName) {
      bvRenameError.textContent = 'Name cannot be empty'
      bvRenameError.style.display = 'block'
      return
    }
    const newFile = newName.endsWith('.md') ? newName : newName + '.md'
    const result = await synAPI.brainRename(oldFile, newFile)
    if (result.ok) {
      hideRename()
      // Update tab label
      labelSpan.textContent = newFile.replace(/\.md$/, '')
      // Update file map
      noteFileMap.set(tabId, newFile)
      // Refresh graph to reflect rename
      await loadBrainVault()
    } else {
      bvRenameError.textContent = result.error
      bvRenameError.style.display = 'block'
    }
  }

  bvRenameSave.onclick = onRenameSave
  bvRenameCancel.onclick = hideRename

  bvRenameInput.addEventListener('keydown', function enterHandler (e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      bvRenameInput.blur()
      onRenameSave()
    }
  }, { once: true })
}

function hideRename () {
  bvRenameOverlay.style.display = 'none'
  bvRenameOverlay.classList.add('hidden')
}

// ── Tab switching event delegation ──
bvTabs.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('.tab-close')
  if (closeBtn) {
    e.stopPropagation()
    closeNoteTab(closeBtn.dataset.tab)
    return
  }
  const tab = e.target.closest('.brain-vault-tab')
  if (!tab) return
  if (e.target.classList.contains('bv-save-btn')) return
  e.stopPropagation()
  switchBvTab(tab.dataset.tab)
  if (tab.dataset.tab === 'index') {
    loadBrainIndexContent()
  }
})

// ── Load brain index content ──
async function loadBrainIndexContent () {
  try {
    const result = await synAPI.brainRead('index.md')
    if (result.ok) {
      bvBrainIndexContent.innerHTML = renderNoteContent('index.md', result.content)
      bvBrainIndexContent.querySelectorAll('.wiki-link').forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault()
          const targetFile = link.dataset.link + '.md'
          openNote(targetFile)
        })
      })
    } else {
      const idx = await synAPI.getBrainIndex()
      bvBrainIndexContent.textContent = idx.content || '(brain index empty — rebuild via /brain index)'
    }
  } catch (e) {
    console.error('Failed to load brain index:', e)
    bvBrainIndexContent.textContent = '(brain index unavailable)'
  }
}

// ── Create note from session (drag-drop from Syn) ──
async function createNoteFromSession (sessionId) {
  try {
    const session = await synAPI.readSession(sessionId)
    if (!session) {
      alert('Session not found: ' + sessionId)
      return
    }

    // Build markdown content from session
    const messages = session.messages || []
    const lines = [
      '# Session: ' + escapeHtml(session.title || sessionId),
      '',
      'Harness: ' + escapeHtml(session.harness || 'unknown'),
      'Session ID: ' + escapeHtml(session.id),
      'Created: ' + escapeHtml(session.created_at || ''),
      '',
      '## Messages',
      ''
    ]
    for (const m of messages) {
      const role = (m.role || 'unknown').toUpperCase()
      const ts = m.timestamp ? ' (' + escapeHtml(m.timestamp) + ')' : ''
      lines.push('### ' + role + ts)
      lines.push('')
      lines.push(m.content || '')
      lines.push('')
      lines.push('---')
      lines.push('')
    }
    lines.push('', '---', '', 'Imported from Syn session via drag-and-drop.')

    const fileName = 'sessions/session-' + sessionId.replace(/[^a-z0-9]/gi, '-') + '.md'
    const result = await synAPI.brainWrite(fileName, lines.join('\n') + '\n')
    if (result.ok) {
      await loadBrainVault()
      openNote(fileName)
    } else {
      alert('Failed to create note: ' + result.error)
    }
  } catch (e) {
    alert('Failed to import session: ' + e.message)
  }
}

// ── Create new note ──
bvBtnCreateNote.addEventListener('click', () => {
  showCreate()
})

// ── Graph background right-click menu ──
function showGraphMenu (x, y) {
  bvNodeCtxMenu.style.display = 'none'
  bvGraphCtxMenu.style.left = x + 'px'
  bvGraphCtxMenu.style.top = y + 'px'
  bvGraphCtxMenu.style.display = 'block'
}

// ── Node right-click menu ──
function showNodeMenu (x, y) {
  bvGraphCtxMenu.style.display = 'none'
  bvNodeCtxMenu.style.left = x + 'px'
  bvNodeCtxMenu.style.top = y + 'px'
  bvNodeCtxMenu.style.display = 'block'
}

// ── Graph menu actions ──
document.getElementById('bvCtxCreateNote').addEventListener('click', (e) => {
  e.stopPropagation()
  bvGraphCtxMenu.style.display = 'none'
  showCreate()
})

document.getElementById('bvCtxCreateGroup').addEventListener('click', (e) => {
  e.stopPropagation()
  bvGraphCtxMenu.style.display = 'none'
  showCreateGroup()
})

document.getElementById('bvCtxImport').addEventListener('click', (e) => {
  e.stopPropagation()
  bvGraphCtxMenu.style.display = 'none'
  showImport()
})

document.getElementById('bvCtxOpenFolder').addEventListener('click', async (e) => {
  e.stopPropagation()
  bvGraphCtxMenu.style.display = 'none'
  try {
    const { path: brainPath } = await synAPI.brainDir()
    await synAPI.showItemInFolder(brainPath)
  } catch (err) {
    alert('Could not open Brain folder: ' + err.message)
  }
})

// ── Node menu actions ──
document.getElementById('bvCtxNodeOpen').addEventListener('click', (e) => {
  e.stopPropagation()
  bvNodeCtxMenu.style.display = 'none'
  if (ctxTargetNode) openNote(ctxTargetNode.id)
  ctxTargetNode = null
})

document.getElementById('bvCtxNodeCopy').addEventListener('click', async (e) => {
  e.stopPropagation()
  bvNodeCtxMenu.style.display = 'none'
  if (ctxTargetNode) {
    const result = await synAPI.brainRead(ctxTargetNode.id)
    if (result.ok) {
      await navigator.clipboard.writeText(result.content)
    } else {
      alert('Failed to read ' + ctxTargetNode.id + ': ' + result.error)
    }
  }
  ctxTargetNode = null
})

document.getElementById('bvCtxNodeDelete').addEventListener('click', async (e) => {
  e.stopPropagation()
  bvNodeCtxMenu.style.display = 'none'
  if (ctxTargetNode) {
    const confirmed = await confirmDelete(ctxTargetNode.id)
    if (confirmed) {
      const result = await synAPI.brainDelete(ctxTargetNode.id)
      if (result.ok) {
        await loadBrainVault()
      } else {
        alert('Failed to delete: ' + result.error)
      }
    }
  }
  ctxTargetNode = null
})

async function confirmDelete (file) {
  return new Promise(resolve => {
    bvConfirmTitle.textContent = 'Delete note'
    bvConfirmMessage.textContent = 'Delete "' + file + '" from the Brain Vault?'
    bvConfirmOverlay.style.display = 'flex'
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
    bvConfirmSave.onclick = onSave
    bvConfirmDiscard.onclick = onDiscard
    bvConfirmCancel.onclick = onCancel
  })
}

// ── Create Group: select 2+ notes, link with [[l#serial]] ──
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

  const serial = prompt('Enter group serial number (#000001-#999999):', '#000001')
  if (!serial) return
  const serialRe = /^#\d{6}$/
  if (!serialRe.test(serial)) {
    alert('Serial must be like #000001 through #999999.')
    return
  }

  const linkTag = '[[l' + serial + ']]'

  for (const idx of selected) {
    const file = files[idx - 1]
    const result = await synAPI.brainRead(file)
    if (!result.ok) continue
    let content = result.content || ''
    if (!content.includes(linkTag)) {
      content = content.trim() + '\n\n' + linkTag + '\n'
      await synAPI.brainWrite(file, content)
    }
  }

  // Rebuild graph to show new links
  await loadBrainVault()
  alert('Grouped ' + selected.length + ' notes with ' + linkTag)
}

// ── Import ──
function showImport () {
  bvImportOverlay.style.display = 'flex'
  bvImportOverlay.classList.remove('hidden')
}

bvImportCancel.addEventListener('click', hideImport)
bvImportFile.addEventListener('click', async () => {
  hideImport()
  const files = await synAPI.openFileDialog()
  if (files) {
    for (const f of files) {
      const result = await synAPI.brainImport(f)
      if (!result.ok) alert('Import failed: ' + (result.errors && result.errors[0] ? result.errors[0].error : result.error))
    }
    await loadBrainVault()
  }
})
bvImportFolder.addEventListener('click', async () => {
  hideImport()
  const folder = await synAPI.openFolderDialog()
  if (folder) {
    const result = await synAPI.brainImport(folder)
    alert('Imported ' + result.imported + ' file(s).' + (result.errors && result.errors.length ? ' Errors: ' + result.errors.length : ''))
    await loadBrainVault()
  }
})

// ── Overlay helpers ──
function hideConfirm () {
  bvConfirmOverlay.style.display = 'none'
}

function hideCreate () {
  bvCreateOverlay.style.display = 'none'
  bvCreateOverlay.classList.add('hidden')
}

function hideImport () {
  bvImportOverlay.style.display = 'none'
  bvImportOverlay.classList.add('hidden')
}

function showCreate () {
  bvCreateInput.value = ''
  bvCreateError.style.display = 'none'
  bvCreateOverlay.style.display = 'flex'
  bvCreateOverlay.classList.remove('hidden')
  bvCreateInput.focus()
}

bvCreateCancel.addEventListener('click', hideCreate)
bvCreateSave.addEventListener('click', async () => {
  const name = bvCreateInput.value.trim()
  if (!name) {
    bvCreateError.textContent = 'Name cannot be empty'
    bvCreateError.style.display = 'block'
    return
  }
  const file = name.endsWith('.md') ? name : name + '.md'
  const result = await synAPI.brainWrite(file, '# ' + name.replace(/\.md$/, '') + '\n\n')
  if (result.ok) {
    hideCreate()
    await loadBrainVault()
    openNote(file)
  } else {
    bvCreateError.textContent = result.error
    bvCreateError.style.display = 'block'
  }
})

// ── Check unsaved before close ──
async function checkUnsavedClose () {
  const dirtyTabs = [...noteDirty.entries()].filter(([_, d]) => d)
  if (dirtyTabs.length === 0) return true

  // Save all dirty tabs
  for (const [tabId] of dirtyTabs) {
    const content = noteContentMap.get(tabId) || ''
    await saveNote(tabId, content)
  }
  return true
}

// ── Unload / beforeunload ──
window.addEventListener('beforeunload', (e) => {
  const hasDirty = [...noteDirty.values()].some(Boolean)
  if (hasDirty) {
    e.preventDefault()
    e.returnValue = ''
  }
})

// ── Helpers ──
function escapeHtml (text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function escapeCssId (id) {
  return id.replace(/[^a-z0-9]/gi, '-')
}

// ── Start ──
init()

// Global error handlers to capture crashes
window.onerror = (msg, url, line, col, error) => {
  console.error('UNCAUGHT ERROR:', msg, 'at', url, ':', line, ':', col, error)
  return true
}

window.onunhandledrejection = (event) => {
  console.error('UNHANDLED REJECTION:', event.reason)
}

const setup = () => {
  const synAPI = window.synAPI

  // DOM elements
  const terminalInput = document.getElementById('terminalInput')
  const terminalOutput = document.getElementById('terminalOutput')
  const terminalColumn = document.querySelector('.terminal-column')
  const btnCloseTerminal = document.getElementById('btnCloseTerminal')
  // Terminal starts open per spec: ◀ = open (arrow points left toward terminal, click to close)
  let terminalVisible = true
  btnCloseTerminal.textContent = '◀'
  btnCloseTerminal.className = 'terminal-toggle open'
  terminalColumn.style.display = 'flex'
  updateTogglePosition()
  const searchInput = document.getElementById('searchInput')
  const menuBtn = document.getElementById('menuBtn')
  const menuPanel = document.getElementById('menuPanel')
  const btnBrainmaxxing = document.getElementById('btnBrainmaxxing')
  const brainmaxxingPanel = document.getElementById('brainmaxxingPanel')
  const btnBrain = document.getElementById('btnBrain')
  const dbHealthBadge = document.getElementById('dbHealthBadge')
  const btnRebuildIndex = document.getElementById('btnRebuildIndex')
  const sessionList = document.getElementById('sessionList')
  const btnRefreshSessions = document.getElementById('btnRefreshSessions')
  const emptyState = document.getElementById('emptyState')
  const sessionView = document.getElementById('sessionView')
  const statusIndicatorImg = document.getElementById('statusIndicatorImg')
  const sessionContent = document.getElementById('sessionContent')
  const metaHarness = document.getElementById('metaHarness')
  const metaSessionId = document.getElementById('metaSessionId')
  const metaPath = document.getElementById('metaPath')
  const harnessList = document.getElementById('harnessList')
  const harnessSettingsEl = document.getElementById('harnessSettings')
  const btnScanHarnesses = document.getElementById('btnScanHarnesses')
  const btnAddFolder = document.getElementById('btnAddFolder')
  const btnBrainReflect = document.getElementById('btnBrainReflect')
  const btnBrainMeditate = document.getElementById('btnBrainMeditate')
  const btnBrainRuminate = document.getElementById('btnBrainRuminate')
  const btnBrainPlan = document.getElementById('btnBrainPlan')
  const btnBrainReview = document.getElementById('btnBrainReview')
  const btnBrainIndex = document.getElementById('btnBrainIndex')
  const settingBatchSize = document.getElementById('settingBatchSize')

  // Context menu elements
  const ctxMenu = document.getElementById('ctxMenu')
  const ctxCopySessionId = document.getElementById('ctxCopySessionId')
  const ctxDeleteEntry = document.getElementById('ctxDeleteEntry')
  const ctxConfirmOverlay = document.getElementById('ctxConfirmOverlay')
  const ctxConfirmTitle = document.getElementById('ctxConfirmTitle')
  const ctxConfirmMessage = document.getElementById('ctxConfirmMessage')
  const ctxConfirmCancel = document.getElementById('ctxConfirmCancel')
  const ctxConfirmDelete = document.getElementById('ctxConfirmDelete')

  // Close session button
  const btnCloseSession = document.getElementById('btnCloseSession')

  // Brain vault panel elements
  const brainVaultPanel = document.getElementById('brainVaultPanel')
  const btnCloseBrainVault = document.getElementById('btnCloseBrainVault')
  const brainVaultIndexContent = document.getElementById('brainVaultIndexContent')

  // State
  let allSessions = []
  let selectedSessionId = null
  let menuOpen = false
  let brainmaxxingOpen = false
  let brainVaultOpen = false
  let batchSize = 10
  let harnessSettings = {}
  let ctxTargetSessionId = null
  let pendingConfirm = null
  const terminalHistory = []
  let terminalHistoryIndex = -1
  let searchQuery = ''

  // Toggle Settings menu (Settings button ONLY opens Settings)
  function toggleMenu (e) {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    menuOpen = !menuOpen
    menuBtn.setAttribute('aria-expanded', String(menuOpen))
    if (menuOpen) {
      menuPanel.style.display = 'block'
      renderHarnesses()
      renderHarnessSettings()
      // If Brainmaxxing is also open, shift it to the left of Settings
      if (brainmaxxingOpen) {
        brainmaxxingPanel.style.right = '342px'
      }
    } else {
      menuPanel.style.display = 'none'
      menuBtn.setAttribute('aria-expanded', 'false')
      // If Brainmaxxing is still open, move it back to Settings position
      if (brainmaxxingOpen) {
        brainmaxxingPanel.style.right = '16px'
      }
    }
  }

  // Menu button click - Settings only
  menuBtn.addEventListener('click', toggleMenu)

  // Brainmaxxing button click (independent from Settings menu)
  btnBrainmaxxing.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    brainmaxxingOpen = !brainmaxxingOpen
    btnBrainmaxxing.setAttribute('aria-expanded', String(brainmaxxingOpen))
    if (brainmaxxingOpen) {
      brainmaxxingPanel.style.display = 'block'
      // Position: if Settings is open, shift left; otherwise at Settings position
      if (menuOpen) {
        brainmaxxingPanel.style.right = '342px'
      } else {
        brainmaxxingPanel.style.right = '16px'
      }
    } else {
      brainmaxxingPanel.style.display = 'none'
      btnBrainmaxxing.setAttribute('aria-expanded', 'false')
    }
  })

  // Brain button click - opens Obsidian-style brain vault menu in middle column
  btnBrain.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    brainVaultOpen = !brainVaultOpen
    if (brainVaultOpen) {
      brainVaultPanel.style.display = 'flex'
      loadBrainVault()
    } else {
      brainVaultPanel.style.display = 'none'
    }
  })

  // ── Database health (Gate G7) ─────────────────────────────────────────
  const DB_HEALTH_COLORS = {
    healthy: '#53C68B',
    corrupt: '#ff4444',
    rebuilding: '#f5a623',
    unknown: '#aaa'
  }

  async function checkDbHealth () {
    if (!dbHealthBadge || !btnRebuildIndex) return
    try {
      const health = await synAPI.dbHealth()
      const status = health.health || 'unknown'
      const color = DB_HEALTH_COLORS[status] || DB_HEALTH_COLORS.unknown
      dbHealthBadge.style.color = color
      dbHealthBadge.title = `Index database: ${status} (${health.dbPath})`

      // Show rebuild button only when not healthy
      if (status === 'healthy') {
        btnRebuildIndex.style.display = 'none'
      } else {
        btnRebuildIndex.style.display = 'inline-block'
        btnRebuildIndex.textContent = status === 'corrupt' ? 'Rebuild index' : 'Rebuilding…'
        btnRebuildIndex.disabled = status === 'rebuilding'
      }
    } catch (e) {
      console.error('Failed to check DB health:', e)
      dbHealthBadge.style.color = DB_HEALTH_COLORS.unknown
      dbHealthBadge.title = 'Index database: unknown'
      btnRebuildIndex.style.display = 'inline-block'
      btnRebuildIndex.textContent = 'Rebuild index'
    }
  }

  // ── Brain vault (Gate G11) ────────────────────────────────────────────
  let brainVaultInitialized = false

  async function loadBrainVault () {
    try {
      const files = await synAPI.brainList()
      const canvas = document.getElementById('brainGraphCanvas')
      const container = document.getElementById('brainVaultGraphContainer')
      const empty = document.getElementById('graphEmpty')
      const ctx = canvas.getContext('2d')

      if (!files || files.length === 0) {
        canvas.style.display = 'none'
        empty.style.display = 'block'
        return
      }
      canvas.style.display = 'block'
      empty.style.display = 'none'

      // Read each file and extract [[wikilink]] references
      const nodes = new Map()
      const edges = []
      const linkRe = /\[\[([^\]]+)\]\]/g

      for (const file of files) {
        nodes.set(file, { id: file, label: file.replace(/\.md$/, ''), x: 0, y: 0, vx: 0, vy: 0, fixed: false })
      }

      for (const file of files) {
        const result = await synAPI.brainRead(file)
        if (!result.ok) continue
        const content = result.content || ''
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

      // ── Force-directed layout (not a perfect circle) ──
      // Related nodes pulled together, all nodes repel each other,
      // some end up inside, some outside, roughly equidistant.
      const nodeArr = Array.from(nodes.values())
      const centerX = container.clientWidth / 2
      const centerY = container.clientHeight / 2

      // Initial positions: random in a circle with some jitter
      nodeArr.forEach((n, i) => {
        const angle = (i / nodeArr.length) * 2 * Math.PI
        const r = Math.min(centerX, centerY) * 0.35 + Math.random() * 60
        n.x = centerX + Math.cos(angle) * r
        n.y = centerY + Math.sin(angle) * r
        n.vx = 0
        n.vy = 0
      })

      const ITERATIONS = 120
      const REPULSION = 5000
      const ATTRACTION = 0.06
      const DAMPING = 0.85
      const MIN_DIST = 250

      for (let iter = 0; iter < ITERATIONS; iter++) {
        // Repulsion between all pairs
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

        // Attraction along edges
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

        // Apply velocity with damping, plus gentle center gravity
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

      // View state
      let scale = 1
      let offsetX = 0
      let offsetY = 0
      let isDragging = false
      let dragStart = { x: 0, y: 0 }
      let hoveredNode = null
      let selectedNode = null

      const MIN_SCALE = 0.3
      const MAX_SCALE = 2.5

      function resizeCanvas () {
        canvas.width = container.clientWidth
        canvas.height = container.clientHeight
      }
      resizeCanvas()

      // Idempotency: only set up event listeners and render loop once
      if (!brainVaultInitialized) {
        brainVaultInitialized = true
        window.addEventListener('resize', resizeCanvas)

        function worldToScreen (x, y) {
          return { x: (x + offsetX) * scale, y: (y + offsetY) * scale }
        }
        function screenToWorld (x, y) {
          return { x: x / scale - offsetX, y: y / scale - offsetY }
        }

        function getNodeAt (wx, wy) {
          for (const n of nodeArr) {
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
          ctx.fillStyle = isSelected ? '#53C68B' : (isHover ? '#1a1a1a' : '#111111')
          ctx.fill()
          ctx.strokeStyle = isSelected || isHover ? '#53C68B' : '#333333'
          ctx.lineWidth = 2
          ctx.stroke()

          // Label
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
          ctx.clearRect(0, 0, canvas.width, canvas.height)

          // Draw edges first (behind nodes)
          const seenEdges = new Set()
          for (const e of edges) {
            const key = e.source + '->' + e.target
            if (seenEdges.has(key)) continue
            seenEdges.add(key)
            const a = nodes.get(e.source)
            const b = nodes.get(e.target)
            if (a && b) drawEdge(ctx, a, b)
          }

          // Draw nodes
          for (const n of nodeArr) {
            drawNode(ctx, n, n === hoveredNode, n === selectedNode)
          }

          requestAnimationFrame(render)
        }
        render()

        // ── Mouse interactions ──
        canvas.addEventListener('mousedown', (e) => {
          const rect = canvas.getBoundingClientRect()
          const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
          const node = getNodeAt(world.x, world.y)
          if (node) {
            e.preventDefault()
            e.stopPropagation()
            selectedNode = node
            // Open node content in a new tab next to Brain index
            synAPI.brainRead(node.id).then(result => {
              if (result.ok) {
                const html = renderNoteContent(node.id, result.content)
                createTab(`note-${node.id}`, node.label, html, node.id)
                // Wire up wikilink clicks in this tab
                const contentEl = document.querySelector(`.brain-vault-tab-content[data-tab="note-${node.id}"]`)
                if (contentEl) {
                  contentEl.querySelectorAll('.wiki-link').forEach(link => {
                    link.addEventListener('click', (e) => {
                      e.preventDefault()
                      const targetFile = link.dataset.link + '.md'
                      synAPI.brainRead(targetFile).then(res => {
                        if (res.ok) {
                          const tabId = `note-${targetFile}`
                          const h = renderNoteContent(targetFile, res.content)
                          createTab(tabId, link.dataset.link, h, targetFile)
                        }
                      })
                    })
                  })
                }
              }
            })
            isDragging = false
          } else {
            isDragging = true
            dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top }
          }
        })

        canvas.addEventListener('mousemove', (e) => {
          const rect = canvas.getBoundingClientRect()
          const world = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
          const node = getNodeAt(world.x, world.y)
          hoveredNode = node
          canvas.style.cursor = node ? 'pointer' : 'grab'
          if (node) {
            const s = worldToScreen(node.x, node.y)
            const tip = document.getElementById('graphTooltip')
            tip.style.display = 'block'
            tip.style.left = (s.x + 18) + 'px'
            tip.style.top = (s.y - 28) + 'px'
            tip.textContent = node.label
          } else {
            document.getElementById('graphTooltip').style.display = 'none'
          }
          if (isDragging) {
            offsetX += (e.clientX - rect.left - dragStart.x) / scale
            offsetY += (e.clientY - rect.top - dragStart.y) / scale
            dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top }
          }
        })

        canvas.addEventListener('mouseup', () => { isDragging = false })

        canvas.addEventListener('wheel', (e) => {
          e.preventDefault()
          const rect = canvas.getBoundingClientRect()
          const worldBefore = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
          const delta = -e.deltaY * 0.001
          let newScale = scale * (1 + delta)
          newScale = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE)
          const worldAfter = screenToWorld(e.clientX - rect.left, e.clientY - rect.top)
          offsetX += worldBefore.x - worldAfter.x
          offsetY += worldBefore.y - worldAfter.y
          scale = newScale
        }, { passive: false })

        // Zoom controls
        document.getElementById('graphZoomIn').addEventListener('click', () => {
          scale = Math.min(scale * 1.2, MAX_SCALE)
          document.getElementById('graphZoomVal').textContent = Math.round(scale * 100)
        })
        document.getElementById('graphZoomOut').addEventListener('click', () => {
          scale = Math.max(scale / 1.2, MIN_SCALE)
          document.getElementById('graphZoomVal').textContent = Math.round(scale * 100)
        })
        document.getElementById('graphReset').addEventListener('click', () => {
          scale = 1
          offsetX = 0
          offsetY = 0
          document.getElementById('graphZoomVal').textContent = '100'
        })
      } // end idempotency guard
    } catch (e) {
      console.error('Failed to load brain vault:', e)
      document.getElementById('graphEmpty').textContent = 'Failed to load brain vault: ' + escapeHtml(e.message)
      document.getElementById('graphEmpty').style.display = 'block'
    }
  }

  async function loadBrainIndexContent () {
    try {
      const result = await synAPI.brainRead('index.md')
      if (result.ok) {
        const html = renderNoteContent('index.md', result.content)
        brainVaultIndexContent.innerHTML = html
        // Wire up wikilink clicks in Brain index tab
        brainVaultIndexContent.querySelectorAll('.wiki-link').forEach(link => {
          link.addEventListener('click', (e) => {
            e.preventDefault()
            const targetFile = link.dataset.link + '.md'
            synAPI.brainRead(targetFile).then(res => {
              if (res.ok) {
                const tabId = `note-${targetFile}`
                const h = renderNoteContent(targetFile, res.content)
                createTab(tabId, link.dataset.link, h, targetFile)
              }
            })
          })
        })
      } else {
        const idx = await synAPI.getBrainIndex()
        brainVaultIndexContent.textContent = idx.content || '(brain index empty — rebuild via /brain index)'
      }
    } catch (e) {
      console.error('Failed to load brain index:', e)
      brainVaultIndexContent.textContent = '(brain index unavailable)'
    }
  }

  // Render note content: escape HTML, convert [[wikilink]] to clickable spans
  function renderNoteContent (file, content) {
    let html = escapeHtml(content)
    html = html.replace(/\[\[([^\]]+)\]\]/g, (match, link) => {
      const label = link.replace(/\.md$/, '')
      return '<span class="wiki-link" data-link="' + escapeHtml(label) + '">' + escapeHtml(label) + '</span>'
    })
    html = html.replace(/\n/g, '<br>')
    return html
  }

  // Create a new brain vault tab (note) and switch to it
  function createTab (tabId, label, html, file) {
    const tabs = document.getElementById('brainVaultTabs')
    const notesContainer = document.getElementById('brainVaultTabNotes')

    // If tab already exists, just switch to it
    const existingTab = document.querySelector('.brain-vault-tab[data-tab="' + tabId + '"]')
    if (existingTab) {
      switchBrainVaultTab(tabId)
      return
    }

    // Deactivate all tabs
    document.querySelectorAll('.brain-vault-tab').forEach(tab => tab.classList.remove('active'))
    document.querySelectorAll('.brain-vault-tab-content').forEach(c => c.classList.remove('active'))

    // Create tab button
    const tabBtn = document.createElement('button')
    tabBtn.className = 'brain-vault-tab active'
    tabBtn.dataset.tab = tabId
    tabBtn.innerHTML = escapeHtml(label) + ' <span class="tab-close" data-tab="' + tabId + '">&#215;</span>'

    // Create content div
    const content = document.createElement('div')
    content.className = 'brain-vault-tab-content active brain-vault-note-content'
    content.dataset.tab = tabId
    content.innerHTML = html

    tabs.appendChild(tabBtn)
    notesContainer.appendChild(content)

    // Wire up wikilink clicks in this tab
    content.querySelectorAll('.wiki-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault()
        e.stopPropagation()
        const targetFile = link.dataset.link + '.md'
        synAPI.brainRead(targetFile).then(res => {
          if (res.ok) {
            const newTabId = 'note-' + targetFile
            const h = renderNoteContent(targetFile, res.content)
            createTab(newTabId, link.dataset.link, h, targetFile)
          }
        })
      })
    })
  }

  // Close a brain vault tab by tabId
  function closeTab (tabId) {
    const tabBtn = document.querySelector('.brain-vault-tab[data-tab="' + tabId + '"]')
    const content = document.querySelector('.brain-vault-tab-content[data-tab="' + tabId + '"]')
    if (tabBtn) tabBtn.remove()
    if (content) content.remove()

    // If we closed the active tab, switch to another one
    const activeTab = document.querySelector('.brain-vault-tab.active')
    if (!activeTab) {
      const vaultTab = document.querySelector('.brain-vault-tab[data-tab="vault"]')
      if (vaultTab) {
        switchBrainVaultTab('vault')
      } else {
        const indexTab = document.querySelector('.brain-vault-tab[data-tab="index"]')
        if (indexTab) {
          switchBrainVaultTab('index')
        }
      }
    }
  }

  function switchBrainVaultTab (tabId) {
    document.querySelectorAll('.brain-vault-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabId)
    })
    document.querySelectorAll('.brain-vault-tab-content').forEach(content => {
      content.classList.toggle('active', content.dataset.tab === tabId)
    })
    // Re-render graph when vault tab is shown (canvas needs visible size)
    if (tabId === 'vault') {
      const canvas = document.getElementById('brainGraphCanvas')
      if (canvas) {
        canvas.width = canvas.parentElement.clientWidth
        canvas.height = canvas.parentElement.clientHeight
      }
    }
  }

  // Brain vault tab switching - use event delegation so dynamic tabs work
  document.getElementById('brainVaultTabs').addEventListener('click', (e) => {
    const closeBtn = e.target.closest('.tab-close')
    if (closeBtn) {
      e.stopPropagation()
      const tabId = closeBtn.dataset.tab
      closeTab(tabId)
      return
    }
    const tab = e.target.closest('.brain-vault-tab')
    if (!tab) return
    e.stopPropagation()
    switchBrainVaultTab(tab.dataset.tab)
    // Load brain index content when index tab is selected
    if (tab.dataset.tab === 'index') {
      loadBrainIndexContent()
    }
  })

  btnCloseBrainVault.addEventListener('click', (e) => {
    e.stopPropagation()
    brainVaultOpen = false
    brainVaultPanel.style.display = 'none'
  })

  btnRebuildIndex.addEventListener('click', async (e) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      btnRebuildIndex.disabled = true
      btnRebuildIndex.textContent = 'Rebuilding…'
      dbHealthBadge.style.color = DB_HEALTH_COLORS.rebuilding
      const result = await synAPI.dbRebuild()
      if (result.status === 'rebuilt') {
        btnRebuildIndex.style.display = 'none'
        dbHealthBadge.style.color = DB_HEALTH_COLORS.healthy
        dbHealthBadge.title = 'Index database: healthy (rebuilt)'
      } else {
        btnRebuildIndex.disabled = false
        btnRebuildIndex.textContent = 'Rebuild index'
      }
    } catch (err) {
      console.error('Rebuild failed:', err)
      btnRebuildIndex.disabled = false
      btnRebuildIndex.textContent = 'Rebuild index'
      alert('Rebuild failed: ' + err.message)
    }
  })

  // Close panels when clicking outside
  document.addEventListener('click', (e) => {
    if (menuOpen && !menuPanel.contains(e.target) && e.target !== menuBtn) {
      menuOpen = false
      menuPanel.style.display = 'none'
      // Don't close Brainmaxxing when clicking outside Settings
    }
    // Close Brainmaxxing panel when clicking outside
    if (brainmaxxingOpen && !brainmaxxingPanel.contains(e.target) && e.target !== btnBrainmaxxing) {
      brainmaxxingOpen = false
      brainmaxxingPanel.style.display = 'none'
    }
    // Close Brain vault panel when clicking outside
    if (brainVaultOpen && !brainVaultPanel.contains(e.target) && e.target !== btnBrain) {
      brainVaultOpen = false
      brainVaultPanel.style.display = 'none'
    }
    // Close context menu when clicking outside
    if (ctxMenu.style.display === 'block' && !ctxMenu.contains(e.target)) {
      ctxMenu.style.display = 'none'
    }
    // Close confirm overlay when clicking outside
    if (ctxConfirmOverlay.style.display === 'block' && !ctxConfirmOverlay.contains(e.target)) {
      hideConfirm()
    }
  })

  // Escape key to close open menus / overlays
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (menuOpen) {
        menuOpen = false
        menuPanel.style.display = 'none'
        menuBtn.setAttribute('aria-expanded', 'false')
      }
      if (brainmaxxingOpen) {
        brainmaxxingOpen = false
        brainmaxxingPanel.style.display = 'none'
        btnBrainmaxxing.setAttribute('aria-expanded', 'false')
      }
      if (brainVaultOpen) {
        brainVaultOpen = false
        brainVaultPanel.style.display = 'none'
      }
      if (ctxMenu.style.display === 'block') {
        ctxMenu.style.display = 'none'
      }
      if (ctxConfirmOverlay.style.display === 'block') {
        hideConfirm()
      }
    }

    // Arrow key navigation within session list
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      const sessionItems = sessionList.querySelectorAll('.session-item')
      if (sessionItems.length === 0) return
      if (e.target === terminalInput || e.target === searchInput) return

      const currentIndex = Array.from(sessionItems).indexOf(document.activeElement)
      let newIndex = currentIndex

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        newIndex = Math.min(currentIndex + 1, sessionItems.length - 1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        newIndex = Math.max(currentIndex - 1, 0)
      } else if ((e.key === 'Enter' || e.key === ' ') && currentIndex >= 0) {
        e.preventDefault()
        sessionItems[currentIndex].click()
        return
      }

      if (newIndex !== currentIndex && newIndex >= 0) {
        sessionItems[newIndex].focus()
      }
    }
  })

  // Refresh sessions
  btnRefreshSessions.addEventListener('click', async () => {
    setStatusLoading()
    try {
      await loadSessions()
    } finally {
      setStatusIdle()
    }
  })

  // Add folder
  btnAddFolder.addEventListener('click', async () => {
    const dir = await synAPI.openFolderDialog()
    if (dir) {
      await synAPI.addHarness(dir)
      renderHarnesses()
      try {
        await synAPI.indexAllSources()
      } catch (e) {
        console.error('Indexing failed:', e)
      }
      await loadSessions()
    }
  })

  // ── Brainmaxxing commands ─────────────────────────────────────────────
  async function showBrainResult (title, result) {
    const lines = [
      '<div style="padding:12px;background:#1a1a1a;border:1px solid #333;border-radius:8px;margin-top:12px;">',
      `<div style="font-weight:600;color:#00ccff;margin-bottom:8px">${escapeHtml(title)}</div>`,
      `<div style="color:#e0e0e0;font-size:13px;white-space:pre-wrap">${escapeHtml(JSON.stringify(result, null, 2))}</div>`,
      '</div>'
    ]
    sessionContent.insertAdjacentHTML('beforeend', lines.join(''))
    sessionView.classList.remove('hidden')
    sessionView.style.display = 'flex'
    emptyState.classList.add('hidden')
    emptyState.style.display = 'none'
  }

  btnBrainReflect.addEventListener('click', async (e) => {
    e.stopPropagation()
    if (!selectedSessionId) {
      alert('Select a session first.')
      return
    }
    try {
      const result = await synAPI.brainReflect(selectedSessionId)
      showBrainResult('/reflect', result)
    } catch (err) {
      alert('Reflect failed: ' + err.message)
    }
    menuOpen = false
    menuPanel.style.display = 'none'
  })

  btnBrainMeditate.addEventListener('click', async (e) => {
    e.stopPropagation()
    try {
      const result = await synAPI.brainMeditate()
      showBrainResult('/meditate', result)
    } catch (err) {
      alert('Meditate failed: ' + err.message)
    }
    menuOpen = false
    menuPanel.style.display = 'none'
  })

  btnBrainRuminate.addEventListener('click', async (e) => {
    e.stopPropagation()
    try {
      const result = await synAPI.brainRuminate()
      showBrainResult('/ruminate', result)
    } catch (err) {
      alert('Ruminate failed: ' + err.message)
    }
    menuOpen = false
    menuPanel.style.display = 'none'
  })

  btnBrainPlan.addEventListener('click', async (e) => {
    e.stopPropagation()
    const task = prompt('Enter plan task:')
    if (!task) return
    try {
      const result = await synAPI.brainPlan(task)
      showBrainResult('/plan', result)
    } catch (err) {
      alert('Plan failed: ' + err.message)
    }
    menuOpen = false
    menuPanel.style.display = 'none'
  })

  btnBrainReview.addEventListener('click', async (e) => {
    e.stopPropagation()
    const content = prompt('Enter content to review:')
    if (content === null) return
    try {
      const result = await synAPI.brainReview(content)
      showBrainResult('/review', result)
    } catch (err) {
      alert('Review failed: ' + err.message)
    }
    menuOpen = false
    menuPanel.style.display = 'none'
  })

  btnBrainIndex.addEventListener('click', async (e) => {
    e.stopPropagation()
    try {
      const result = await synAPI.brainIndex()
      showBrainResult('/index', result)
    } catch (err) {
      alert('Index failed: ' + err.message)
    }
    menuOpen = false
    menuPanel.style.display = 'none'
  })

  // Scan & autodetect harnesses
  btnScanHarnesses.addEventListener('click', async () => {
    setStatusLoading()
    try {
      await scanAndAutodetectHarnesses()
    } catch (e) {
      console.error('Scan failed:', e)
      alert('Scan failed: ' + e.message)
    } finally {
      setStatusIdle()
    }
    menuOpen = false
    menuPanel.style.display = 'none'
  })

  // Batch size setting
  settingBatchSize.addEventListener('change', async (e) => {
    batchSize = parseInt(e.target.value, 10)
    await synAPI.setConfig({ batchSize })
  })

  // ── Terminal command input ────────────────────────────────────────────
  terminalInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const raw = terminalInput.value.trim()
      terminalInput.value = ''
      if (!raw) return

      // Add to history
      terminalHistory.push(raw)
      terminalHistoryIndex = terminalHistory.length

      // Echo command
      appendTerminalLine(`$ ${raw}`, 'cmd')

      try {
        await executeTerminalCommand(raw)
      } catch (err) {
        appendTerminalLine(`Error: ${err.message}`, 'error')
      }
      terminalOutput.scrollTop = terminalOutput.scrollHeight
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (terminalHistoryIndex > 0) {
        terminalHistoryIndex--
        terminalInput.value = terminalHistory[terminalHistoryIndex]
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (terminalHistoryIndex < terminalHistory.length - 1) {
        terminalHistoryIndex++
        terminalInput.value = terminalHistory[terminalHistoryIndex]
      } else {
        terminalHistoryIndex = terminalHistory.length
        terminalInput.value = ''
      }
    }
  })

  // Terminal column toggle (Kindle-style triangle button)
  btnCloseTerminal.addEventListener('click', (e) => {
    e.stopPropagation()
    terminalVisible = !terminalVisible
    if (terminalVisible) {
      terminalColumn.style.display = 'flex'
      resizerTerminal.style.display = 'block'
      btnCloseTerminal.textContent = '◀'
      btnCloseTerminal.className = 'terminal-toggle open'
      updateTogglePosition()
    } else {
      terminalColumn.style.display = 'none'
      resizerTerminal.style.display = 'none'
      btnCloseTerminal.textContent = '▶'
      btnCloseTerminal.className = 'terminal-toggle closed'
      updateTogglePosition()
    }
  })

  // Update terminal toggle position based on terminal state and resizer position
  function updateTogglePosition () {
    if (!btnCloseTerminal || !terminalColumn) return
    const terminalWidth = terminalVisible ? terminalColumn.offsetWidth : 0

    if (terminalVisible) {
      // Attach to terminal's interior left edge, flush against resizer (inside terminal column)
      btnCloseTerminal.style.right = (terminalWidth - 10) + 'px'
      btnCloseTerminal.style.top = '50%'
      btnCloseTerminal.style.transform = 'translateY(-50%)'
      btnCloseTerminal.style.position = 'absolute'
    } else {
      // Attach to right edge of screen, clear scrollbar/resizer zone
      btnCloseTerminal.style.right = '14px'
      btnCloseTerminal.style.top = '50%'
      btnCloseTerminal.style.transform = 'translateY(-50%)'
      btnCloseTerminal.style.position = 'absolute'
    }
  }

  // Status indicator: toggle between idle and loading/working GIF
  function setStatusIdle () {
    if (statusIndicatorImg) statusIndicatorImg.src = '../assets/idle.gif'
  }

  function setStatusLoading () {
    if (statusIndicatorImg) {
      statusIndicatorImg.src = ''
      statusIndicatorImg.src = '../assets/loading-working.gif'
    }
  }

  async function executeTerminalCommand (raw) {
    const parts = raw.split(/\s+/)
    const cmd = parts[0].toLowerCase()
    const args = parts.slice(1)

    setStatusLoading()
    try {
      switch (cmd) {
      case '/locate': {
        if (args.length === 0) {
          appendTerminalLine('Usage: /locate <search query> [filters...]', 'warn')
          appendTerminalLine('Filters: harness:X, date:YYYY-MM-DD, role:user, role:assistant, brain:X', 'warn')
          return
        }
        const raw = args.join(' ')
        const { query, options } = parseSearchFilters(raw)
        appendTerminalLine(`/locate "${query}" ${JSON.stringify(options)}`, 'cmd')
        const results = await synAPI.searchSessions(query, { batchSize, ...options })
        renderSearchResults(results)
        break
      }

      case '/reflect': {
        const sessionId = args[0] || selectedSessionId
        if (!sessionId) {
          appendTerminalLine('Usage: /reflect <sessionId> (or select a session first)', 'warn')
          return
        }
        const result = await synAPI.brainReflect(sessionId)
        appendTerminalLine(`/reflect → ${result.path || 'done'}`, 'ok')
        appendTerminalLine(`Learnings: ${result.learningsCount || 0}`, 'ok')
        break
      }

      case '/meditate': {
        const result = await synAPI.brainMeditate()
        appendTerminalLine(`/meditate → ${result.path || 'done'}`, 'ok')
        appendTerminalLine(`Files audited: ${result.filesAudited || 0}, principles: ${result.principlesExtracted || 0}, stale: ${result.staleNotes ? result.staleNotes.length : 0}`, 'ok')
        break
      }

      case '/ruminate': {
        const result = await synAPI.brainRuminate()
        appendTerminalLine(`/ruminate → ${result.path || 'done'}`, 'ok')
        appendTerminalLine(`Sessions scanned: ${result.sessionsScanned || 0}, patterns: ${result.patternsFound || 0}`, 'ok')
        break
      }

      case '/plan': {
        const task = args.join(' ')
        if (!task) {
          appendTerminalLine('Usage: /plan <task description>', 'warn')
          return
        }
        const result = await synAPI.brainPlan(task)
        appendTerminalLine(`/plan → ${result.path || 'done'}`, 'ok')
        appendTerminalLine(`Task: ${result.task || task}`, 'ok')
        break
      }

      case '/review': {
        const content = args.join(' ')
        if (!content) {
          appendTerminalLine('Usage: /review <content to review>', 'warn')
          return
        }
        const result = await synAPI.brainReview(content)
        appendTerminalLine(`/review → ${result.path || 'done'}`, 'ok')
        if (result.issues && result.issues.length) {
          result.issues.forEach((issue, i) => {
            appendTerminalLine(`  ${i + 1}. [${issue.severity}] ${issue.message}`, 'warn')
          })
        } else {
          appendTerminalLine('No issues found.', 'ok')
        }
        break
      }

      case '/brain': {
        const sub = args[0]
        if (sub === 'list') {
          const files = await synAPI.brainList()
          appendTerminalLine('Brain files:', 'ok')
          files.forEach(f => appendTerminalLine(`  [[${f}]]`, 'ok'))
        } else if (sub === 'index') {
          const result = await synAPI.brainIndex()
          appendTerminalLine(`/brain index → ${result.files} files indexed`, 'ok')
        } else if (sub === 'read') {
          const path = args[1]
          if (!path) {
            appendTerminalLine('Usage: /brain read <path>', 'warn')
            return
          }
          const result = await synAPI.brainRead(path)
          if (result.ok) {
            appendTerminalLine(`--- ${path} ---`, 'ok')
            appendTerminalLine(result.content, 'ok')
          } else {
            appendTerminalLine(`Read failed: ${result.error}`, 'error')
          }
        } else if (sub === 'write') {
          const path = args[1]
          const content = args.slice(2).join(' ')
          if (!path || !content) {
            appendTerminalLine('Usage: /brain write <path> <content>', 'warn')
            return
          }
          const result = await synAPI.brainWrite(path, content)
          appendTerminalLine(`/brain write → ${result.path}`, 'ok')
        } else {
          appendTerminalLine('Usage: /brain <list|index|read <path>|write <path> <content>>', 'warn')
        }
        break
      }

      case '/syn': {
        appendTerminalLine('/syn — Syn skill guidance', 'keyword')
        appendTerminalLine('Use /locate <query> to search sessions and Memory Vault.', 'info')
        appendTerminalLine('Use /reflect, /meditate, /ruminate, /plan, /review for brainmaxxing.', 'info')
        appendTerminalLine('Use /brain <read|write|list|index> for Memory Vault file ops.', 'info')
        appendTerminalLine('Click any search result to open the session.', 'hint')
        break
      }

      case '/help': {
        appendTerminalLine('Available commands:', 'keyword')
        appendTerminalLine('  /locate <query> [filters]  — search sessions + Memory Vault', 'string')
        appendTerminalLine('  /reflect [sessionId]       — reflect on a session', 'string')
        appendTerminalLine('  /meditate                  — audit brain vault', 'string')
        appendTerminalLine('  /ruminate                  — mine session patterns', 'string')
        appendTerminalLine('  /plan <task>               — create phased plan', 'string')
        appendTerminalLine('  /review <content>          — review content against principles', 'string')
        appendTerminalLine('  /brain <list|index|read|write>  — Memory Vault file ops', 'string')
        appendTerminalLine('  /syn                       — skill guidance', 'string')
        appendTerminalLine('  /help                      — this help', 'string')
        appendTerminalLine('Tip: click any search result to open the session.', 'hint')
        break
      }

      default: {
        appendTerminalLine(`Unknown command: ${cmd}. Type /help for available commands.`, 'error')
      }
      }
    } finally {
      setStatusIdle()
    }
  }

  function appendTerminalLine (text, type = 'normal') {
    const div = document.createElement('div')
    div.className = `terminal-line terminal-${type}`
    div.textContent = text
    terminalOutput.appendChild(div)
    terminalOutput.scrollTop = terminalOutput.scrollHeight
  }

  function renderSearchResults (results) {
    if (!results || results.length === 0) {
      appendTerminalLine('No results found.', 'warn')
      return
    }
    appendTerminalLine(`Found ${results.length} result${results.length !== 1 ? 's' : ''}:`, 'ok')
    results.forEach((r) => {
      const div = document.createElement('div')
      div.className = 'terminal-result'
      div.innerHTML = `
        <div class="title"><span style="color:#ff69b4">▸</span> ${escapeHtml(r.title || '')} <span class="meta">[${escapeHtml(r.harness || '')}]</span></div>
        ${r.snippet ? `<div class="meta" style="font-size:11px;color:#53C68B;margin-top:2px">${escapeHtml(r.snippet)}</div>` : ''}
      `
      div.style.cursor = 'pointer'
      div.addEventListener('click', () => {
        selectedSessionId = r.id
        renderSessionList(allSessions)
        loadSessionContent(r)
      })
      terminalOutput.appendChild(div)
    })
  }

  // ── Search bar (top, search-only, no terminal features) ──
  searchInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      await performSearch()
    }
  })

  // Parse filter tokens (harness:, project:, date:, role:, brain:) out of the
  // free-text query. Returns { query, options } where query is the remaining
  // free-text and options holds the parsed filters for the search engine.
  function parseSearchFilters (raw) {
    const options = {}
    let query = raw

    // brain: (no value) toggles brain/vault filtering
    const brainMatch = query.match(/\bbrain:\s*/i)
    if (brainMatch) {
      options.brain = true
      query = query.replace(brainMatch[0], ' ')
    }

    // date:YYYY-MM-DD or date:YYYY-MM-DD..YYYY-MM-DD (range)
    const dateMatch = query.match(/\bdate:(\S+)/i)
    if (dateMatch) {
      const range = dateMatch[1].split('..')
      options.dateFrom = range[0]
      if (range[1]) options.dateTo = range[1]
      query = query.replace(dateMatch[0], ' ')
    }

    // harness:NAME
    const harnessMatch = query.match(/\bharness:(\S+)/i)
    if (harnessMatch) {
      options.harness = harnessMatch[1]
      query = query.replace(harnessMatch[0], ' ')
    }

    // project:PATH
    const projectMatch = query.match(/\bproject:(\S+)/i)
    if (projectMatch) {
      options.project = projectMatch[1]
      query = query.replace(projectMatch[0], ' ')
    }

    // role:ROLE (message-level; accepted for API compatibility)
    const roleMatch = query.match(/\brole:(\S+)/i)
    if (roleMatch) {
      options.role = roleMatch[1]
      query = query.replace(roleMatch[0], ' ')
    }

    return { query: query.trim().replace(/\s+/g, ' '), options }
  }

  async function performSearch () {
    const raw = searchInput.value.trim()
    if (!raw) {
      renderSessionList(allSessions)
      searchQuery = ''
      return
    }
    const { query, options } = parseSearchFilters(raw)
    searchQuery = raw
    setStatusLoading()
    try {
      const results = await synAPI.searchSessions(query, { batchSize, ...options })
      renderSearchResultsList(results, raw)
    } catch (err) {
      console.error('Search failed:', err)
      sessionList.innerHTML = `<div style="padding:12px;color:#ff6666;font-size:13px">Search failed: ${escapeHtml(err.message)}</div>`
    } finally {
      setStatusIdle()
    }
  }

  function renderSearchResultsList (results, query) {
    emptyState.classList.add('hidden')
    emptyState.style.display = 'none'
    sessionView.classList.add('hidden')
    sessionView.style.display = 'none'
    sessionList.innerHTML = ''

    const title = document.createElement('div')
    title.style.padding = '8px 12px'
    title.style.fontSize = '12px'
    title.style.color = '#888888'
    title.style.borderBottom = '1px solid #333333'
    title.textContent = `Search results for "${escapeHtml(query)}" (${results.length})`
    sessionList.appendChild(title)

    if (!results || results.length === 0) {
      const empty = document.createElement('div')
      empty.style.padding = '12px'
      empty.style.color = '#666666'
      empty.style.fontSize = '13px'
      empty.style.fontStyle = 'italic'
      empty.textContent = 'No results found.'
      sessionList.appendChild(empty)
      return
    }

    const fragment = document.createDocumentFragment()
    results.forEach((r) => {
      const item = document.createElement('div')
      const label = highlightText(escapeHtml(r.title || ''), searchQuery)
      const snippet = r.snippet ? highlightText(escapeHtml(r.snippet), searchQuery) : ''
      const snippetHtml = snippet
        ? `<div class="snippet">${snippet}</div>`
        : ''
      item.className = 'session-item'
      item.setAttribute('tabindex', '0')
      item.setAttribute('role', 'option')
      item.setAttribute('aria-label', `${escapeHtml(r.title || '')} - ${escapeHtml(r.harness || '')}`)
      item.innerHTML = `
        <div class="label">${label}</div>
        <div class="harness">${escapeHtml(r.harness || '')}</div>
        ${snippetHtml}
      `
      item.addEventListener('click', () => {
        selectedSessionId = r.id
        searchQuery = ''
        searchInput.value = ''
        renderSessionList(allSessions)
        loadSessionContent(r)
      })
      // Right-click context menu on search results
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        e.stopPropagation()
        ctxMenu.style.display = 'none'
        ctxTargetSessionId = r.id
        // Position menu near cursor, clamped to viewport
        let left = e.clientX
        let top = e.clientY
        const menuWidth = ctxMenu.offsetWidth || 200
        const menuHeight = ctxMenu.offsetHeight || 120
        if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 8
        if (top + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight - 8
        if (left < 8) left = 8
        if (top < 8) top = 8
        ctxMenu.style.left = left + 'px'
        ctxMenu.style.top = top + 'px'
        ctxMenu.style.display = 'block'
      })
      fragment.appendChild(item)
    })
    sessionList.appendChild(fragment)
  }

  function highlightText (html, query) {
    if (!query) return html
    // Highlight each query term individually (multi-term queries).
    const terms = query.trim().split(/\s+/).filter((t) => t.length > 0)
    let out = html
    for (const term of terms) {
      const escaped = escapeHtml(term)
      const re = new RegExp(`(${escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
      out = out.replace(re, '<span class="highlight">$1</span>')
    }
    return out
  }

  // Close session
  btnCloseSession.addEventListener('click', (e) => {
    e.stopPropagation()
    closeSession()
  })

  // Context menu: Copy Session ID
  ctxCopySessionId.addEventListener('click', async (e) => {
    e.stopPropagation()
    ctxMenu.style.display = 'none'
    if (!ctxTargetSessionId) return
    try {
      await navigator.clipboard.writeText(ctxTargetSessionId)
      // Visual feedback: flash the menu item text
      const original = ctxCopySessionId.textContent
      ctxCopySessionId.textContent = 'Copied!'
      ctxCopySessionId.style.color = '#53C68B'
      setTimeout(() => {
        ctxCopySessionId.textContent = original
        ctxCopySessionId.style.color = ''
      }, 1000)
    } catch (err) {
      console.error('Copy failed:', err)
      alert('Failed to copy session ID: ' + err.message)
    }
    ctxTargetSessionId = null
  })

  // Context menu: Delete Entry (white text) - removes from index only, confirmation required
  ctxDeleteEntry.addEventListener('click', async (e) => {
    e.stopPropagation()
    ctxMenu.style.display = 'none'
    if (!ctxTargetSessionId) return
    showConfirm(
      'Delete Entry from Index?',
      `This will remove the session from the search index:\n${ctxTargetSessionId}\n\nThe original archive file is NOT deleted. This can be undone by re-indexing.`,
      async () => {
        hideConfirm()
        try {
          await synAPI.deleteSession(ctxTargetSessionId)
          allSessions = allSessions.filter(s => s.id !== ctxTargetSessionId)
          if (selectedSessionId === ctxTargetSessionId) {
            closeSession()
          }
          renderSessionList(allSessions)
        } catch (err) {
          console.error('Delete entry failed:', err)
          alert('Failed to delete entry: ' + err.message)
        }
        ctxTargetSessionId = null
      }
    )
  })

  ctxConfirmCancel.addEventListener('click', () => {
    hideConfirm()
    ctxTargetSessionId = null
  })

  ctxConfirmDelete.addEventListener('click', async () => {
    hideConfirm()
    if (pendingConfirm) {
      await pendingConfirm()
      pendingConfirm = null
    }
    ctxTargetSessionId = null
  })

  function showConfirm (title, message, onConfirm) {
    ctxConfirmTitle.textContent = title
    ctxConfirmMessage.textContent = message
    pendingConfirm = onConfirm
    ctxConfirmOverlay.style.display = 'flex'
  }

  function hideConfirm () {
    ctxConfirmOverlay.style.display = 'none'
    pendingConfirm = null
  }

  function closeSession () {
    selectedSessionId = null
    sessionView.classList.add('hidden')
    sessionView.style.display = 'none'
    emptyState.classList.remove('hidden')
    emptyState.style.display = 'flex'
    renderSessionList(allSessions)
  }

  async function init () {
    setStatusLoading()
    try {
      const config = await synAPI.getConfig()
      batchSize = config.batchSize || 10
      settingBatchSize.value = String(batchSize)

      // Load harness enable/disable settings
      try {
        const settings = await synAPI.getHarnessSettings()
        harnessSettings = Object.fromEntries(settings.map(s => [s.name, s.enabled]))
        renderHarnessSettings()
      } catch (e) {
        console.error('Failed to load harness settings:', e)
      }

      // Auto-detect harnesses on first run if none configured
      if (!config.harnessDirectories || config.harnessDirectories.length === 0) {
        await scanAndAutodetectHarnesses()
      } else {
        // Ensure all configured sources are registered in the engine (idempotent)
        for (const dir of config.harnessDirectories) {
          try {
            await synAPI.addHarness(dir)
          } catch (e) {
            console.error('Failed to add harness:', dir, e.message)
          }
        }

        // Index all sources so sessions appear in the list
        try {
          await synAPI.indexAllSources()
        } catch (e) {
          console.error('Indexing failed:', e.message)
        }

        // Load sessions from all configured harnesses
        await loadSessions()

        // Welcome message in terminal (matches UI Sketch terminal look)
        appendTerminalLine('syn@agent:~$', 'ok')
        appendTerminalLine('  Syn — unified agent memory environment', 'normal')
        appendTerminalLine('  Type /help for commands, or /locate <query> to search.', 'normal')
        appendTerminalLine('', 'normal')
      }
    } catch (e) {
      console.error('Init failed:', e)
      alert('Init failed: ' + e.message)
    } finally {
      setStatusIdle()
    }
  }

  async function loadSessions () {
    setStatusLoading()
    allSessions = await synAPI.listAllSessions()
    renderSessionList(allSessions)
    setStatusIdle()
  }

  function renderSessionList (sessions) {
    sessionList.innerHTML = ''

    // If no session is selected, show empty state
    if (!selectedSessionId) {
      emptyState.classList.remove('hidden')
      emptyState.style.display = 'flex'
      sessionView.classList.add('hidden')
      sessionView.style.display = 'none'
    } else {
      emptyState.classList.add('hidden')
      emptyState.style.display = 'none'
      sessionView.classList.remove('hidden')
      sessionView.style.display = 'flex'
    }

    if (sessions.length === 0) {
      sessionList.innerHTML = '<div style="padding:12px;color:#666;font-size:12px">No sessions found. Add a harness directory from the menu.</div>'
      return
    }

    const fragment = document.createDocumentFragment()
    sessions.forEach((s) => {
      const item = document.createElement('div')
      item.className = `session-item${selectedSessionId === s.id ? ' selected' : ''}`
      item.setAttribute('tabindex', '0')
      item.setAttribute('role', 'option')
      item.setAttribute('aria-label', `${escapeHtml(s.title)} - ${escapeHtml(s.harness)}`)
      item.setAttribute('aria-selected', String(selectedSessionId === s.id))
      item.innerHTML = `
        <div class="label">${escapeHtml(s.title)}</div>
        <div class="harness">${escapeHtml(s.harness)}</div>
      `
      item.addEventListener('click', () => {
        selectedSessionId = s.id
        renderSessionList(allSessions)
        loadSessionContent(s)
      })

      // Right-click context menu
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        e.stopPropagation()
        ctxMenu.style.display = 'none'
        ctxTargetSessionId = s.id
        // Position menu near cursor, clamped to viewport
        let left = e.clientX
        let top = e.clientY
        const menuWidth = ctxMenu.offsetWidth || 200
        const menuHeight = ctxMenu.offsetHeight || 120
        if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 8
        if (top + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight - 8
        if (left < 8) left = 8
        if (top < 8) top = 8
        ctxMenu.style.left = left + 'px'
        ctxMenu.style.top = top + 'px'
        ctxMenu.style.display = 'block'
      })

      fragment.appendChild(item)
    })
    sessionList.appendChild(fragment)
  }

  async function loadSessionContent (session) {
    emptyState.classList.add('hidden')
    emptyState.style.display = 'none'
    sessionView.classList.remove('hidden')
    sessionView.style.display = 'flex'

    metaHarness.textContent = session.harness
    metaSessionId.textContent = session.id
    metaPath.textContent = session.file_path || session.source_path

    setStatusLoading()
    try {
      const data = await synAPI.readSession(session.id)
      const messages = data.messages || []
      renderMessages(messages)
    } catch (e) {
      sessionContent.innerHTML = `<div style="color:#ff6666;padding:12px">Error loading session: ${escapeHtml(e.message)}</div>`
    } finally {
      setStatusIdle()
    }
  }

  function renderMessages (messages) {
    if (!messages || messages.length === 0) {
      sessionContent.innerHTML = '<div style="color:#666;font-style:italic;padding:12px">No messages found.</div>'
      return
    }

    const parts = []
    messages.forEach((m, i) => {
      const role = (m.role || 'unknown').toLowerCase()
      const roleColor = role === 'user' ? '#53C68B' : role === 'assistant' ? '#00ccff' : '#888888'
      const roleLabel = role.charAt(0).toUpperCase() + role.slice(1)
      const ts = m.timestamp ? ` <span style="color:#666;font-size:11px;margin-left:8px">${escapeHtml(m.timestamp)}</span>` : ''
      const content = escapeHtml(m.content || '')
      const highlighted = searchQuery ? highlightText(content, searchQuery) : content
      parts.push(`
        <div class="message" style="margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #222;">
          <div style="display:flex;align-items:baseline;margin-bottom:6px;">
            <span style="color:${roleColor};font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:0.5px">${roleLabel}</span>${ts}
          </div>
          <div style="color:#e0e0e0;line-height:1.6;white-space:pre-wrap;font-size:14px">${highlighted}</div>
        </div>
      `)
    })
    sessionContent.innerHTML = parts.join('')
  }

  async function scanAndAutodetectHarnesses () {
    setStatusLoading()
    try {
      const detected = await synAPI.autodetectHarnesses()
      const current = await synAPI.listHarnesses()
      const currentPaths = new Set(current.map(h => h.path))
      let added = 0
      for (const d of detected) {
        if (!currentPaths.has(d)) {
          await synAPI.addHarness(d)
          added++
        }
      }

      renderHarnesses()

      // Index all sources so sessions appear in the list
      try {
        await synAPI.indexAllSources()
      } catch (e) {
        console.error('Indexing failed:', e)
      }

      try {
        await loadSessions()
      } catch (e) {
        console.error('Loading sessions failed:', e)
      }

      // Notify user
      const btn = btnScanHarnesses
      const orig = btn.textContent
      btn.textContent = `Found ${added} new harness${added !== 1 ? 'es' : ''}`
      setTimeout(() => { btn.textContent = orig }, 2000)
    } catch (e) {
      console.error('Scan failed:', e)
      alert('Scan failed: ' + e.message)
    } finally {
      setStatusIdle()
    }
    menuOpen = false
    menuPanel.style.display = 'none'
  }

  function renderHarnesses () {
    loadHarnesses()
  }

  async function loadHarnesses () {
    const harnesses = await synAPI.listHarnesses()
    harnessList.innerHTML = ''

    if (harnesses.length === 0) {
      harnessList.innerHTML = '<div style="padding:8px;color:#666;font-size:12px">No harnesses configured</div>'
      return
    }

    // Group by harness name to compact duplicates
    const grouped = new Map()
    harnesses.forEach((h) => {
      const key = h.harness || h.name || h.path
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key).push(h)
    })

    grouped.forEach((items, harnessName) => {
      const item = document.createElement('div')
      item.className = 'harness-item'
      const suffix = items.length > 1 ? ` (${items.length})` : ''
      item.innerHTML = `
        <span>${escapeHtml(harnessName)}${suffix}</span>
        <span class="remove" aria-label="Remove ${escapeHtml(harnessName)}" title="Remove">&#215;</span>
      `
      const removeBtn = item.querySelector('.remove')
      removeBtn.addEventListener('click', async (e) => {
        e.stopPropagation()
        try {
          // Remove all directories for this harness
          for (const h of items) {
            await synAPI.removeHarness(h.path || h)
          }
          loadHarnesses()
          await loadSessions()
        } catch (err) {
          console.error('Remove harness failed:', err)
          alert('Failed to remove harness: ' + err.message)
        }
      })
      harnessList.appendChild(item)
    })
  }

  // Render per-harness enable/disable toggles
  function renderHarnessSettings () {
    if (!harnessSettingsEl) return
    const names = Object.keys(harnessSettings).sort()
    harnessSettingsEl.innerHTML = ''

    if (names.length === 0) {
      harnessSettingsEl.innerHTML = '<div style="padding:8px;color:#666;font-size:12px">No harnesses detected yet.</div>'
      return
    }

    names.forEach((name) => {
      const enabled = harnessSettings[name] !== false
      const row = document.createElement('div')
      row.className = 'setting-row harness-row'
      row.innerHTML = `
        <label class="harness-label" data-harness="${escapeHtml(name)}" aria-label="${escapeHtml(name)}">
          <input type="checkbox" class="harness-toggle" data-harness="${escapeHtml(name)}" ${enabled ? 'checked' : ''} aria-checked="${enabled}">
          <span>${escapeHtml(name)}</span>
        </label>
      `
      const toggle = row.querySelector('.harness-toggle')
      toggle.addEventListener('change', async (e) => {
        const on = e.target.checked
        harnessSettings[name] = on
        try {
          await synAPI.setHarnessSetting(name, on)
          await loadSessions()
          renderHarnessSettings()
        } catch (err) {
          console.error('Failed to save harness setting:', err)
          e.target.checked = !on
          harnessSettings[name] = !on
          alert('Failed to save harness setting: ' + err.message)
        }
      })
      harnessSettingsEl.appendChild(row)
    })
  }

  // Initialize
  init()

  // ── Column resizing ─────────────────────────────────────────────────
  const sidebar = document.querySelector('.sidebar')
  const panel = document.querySelector('.panel')
  const resizerSidebar = document.getElementById('resizerSidebar')
  const resizerTerminal = document.getElementById('resizerTerminal')

  let resizing = false
  let resizerType = null
  let startX = 0
  let startSidebarWidth = 300
  let startTerminalWidth = 500

  function startResize (e, type) {
    e.preventDefault()
    resizing = true
    resizerType = type
    startX = e.clientX
    startSidebarWidth = sidebar.offsetWidth
    startTerminalWidth = terminalColumn.offsetWidth
    document.body.style.cursor = 'col-resize'
    if (type === 'sidebar') {
      resizerSidebar.classList.add('active')
    } else {
      resizerTerminal.classList.add('active')
    }
  }

  function endResize () {
    resizing = false
    resizerType = null
    document.body.style.cursor = ''
    resizerSidebar.classList.remove('active')
    resizerTerminal.classList.remove('active')
  }

  function doResize (e) {
    if (!resizing) return
    e.preventDefault()
    const dx = e.clientX - startX
    const containerWidth = document.querySelector('.container').offsetWidth
    const minWidth = 280

    if (resizerType === 'sidebar') {
      let newWidth = startSidebarWidth + dx
      newWidth = Math.max(minWidth, Math.min(newWidth, containerWidth - minWidth - 280))
      sidebar.style.width = newWidth + 'px'
      panel.style.flex = '1'
      resizerSidebar.style.left = newWidth + 'px'
    } else if (resizerType === 'terminal') {
      let newWidth = startTerminalWidth - dx
      newWidth = Math.max(minWidth, Math.min(newWidth, containerWidth - minWidth - 280))
      terminalColumn.style.width = newWidth + 'px'
      terminalColumn.style.flex = '0 0 auto'
      panel.style.flex = '1'
      resizerTerminal.style.right = newWidth + 'px'
      // Update toggle position if terminal is visible
      if (terminalVisible) {
        updateTogglePosition()
      }
    }
  }

  resizerSidebar.addEventListener('mousedown', (e) => startResize(e, 'sidebar'))
  resizerTerminal.addEventListener('mousedown', (e) => startResize(e, 'terminal'))
  document.addEventListener('mousemove', doResize)
  document.addEventListener('mouseup', endResize)

  // Check DB health on startup (Gate G7)
  checkDbHealth()
}

// Helpers
function escapeHtml (text) {
  if (!text) return ''
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setup)
} else {
  setup()
}

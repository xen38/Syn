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
  // Terminal starts open per spec: â—€ = open (arrow points left toward terminal, click to close)
  let terminalVisible = true
  btnCloseTerminal.textContent = 'â—€'
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
  const ctxArchiveOnVault = document.getElementById('ctxArchiveOnVault')
  const ctxDeleteEntry = document.getElementById('ctxDeleteEntry')
  const ctxConfirmOverlay = document.getElementById('ctxConfirmOverlay')
  const ctxConfirmTitle = document.getElementById('ctxConfirmTitle')
  const ctxConfirmMessage = document.getElementById('ctxConfirmMessage')
  const ctxConfirmCancel = document.getElementById('ctxConfirmCancel')
  const ctxConfirmDelete = document.getElementById('ctxConfirmDelete')

  // Close session button
  const btnCloseSession = document.getElementById('btnCloseSession')

  // State
  let allSessions = []
  let selectedSessionId = null
  let menuOpen = false
  let brainmaxxingOpen = false
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

  // Brain button click - opens standalone Brain Vault window
  btnBrain.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    synAPI.brainVaultOpen()
  })

  // â”€â”€ Database health (Gate G7) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        btnRebuildIndex.textContent = status === 'corrupt' ? 'Rebuild index' : 'Rebuildingâ€¦'
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

  btnRebuildIndex.addEventListener('click', async (e) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      btnRebuildIndex.disabled = true
      btnRebuildIndex.textContent = 'Rebuildingâ€¦'
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

  // â”€â”€ Brainmaxxing commands â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Terminal command input â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      btnCloseTerminal.textContent = 'â—€'
      btnCloseTerminal.className = 'terminal-toggle open'
      updateTogglePosition()
    } else {
      terminalColumn.style.display = 'none'
      resizerTerminal.style.display = 'none'
      btnCloseTerminal.textContent = 'â–¶'
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
        appendTerminalLine(`/reflect â†’ ${result.path || 'done'}`, 'ok')
        appendTerminalLine(`Learnings: ${result.learningsCount || 0}`, 'ok')
        break
      }

      case '/meditate': {
        const result = await synAPI.brainMeditate()
        appendTerminalLine(`/meditate â†’ ${result.path || 'done'}`, 'ok')
        appendTerminalLine(`Files audited: ${result.filesAudited || 0}, principles: ${result.principlesExtracted || 0}, stale: ${result.staleNotes ? result.staleNotes.length : 0}`, 'ok')
        break
      }

      case '/ruminate': {
        const result = await synAPI.brainRuminate()
        appendTerminalLine(`/ruminate â†’ ${result.path || 'done'}`, 'ok')
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
        appendTerminalLine(`/plan â†’ ${result.path || 'done'}`, 'ok')
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
        appendTerminalLine(`/review â†’ ${result.path || 'done'}`, 'ok')
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
          appendTerminalLine(`/brain index â†’ ${result.files} files indexed`, 'ok')
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
          appendTerminalLine(`/brain write â†’ ${result.path}`, 'ok')
        } else {
          appendTerminalLine('Usage: /brain <list|index|read <path>|write <path> <content>>', 'warn')
        }
        break
      }

      case '/syn': {
        appendTerminalLine('/syn â€” Syn skill guidance', 'keyword')
        appendTerminalLine('Use /locate <query> to search sessions and Memory Vault.', 'info')
        appendTerminalLine('Use /reflect, /meditate, /ruminate, /plan, /review for brainmaxxing.', 'info')
        appendTerminalLine('Use /brain <read|write|list|index> for Memory Vault file ops.', 'info')
        appendTerminalLine('Click any search result to open the session.', 'hint')
        break
      }

      case '/help': {
        appendTerminalLine('Available commands:', 'keyword')
        appendTerminalLine('  /locate <query> [filters]  â€” search sessions + Memory Vault', 'string')
        appendTerminalLine('  /reflect [sessionId]       â€” reflect on a session', 'string')
        appendTerminalLine('  /meditate                  â€” audit brain vault', 'string')
        appendTerminalLine('  /ruminate                  â€” mine session patterns', 'string')
        appendTerminalLine('  /plan <task>               â€” create phased plan', 'string')
        appendTerminalLine('  /review <content>          â€” review content against principles', 'string')
        appendTerminalLine('  /brain <list|index|read|write>  â€” Memory Vault file ops', 'string')
        appendTerminalLine('  /syn                       â€” skill guidance', 'string')
        appendTerminalLine('  /help                      â€” this help', 'string')
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
        <div class="title"><span style="color:#ff69b4">â–¸</span> ${escapeHtml(r.title || '')} <span class="meta">[${escapeHtml(r.harness || '')}]</span></div>
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

  // â”€â”€ Search bar (top, search-only, no terminal features) â”€â”€
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
      const [sessionResults, vaultResults] = await Promise.all([
        synAPI.searchSessions(query, { batchSize, ...options }),
        searchBrainVault(raw)
      ])
      const allResults = [
        ...sessionResults.map(r => ({ ...r, source: 'session' })),
        ...vaultResults.map(r => ({ ...r, source: 'vault' }))
      ]
      renderSearchResultsList(allResults, raw)
    } catch (err) {
      console.error('Search failed:', err)
      sessionList.innerHTML = `<div style="padding:12px;color:#ff6666;font-size:13px">Search failed: ${escapeHtml(err.message)}</div>`
    } finally {
      setStatusIdle()
    }
  }

  // Search across all .md files in the Brain Vault (names + content).
  // Returns results shaped like session results but with source:'vault' and a path field.
  async function searchBrainVault (query) {
    const files = await synAPI.brainList()
    const results = []
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0)

    for (const file of files) {
      try {
        const result = await synAPI.brainRead(file)
        if (!result.ok) continue
        const content = result.content || ''
        const lowerContent = content.toLowerCase()
        const lowerName = file.toLowerCase()

        let matchScore = 0
        let snippet = ''

        // Filename match
        const nameMatch = terms.some(t => lowerName.includes(t))
        if (nameMatch) matchScore += 10

        // Content match
        const contentMatch = terms.some(t => lowerContent.includes(t))
        if (contentMatch) matchScore += 5

        if (nameMatch || contentMatch) {
          // Build a snippet around the first content match
          for (const term of terms) {
            const idx = lowerContent.indexOf(term)
            if (idx >= 0) {
              const start = Math.max(0, idx - 60)
              const end = Math.min(content.length, idx + 60 + term.length)
              snippet = content.substring(start, end)
              break
            }
          }
          if (!snippet && nameMatch) {
            snippet = '(filename match)'
          }

          results.push({
            id: 'vault:' + file,
            title: file,
            harness: 'vault',
            snippet: snippet,
            source: 'vault',
            path: file,
            matchScore: matchScore
          })
        }
      } catch (e) {
        console.error('Failed to read vault file ' + file + ':', e)
      }
    }

    return results.sort((a, b) => b.matchScore - a.matchScore)
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
        if (r.source === 'vault') {
          selectedSessionId = r.id
          renderSessionList(allSessions)
          loadVaultContent(r)
        } else {
          selectedSessionId = r.id
          renderSessionList(allSessions)
          loadSessionContent(r)
        }
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

  // Context menu: Archive on Vault - copies session content into Brain Vault as a .md note
  ctxArchiveOnVault.addEventListener('click', async (e) => {
    e.stopPropagation()
    ctxMenu.style.display = 'none'
    if (!ctxTargetSessionId) return
    try {
      const session = await synAPI.readSession(ctxTargetSessionId)
      if (!session) {
        alert('Session not found: ' + ctxTargetSessionId)
        return
      }

      // Build markdown content from session
      const messages = session.messages || []
      const lines = [
        '# Session: ' + (session.title || ctxTargetSessionId),
        '',
        'Harness: ' + (session.harness || 'unknown'),
        'Session ID: ' + ctxTargetSessionId,
        'Created: ' + (session.created_at || ''),
        '',
        '## Messages',
        ''
      ]
      for (const m of messages) {
        const role = (m.role || 'unknown').toUpperCase()
        const ts = m.timestamp ? ' (' + m.timestamp + ')' : ''
        lines.push('### ' + role + ts)
        lines.push('')
        lines.push(m.content || '')
        lines.push('')
        lines.push('---')
        lines.push('')
      }
      // Add archive tag at the bottom, after the last interaction
      lines.push('', '---', '', 'Archived from Syn session.')

      // Generate a serial number tag (#000000-#999999) for this archived note
      const serialResult = await synAPI.brainNextSerial()
      const serialTag = serialResult.ok ? '#' + String(serialResult.serial).padStart(6, '0') : '#000000'
      lines.push('', 'Serial: ' + serialTag)

      const fileName = 'sessions/session-' + ctxTargetSessionId.replace(/[^a-z0-9]/gi, '-') + '.md'
      const result = await synAPI.brainWrite(fileName, lines.join('\n') + '\n')
      if (result.ok) {
        alert('Session archived to Brain Vault as "' + fileName + '" with serial ' + serialTag)
      } else {
        alert('Failed to archive session: ' + result.error)
      }
    } catch (err) {
      console.error('Archive on Vault failed:', err)
      alert('Failed to archive session: ' + err.message)
    }
    ctxTargetSessionId = null
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
        appendTerminalLine('  Syn â€” unified agent memory environment', 'normal')
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

  // Load a Brain Vault .md file into the session view with search highlighting.
  async function loadVaultContent (result) {
    emptyState.classList.add('hidden')
    emptyState.style.display = 'none'
    sessionView.classList.remove('hidden')
    sessionView.style.display = 'flex'

    metaHarness.textContent = 'vault'
    metaSessionId.textContent = result.path
    metaPath.textContent = result.path

    setStatusLoading()
    try {
      const data = await synAPI.brainRead(result.path)
      if (!data.ok) {
        sessionContent.innerHTML = `<div style="color:#ff6666;padding:12px">Error reading vault file: ${escapeHtml(data.error || 'unknown')}</div>`
        return
      }
      const content = data.content || ''
      const highlighted = searchQuery ? highlightText(escapeHtml(content), searchQuery) : escapeHtml(content)
      sessionContent.innerHTML = `
        <div style="padding:12px;color:#e0e0e0;line-height:1.6;white-space:pre-wrap;font-size:14px">${highlighted}</div>
      `
      // Auto-scroll to the first search match and keep the highlight while search state persists
      if (searchQuery) {
        const first = sessionContent.querySelector('.highlight')
        if (first) {
          first.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
    } catch (e) {
      sessionContent.innerHTML = `<div style="color:#ff6666;padding:12px">Error reading vault file: ${escapeHtml(e.message)}</div>`
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
    // Auto-scroll to the first search match and keep the highlight while search state persists
    if (searchQuery) {
      const first = sessionContent.querySelector('.highlight')
      if (first) {
        first.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
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

  // â”€â”€ Column resizing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

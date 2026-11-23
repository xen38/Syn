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
  const terminalInput = document.getElementById('terminalInput') as HTMLInputElement | null
  const terminalOutput = document.getElementById('terminalOutput') as HTMLElement | null
  const terminalColumn = document.querySelector('.terminal-column') as HTMLElement | null
  const btnCloseTerminal = document.getElementById('btnCloseTerminal') as HTMLButtonElement | null
  // Terminal starts open per spec: ◄ = open (arrow points left toward terminal, click to close)
  let terminalVisible = true
  if (btnCloseTerminal) {
    btnCloseTerminal.textContent = '◄'
    btnCloseTerminal.className = 'terminal-toggle open'
  }
  if (terminalColumn) terminalColumn.style.display = 'flex'
  updateTogglePosition()
  const searchInput = document.getElementById('searchInput') as HTMLInputElement | null
  const menuBtn = document.getElementById('menuBtn') as HTMLButtonElement | null
  const menuPanel = document.getElementById('menuPanel') as HTMLElement | null
  const btnBrainmaxxing = document.getElementById('btnBrainmaxxing') as HTMLButtonElement | null
  const brainmaxxingPanel = document.getElementById('brainmaxxingPanel') as HTMLElement | null
  const btnBrain = document.getElementById('btnBrain') as HTMLButtonElement | null
  const dbHealthBadge = document.getElementById('dbHealthBadge') as HTMLElement | null
  const btnRebuildIndex = document.getElementById('btnRebuildIndex') as HTMLButtonElement | null
  const sessionList = document.getElementById('sessionList') as HTMLElement | null
  const btnRefreshSessions = document.getElementById('btnRefreshSessions') as HTMLButtonElement | null
  const emptyState = document.getElementById('emptyState') as HTMLElement | null
  const sessionView = document.getElementById('sessionView') as HTMLElement | null
  const statusIndicatorImg = document.getElementById('statusIndicatorImg') as HTMLImageElement | null
  const sessionContent = document.getElementById('sessionContent') as HTMLElement | null
  const metaHarness = document.getElementById('metaHarness') as HTMLElement | null
  const metaSessionId = document.getElementById('metaSessionId') as HTMLElement | null
  const metaPath = document.getElementById('metaPath') as HTMLElement | null
  const harnessList = document.getElementById('harnessList') as HTMLElement | null
  const harnessSettingsEl = document.getElementById('harnessSettings') as HTMLElement | null
  const btnScanHarnesses = document.getElementById('btnScanHarnesses') as HTMLButtonElement | null
  const btnAddFolder = document.getElementById('btnAddFolder') as HTMLButtonElement | null
  const btnBrainReflect = document.getElementById('btnBrainReflect') as HTMLButtonElement | null
  const btnBrainMeditate = document.getElementById('btnBrainMeditate') as HTMLButtonElement | null
  const btnBrainRuminate = document.getElementById('btnBrainRuminate') as HTMLButtonElement | null
  const btnBrainPlan = document.getElementById('btnBrainPlan') as HTMLButtonElement | null
  const btnBrainReview = document.getElementById('btnBrainReview') as HTMLButtonElement | null
  const btnBrainIndex = document.getElementById('btnBrainIndex') as HTMLButtonElement | null
  const settingBatchSize = document.getElementById('settingBatchSize') as HTMLSelectElement | null
  const modeBtnBrain = document.getElementById('modeBtnBrain') as HTMLButtonElement | null
  const modeBtnCode = document.getElementById('modeBtnCode') as HTMLButtonElement | null
  const container = document.querySelector('.container') as HTMLElement | null
  const synCodePanel = document.getElementById('synCodePanel') as HTMLElement | null

  // Context menu elements
  const ctxMenu = document.getElementById('ctxMenu') as HTMLElement | null
  const ctxCopySessionId = document.getElementById('ctxCopySessionId') as HTMLElement | null
  const ctxArchiveOnVault = document.getElementById('ctxArchiveOnVault') as HTMLElement | null
  const ctxDeleteEntry = document.getElementById('ctxDeleteEntry') as HTMLElement | null
  const ctxConfirmOverlay = document.getElementById('ctxConfirmOverlay') as HTMLElement | null
  const ctxConfirmTitle = document.getElementById('ctxConfirmTitle') as HTMLElement | null
  const ctxConfirmMessage = document.getElementById('ctxConfirmMessage') as HTMLElement | null
  const ctxConfirmCancel = document.getElementById('ctxConfirmCancel') as HTMLButtonElement | null
  const ctxConfirmDelete = document.getElementById('ctxConfirmDelete') as HTMLButtonElement | null

  // Close session button
  const btnCloseSession = document.getElementById('btnCloseSession') as HTMLButtonElement | null

  // State
  let allSessions: unknown[] = []
  let selectedSessionId: string | null = null
  let menuOpen = false
  let brainmaxxingOpen = false
  let currentMode = 'code'
  let batchSize = 10
  let harnessSettings: Record<string, unknown> = {}
  let ctxTargetSessionId: string | null = null
  let pendingConfirm: (() => void) | null = null
  const terminalHistory: string[] = []
  let terminalHistoryIndex = -1
  let searchQuery = ''

  // Toggle Settings menu (Settings button ONLY opens Settings)
  function toggleMenu (e: MouseEvent | null) {
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }
    menuOpen = !menuOpen
    if (menuBtn) menuBtn.setAttribute('aria-expanded', String(menuOpen))
    if (menuOpen) {
      if (menuPanel) menuPanel.style.display = 'block'
      renderHarnesses()
      renderHarnessSettings()
      // If Brainmaxxing is also open, shift it to the left of Settings
      if (brainmaxxingOpen) {
        if (brainmaxxingPanel) brainmaxxingPanel.style.right = '342px'
      }
    } else {
      if (menuPanel) menuPanel.style.display = 'none'
      if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false')
      // If Brainmaxxing is still open, move it back to Settings position
      if (brainmaxxingOpen) {
        if (brainmaxxingPanel) brainmaxxingPanel.style.right = '16px'
      }
    }
  }

  // Menu button click - Settings only
  if (menuBtn) menuBtn.addEventListener('click', toggleMenu)

  // Brainmaxxing button click (independent from Settings menu)
  if (btnBrainmaxxing) {
    btnBrainmaxxing.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      brainmaxxingOpen = !brainmaxxingOpen
      btnBrainmaxxing.setAttribute('aria-expanded', String(brainmaxxingOpen))
      if (brainmaxxingOpen) {
        if (brainmaxxingPanel) brainmaxxingPanel.style.display = 'block'
        // Position: if Settings is open, shift left; otherwise at Settings position
        if (menuOpen) {
          if (brainmaxxingPanel) brainmaxxingPanel.style.right = '342px'
        } else {
          if (brainmaxxingPanel) brainmaxxingPanel.style.right = '16px'
        }
      } else {
        if (brainmaxxingPanel) brainmaxxingPanel.style.display = 'none'
        btnBrainmaxxing.setAttribute('aria-expanded', 'false')
      }
    })
  }

  // Brain button click - opens standalone Brain Vault window
  if (btnBrain) {
    btnBrain.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      synAPI.brainVaultOpen()
    })
  }

  // ═══ Mode Switcher: Syn Code / Syn Brain ══════════════════════════════════════════════════════════════════════════════════════════════════════════
  //
  // ARCHITECTURE NOTES (foundation for future Syn Code harness/agent-client):
  //
  // - Both modes run in the same renderer process, sharing synAPI, IPC handlers,
  //   search, terminal, and session state. Syn Code can call any Syn app feature
  //   through synAPI regardless of which mode is active.
  //
  // - Mode switching uses CSS visibility (display: none) only — DOM elements stay
  //   mounted, so state in each mode (scroll position, input text, open sessions)
  //   is preserved across switches. No work is lost when toggling modes.
  //
  // - Shared chrome (header, mode switcher, search bar, terminal toggle) is always
  //   visible in both modes. Only the main content area swaps between Syn Brain
  //   (container) and Syn Code (synCodePanel).
  //
  // - currentMode defaults to 'code'. Syn Brain is the legacy interface; Syn Code
  //   is the new default that will eventually host the full harness/agent-client.
  //
  function updateModeUI () {
    if (currentMode === 'brain') {
      if (modeBtnBrain) modeBtnBrain.classList.add('active')
      if (modeBtnCode) modeBtnCode.classList.remove('active')
      // Show Syn Brain interface (container), hide Syn Code panel
      if (container) container.classList.remove('hidden')
      if (synCodePanel) synCodePanel.classList.add('hidden')
    } else {
      if (modeBtnCode) modeBtnCode.classList.add('active')
      if (modeBtnBrain) modeBtnBrain.classList.remove('active')
      // Show Syn Code interface, hide Syn Brain container
      if (container) container.classList.add('hidden')
      if (synCodePanel) synCodePanel.classList.remove('hidden')
    }
  }

  function switchMode (newMode: string) {
    if (newMode === currentMode) return
    currentMode = newMode
    updateModeUI()
    console.log('Switched to mode:', currentMode)
  }

  if (modeBtnBrain) {
    modeBtnBrain.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      switchMode('brain')
    })
  }

  if (modeBtnCode) {
    modeBtnCode.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      switchMode('code')
    })
  }

  // Initialize mode UI
  updateModeUI()

  // ═══ Database health (Gate G7) ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
  const DB_HEALTH_COLORS: Record<string, string> = {
    healthy: '#53C68B',
    corrupt: '#ff4444',
    rebuilding: '#f5a623',
    unknown: '#aaa'
  }

  async function checkDbHealth () {
    if (!dbHealthBadge || !btnRebuildIndex) return
    try {
      const health = await synAPI.dbHealth()
      const status = (health as { health?: string; dbPath?: string }).health || 'unknown'
      const color = DB_HEALTH_COLORS[status] || DB_HEALTH_COLORS.unknown
      dbHealthBadge.style.color = color
      dbHealthBadge.title = `Index database: ${status} (${(health as { dbPath?: string }).dbPath})`

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
      if (dbHealthBadge) dbHealthBadge.style.color = DB_HEALTH_COLORS.unknown
      if (dbHealthBadge) dbHealthBadge.title = 'Index database: unknown'
      if (btnRebuildIndex) btnRebuildIndex.style.display = 'inline-block'
      if (btnRebuildIndex) btnRebuildIndex.textContent = 'Rebuild index'
    }
  }

  if (btnRebuildIndex) {
    btnRebuildIndex.addEventListener('click', async (e) => {
      e.preventDefault()
      e.stopPropagation()
      try {
        btnRebuildIndex.disabled = true
        btnRebuildIndex.textContent = 'Rebuilding…'
        if (dbHealthBadge) dbHealthBadge.style.color = DB_HEALTH_COLORS.rebuilding
        const result = await synAPI.dbRebuild()
        if ((result as { status?: string }).status === 'rebuilt') {
          btnRebuildIndex.style.display = 'none'
          if (dbHealthBadge) dbHealthBadge.style.color = DB_HEALTH_COLORS.healthy
          if (dbHealthBadge) dbHealthBadge.title = 'Index database: healthy (rebuilt)'
        } else {
          btnRebuildIndex.disabled = false
          btnRebuildIndex.textContent = 'Rebuild index'
        }
      } catch (err) {
        console.error('Rebuild failed:', err)
        btnRebuildIndex.disabled = false
        btnRebuildIndex.textContent = 'Rebuild index'
        alert('Rebuild failed: ' + (err as Error).message)
      }
    })
  }

  // Close panels when clicking outside
  document.addEventListener('click', (e) => {
    if (menuOpen && menuPanel && !menuPanel.contains(e.target as HTMLElement) && e.target !== menuBtn) {
      menuOpen = false
      if (menuPanel) menuPanel.style.display = 'none'
      // Don't close Brainmaxxing when clicking outside Settings
    }
    // Close Brainmaxxing panel when clicking outside
    if (brainmaxxingOpen && brainmaxxingPanel && !brainmaxxingPanel.contains(e.target as HTMLElement) && e.target !== btnBrainmaxxing) {
      brainmaxxingOpen = false
      if (brainmaxxingPanel) brainmaxxingPanel.style.display = 'none'
    }
    // Close context menu when clicking outside
    if (ctxMenu && ctxMenu.style.display === 'block' && !ctxMenu.contains(e.target as HTMLElement)) {
      ctxMenu.style.display = 'none'
    }
    // Close confirm overlay when clicking outside
    if (ctxConfirmOverlay && ctxConfirmOverlay.style.display === 'block' && !ctxConfirmOverlay.contains(e.target as HTMLElement)) {
      hideConfirm()
    }
  })

  // Escape key to close open menus / overlays
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (menuOpen) {
        menuOpen = false
        if (menuPanel) menuPanel.style.display = 'none'
        if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false')
      }
      if (brainmaxxingOpen) {
        brainmaxxingOpen = false
        if (brainmaxxingPanel) brainmaxxingPanel.style.display = 'none'
        if (btnBrainmaxxing) btnBrainmaxxing.setAttribute('aria-expanded', 'false')
      }
      if (ctxMenu) ctxMenu.style.display = 'none'
      if (ctxConfirmOverlay) hideConfirm()
    }

    // Arrow key navigation within session list
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      if (!sessionList) return
      const sessionItems = sessionList.querySelectorAll('.session-item')
      if (sessionItems.length === 0) return
      if (e.target === terminalInput || e.target === searchInput) return

      const currentIndex = Array.from(sessionItems).indexOf(document.activeElement as Element)
      let newIndex = currentIndex

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        newIndex = Math.min(currentIndex + 1, sessionItems.length - 1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        newIndex = Math.max(currentIndex - 1, 0)
      } else if ((e.key === 'Enter' || e.key === ' ') && currentIndex >= 0) {
        e.preventDefault()
        ;(sessionItems[currentIndex] as HTMLElement).click()
        return
      }

      if (newIndex !== currentIndex && newIndex >= 0) {
        ;(sessionItems[newIndex] as HTMLElement).focus()
      }
    }
  })

  // Refresh sessions
  if (btnRefreshSessions) {
    btnRefreshSessions.addEventListener('click', async () => {
      setStatusLoading()
      try {
        await loadSessions()
      } finally {
        setStatusIdle()
      }
    })
  }

  // Add folder
  if (btnAddFolder) {
    btnAddFolder.addEventListener('click', async () => {
      const dir = await synAPI.openFolderDialog()
      if (dir) {
        await synAPI.addHarness(dir as string)
        renderHarnesses()
        try {
          await synAPI.indexAllSources()
        } catch (e) {
          console.error('Indexing failed:', e)
        }
        await loadSessions()
      }
    })
  }

  // ═══ Brainmaxxing commands ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
  async function showBrainResult (title: string, result: unknown) {
    const lines = [
      '<div style="padding:12px;background:#1a1a1a;border:1px solid #333;border-radius:8px;margin-top:12px;">',
      `<div style="font-weight:600;color:#00ccff;margin-bottom:8px">${escapeHtml(title)}</div>`,
      `<div style="color:#e0e0e0;font-size:13px;white-space:pre-wrap">${escapeHtml(JSON.stringify(result, null, 2))}</div>`,
      '</div>'
    ]
    if (sessionContent) sessionContent.insertAdjacentHTML('beforeend', lines.join(''))
    if (sessionView) {
      sessionView.classList.remove('hidden')
      sessionView.style.display = 'flex'
    }
    if (emptyState) {
      emptyState.classList.add('hidden')
      emptyState.style.display = 'none'
    }
  }

  if (btnBrainReflect) {
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
        alert('Reflect failed: ' + (err as Error).message)
      }
      menuOpen = false
      if (menuPanel) menuPanel.style.display = 'none'
    })
  }

  if (btnBrainMeditate) {
    btnBrainMeditate.addEventListener('click', async (e) => {
      e.stopPropagation()
      try {
        const result = await synAPI.brainMeditate()
        showBrainResult('/meditate', result)
      } catch (err) {
        alert('Meditate failed: ' + (err as Error).message)
      }
      menuOpen = false
      if (menuPanel) menuPanel.style.display = 'none'
    })
  }

  if (btnBrainRuminate) {
    btnBrainRuminate.addEventListener('click', async (e) => {
      e.stopPropagation()
      try {
        const result = await synAPI.brainRuminate()
        showBrainResult('/ruminate', result)
      } catch (err) {
        alert('Ruminate failed: ' + (err as Error).message)
      }
      menuOpen = false
      if (menuPanel) menuPanel.style.display = 'none'
    })
  }

  if (btnBrainPlan) {
    btnBrainPlan.addEventListener('click', async (e) => {
      e.stopPropagation()
      const task = prompt('Enter plan task:')
      if (!task) return
      try {
        const result = await synAPI.brainPlan(task)
        showBrainResult('/plan', result)
      } catch (err) {
        alert('Plan failed: ' + (err as Error).message)
      }
      menuOpen = false
      if (menuPanel) menuPanel.style.display = 'none'
    })
  }

  if (btnBrainReview) {
    btnBrainReview.addEventListener('click', async (e) => {
      e.stopPropagation()
      const content = prompt('Enter content to review:')
      if (content === null) return
      try {
        const result = await synAPI.brainReview(content)
        showBrainResult('/review', result)
      } catch (err) {
        alert('Review failed: ' + (err as Error).message)
      }
      menuOpen = false
      if (menuPanel) menuPanel.style.display = 'none'
    })
  }

  if (btnBrainIndex) {
    btnBrainIndex.addEventListener('click', async (e) => {
      e.stopPropagation()
      try {
        const result = await synAPI.brainIndex()
        showBrainResult('/index', result)
      } catch (err) {
        alert('Index failed: ' + (err as Error).message)
      }
      menuOpen = false
      if (menuPanel) menuPanel.style.display = 'none'
    })
  }

  // Scan & autodetect harnesses
  if (btnScanHarnesses) {
    btnScanHarnesses.addEventListener('click', async () => {
      setStatusLoading()
      try {
        await scanAndAutodetectHarnesses()
      } catch (e) {
        console.error('Scan failed:', e)
        alert('Scan failed: ' + (e as Error).message)
      } finally {
        setStatusIdle()
      }
      menuOpen = false
      if (menuPanel) menuPanel.style.display = 'none'
    })
  }

  // Batch size setting
  if (settingBatchSize) {
    settingBatchSize.addEventListener('change', async (e) => {
      batchSize = parseInt((e.target as HTMLInputElement).value, 10)
      await synAPI.setConfig({ batchSize })
    })
  }

  // ═══ Terminal command input ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
  if (terminalInput) {
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
          appendTerminalLine(`Error: ${(err as Error).message}`, 'error')
        }
        if (terminalOutput) terminalOutput.scrollTop = terminalOutput.scrollHeight
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
  }

  // Terminal column toggle (Kindle-style triangle button)
  if (btnCloseTerminal) {
    btnCloseTerminal.addEventListener('click', (e) => {
      e.stopPropagation()
      terminalVisible = !terminalVisible
      if (terminalVisible) {
        if (terminalColumn) terminalColumn.style.display = 'flex'
        const resizerTerminal = document.getElementById('resizerTerminal') as HTMLElement | null
        if (resizerTerminal) resizerTerminal.style.display = 'block'
        btnCloseTerminal.textContent = '◄'
        btnCloseTerminal.className = 'terminal-toggle open'
        updateTogglePosition()
      } else {
        if (terminalColumn) terminalColumn.style.display = 'none'
        const resizerTerminal = document.getElementById('resizerTerminal') as HTMLElement | null
        if (resizerTerminal) resizerTerminal.style.display = 'none'
        btnCloseTerminal.textContent = '►'
        btnCloseTerminal.className = 'terminal-toggle closed'
        updateTogglePosition()
      }
    })
  }

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

  // Custom title bar window controls
  const synBtnMinimize = document.getElementById('synBtnMinimize') as HTMLButtonElement | null
  const synBtnMaximize = document.getElementById('synBtnMaximize') as HTMLButtonElement | null
  const synBtnClose = document.getElementById('synBtnClose') as HTMLButtonElement | null
  if (synBtnMinimize && synBtnMaximize && synBtnClose && window.synAPI) {
    synBtnMinimize.addEventListener('click', (e) => {
      e.stopPropagation()
      window.synAPI.synWindow.minimize()
    })
    synBtnMaximize.addEventListener('click', (e) => {
      e.stopPropagation()
      window.synAPI.synWindow.maximize()
    })
    synBtnClose.addEventListener('click', (e) => {
      e.stopPropagation()
      window.synAPI.synWindow.close()
    })
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

  async function executeTerminalCommand (raw: string) {
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
        const results = await synAPI.searchSessions(query, { batchSize, ...options } as Record<string, unknown>)
        renderSearchResults(results as unknown[])
        break
      }

      case '/reflect': {
        const sessionId = args[0] || selectedSessionId
        if (!sessionId) {
          appendTerminalLine('Usage: /reflect <sessionId> (or select a session first)', 'warn')
          return
        }
        const result = await synAPI.brainReflect(sessionId)
        appendTerminalLine(`/reflect → ${(result as { path?: string }).path || 'done'}`, 'ok')
        appendTerminalLine(`Learnings: ${(result as { learningsCount?: number }).learningsCount || 0}`, 'ok')
        break
      }

      case '/meditate': {
        const result = await synAPI.brainMeditate()
        appendTerminalLine(`/meditate → ${(result as { path?: string }).path || 'done'}`, 'ok')
        appendTerminalLine(`Files audited: ${(result as { filesAudited?: number }).filesAudited || 0}, principles: ${(result as { principlesExtracted?: number }).principlesExtracted || 0}, stale: ${(result as { staleNotes?: unknown[] }).staleNotes?.length || 0}`, 'ok')
        break
      }

      case '/ruminate': {
        const result = await synAPI.brainRuminate()
        appendTerminalLine(`/ruminate → ${(result as { path?: string }).path || 'done'}`, 'ok')
        appendTerminalLine(`Sessions scanned: ${(result as { sessionsScanned?: number }).sessionsScanned || 0}, patterns: ${(result as { patternsFound?: number }).patternsFound || 0}`, 'ok')
        break
      }

      case '/plan': {
        const task = args.join(' ')
        if (!task) {
          appendTerminalLine('Usage: /plan <task description>', 'warn')
          return
        }
        const result = await synAPI.brainPlan(task)
        appendTerminalLine(`/plan → ${(result as { path?: string }).path || 'done'}`, 'ok')
        appendTerminalLine(`Task: ${(result as { task?: string }).task || task}`, 'ok')
        break
      }

      case '/review': {
        const content = args.join(' ')
        if (!content) {
          appendTerminalLine('Usage: /review <content to review>', 'warn')
          return
        }
        const result = await synAPI.brainReview(content)
        appendTerminalLine(`/review → ${(result as { path?: string }).path || 'done'}`, 'ok')
        const issues = (result as { issues?: unknown[] }).issues
        if (issues && issues.length) {
          ;(result as { issues: unknown[] }).issues.forEach((issue, i) => {
            appendTerminalLine(`  ${i + 1}. [${(issue as { severity?: string }).severity}] ${(issue as { message?: string }).message}`, 'warn')
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
          ;(files as unknown[]).forEach(f => appendTerminalLine(`  [[${f}]]`, 'ok'))
        } else if (sub === 'index') {
          const result = await synAPI.brainIndex()
          appendTerminalLine(`/brain index → ${(result as { files?: string }).files || '0'} files indexed`, 'ok')
        } else if (sub === 'read') {
          const path = args[1]
          if (!path) {
            appendTerminalLine('Usage: /brain read <path>', 'warn')
            return
          }
          const result = await synAPI.brainRead(path)
          if ((result as { ok?: boolean }).ok) {
            appendTerminalLine(`--- ${path} ---`, 'ok')
            appendTerminalLine((result as { content?: string }).content || '', 'ok')
          } else {
            appendTerminalLine(`Read failed: ${(result as { error?: string }).error}`, 'error')
          }
        } else if (sub === 'write') {
          const path = args[1]
          const content = args.slice(2).join(' ')
          if (!path || !content) {
            appendTerminalLine('Usage: /brain write <path> <content>', 'warn')
            return
          }
          const result = await synAPI.brainWrite(path, content)
          appendTerminalLine(`/brain write → ${(result as { path?: string }).path}`, 'ok')
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

  function appendTerminalLine (text: string, type = 'normal') {
    const div = document.createElement('div')
    div.className = `terminal-line terminal-${type}`
    div.textContent = text
    if (terminalOutput) {
      terminalOutput.appendChild(div)
      terminalOutput.scrollTop = terminalOutput.scrollHeight
    }
  }

  function renderSearchResults (results: unknown[]) {
    if (!results || results.length === 0) {
      appendTerminalLine('No results found.', 'warn')
      return
    }
    appendTerminalLine(`Found ${results.length} result${results.length !== 1 ? 's' : ''}:`, 'ok')
    results.forEach((r) => {
      const div = document.createElement('div')
      div.className = 'terminal-result'
      const resultObj = r as { title?: string; harness?: string; snippet?: string }
      div.innerHTML = `
        <div class="title"><span style="color:#ff69b4">●</span> ${escapeHtml(resultObj.title || '')} <span class="meta">[${escapeHtml(resultObj.harness || '')}]</span></div>
        ${resultObj.snippet ? `<div class="meta" style="font-size:11px;color:#53C68B;margin-top:2px">${escapeHtml(resultObj.snippet)}</div>` : ''}
      `
      div.style.cursor = 'pointer'
      div.addEventListener('click', () => {
        selectedSessionId = (resultObj as { id?: string }).id || null
        renderSessionList(allSessions)
        loadSessionContent(r as { id: string; harness: string })
      })
      if (terminalOutput) terminalOutput.appendChild(div)
    })
  }

  // ═══ Search bar (top, search-only, no terminal features) ═════════════════════════════════════════════════════════════════════════════════════════════
  if (searchInput) {
    searchInput.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        await performSearch()
      }
    })
  }

  // Parse filter tokens (harness:, project:, date:, role:, brain:) out of the
  // free-text query. Returns { query, options } where query is the remaining
  // free-text and options holds the parsed filters for the search engine.
  function parseSearchFilters (raw: string) {
    const options: Record<string, unknown> = {}
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
    const raw = searchInput ? searchInput.value.trim() : ''
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
        synAPI.searchSessions(query, { batchSize, ...options } as Record<string, unknown>),
        searchBrainVault(raw)
      ])
      const allResults = [
        ...(sessionResults as unknown[]).map(r => ({ ...(r as object), source: 'session' })),
        ...(vaultResults as unknown[]).map(r => ({ ...(r as object), source: 'vault' }))
      ]
      renderSearchResultsList(allResults, raw)
    } catch (err) {
      console.error('Search failed:', err)
      if (sessionList) sessionList.innerHTML = `<div style="padding:12px;color:#ff6666;font-size:13px">Search failed: ${escapeHtml((err as Error).message)}</div>`
    } finally {
      setStatusIdle()
    }
  }

  // Search across all .md files in the Brain Vault (names + content).
  // Returns results shaped like session results but with source:'vault' and a path field.
  async function searchBrainVault (query: string) {
    const files = await synAPI.brainList()
    const results: unknown[] = []
    const terms = query.toLowerCase().split(/\s+/).filter((t: string) => t.length > 0)

    for (const file of (files as unknown[])) {
      try {
        const result = await synAPI.brainRead(file as string)
        if (!(result as { ok?: boolean }).ok) continue
        const content = ((result as { content?: string }).content || '') as string
        const lowerContent = content.toLowerCase()
        const lowerName = (file as string).toLowerCase()

        let matchScore = 0
        let snippet = ''

        // Filename match
        const nameMatch = terms.some((t: string) => lowerName.includes(t))
        if (nameMatch) matchScore += 10

        // Content match
        const contentMatch = terms.some((t: string) => lowerContent.includes(t))
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
            snippet,
            source: 'vault',
            path: file,
            matchScore
          })
        }
      } catch (e) {
        console.error('Failed to read vault file ' + file + ':', e)
      }
    }

    return results.sort((a, b) => (b as { matchScore: number }).matchScore - (a as { matchScore: number }).matchScore)
  }

  function renderSearchResultsList (results: unknown[], query: string) {
    if (emptyState) {
      emptyState.classList.add('hidden')
      emptyState.style.display = 'none'
    }
    if (sessionView) {
      sessionView.classList.add('hidden')
      sessionView.style.display = 'none'
    }
    if (sessionList) sessionList.innerHTML = ''

    const title = document.createElement('div')
    title.style.padding = '8px 12px'
    title.style.fontSize = '12px'
    title.style.color = '#888888'
    title.style.borderBottom = '1px solid #333333'
    title.textContent = `Search results for "${escapeHtml(query)}" (${results.length})`
    if (sessionList) sessionList.appendChild(title)

    if (!results || results.length === 0) {
      const empty = document.createElement('div')
      empty.style.padding = '12px'
      empty.style.color = '#666666'
      empty.style.fontSize = '13px'
      empty.style.fontStyle = 'italic'
      empty.textContent = 'No results found.'
      if (sessionList) sessionList.appendChild(empty)
      return
    }

    const fragment = document.createDocumentFragment()
    results.forEach((r) => {
      const resultObj = r as { title?: string; harness?: string; snippet?: string; source?: string; id?: string }
      const item = document.createElement('div')
      const label = highlightText(escapeHtml(resultObj.title || ''), searchQuery)
      const snippet = resultObj.snippet ? highlightText(escapeHtml(resultObj.snippet), searchQuery) : ''
      const snippetHtml = snippet
        ? `<div class="snippet">${snippet}</div>`
        : ''
      item.className = 'session-item'
      item.setAttribute('tabindex', '0')
      item.setAttribute('role', 'option')
      item.setAttribute('aria-label', `${escapeHtml(resultObj.title || '')} - ${escapeHtml(resultObj.harness || '')}`)
      item.innerHTML = `
        <div class="label">${label}</div>
        <div class="harness">${escapeHtml(resultObj.harness || '')}</div>
        ${snippetHtml}
      `
      item.addEventListener('click', () => {
        if (resultObj.source === 'vault') {
          selectedSessionId = resultObj.id || null
          renderSessionList(allSessions)
          loadVaultContent(resultObj as { path: string })
        } else {
          selectedSessionId = resultObj.id || null
          renderSessionList(allSessions)
          loadSessionContent(resultObj as { id: string; harness: string })
        }
      })
      // Right-click context menu on search results
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (ctxMenu) ctxMenu.style.display = 'none'
        ctxTargetSessionId = resultObj.id || null
        // Position menu near cursor, clamped to viewport
        let left = e.clientX
        let top = e.clientY
        const menuWidth = ctxMenu ? ctxMenu.offsetWidth : 200
        const menuHeight = ctxMenu ? ctxMenu.offsetHeight : 120
        if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 8
        if (top + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight - 8
        if (left < 8) left = 8
        if (top < 8) top = 8
        if (ctxMenu) {
          ctxMenu.style.left = left + 'px'
          ctxMenu.style.top = top + 'px'
          ctxMenu.style.display = 'block'
        }
      })
      fragment.appendChild(item)
    })
    if (sessionList) sessionList.appendChild(fragment)
  }

  function highlightText (html: string, query: string) {
    if (!query) return html
    // Highlight each query term individually (multi-term queries).
    const terms = query.trim().split(/\s+/).filter((t: string) => t.length > 0)
    let out = html
    for (const term of terms) {
      const escaped = escapeHtml(term)
      const re = new RegExp(`(${escaped.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
      out = out.replace(re, '<span class="highlight">$1</span>')
    }
    return out
  }

  // Close session
  if (btnCloseSession) {
    btnCloseSession.addEventListener('click', (e) => {
      e.stopPropagation()
      closeSession()
    })
  }

  // Context menu: Copy Session ID
  if (ctxCopySessionId) {
    ctxCopySessionId.addEventListener('click', async (e) => {
      e.stopPropagation()
      if (ctxMenu) ctxMenu.style.display = 'none'
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
        alert('Failed to copy session ID: ' + (err as Error).message)
      }
      ctxTargetSessionId = null
    })
  }

  // Context menu: Delete Entry (white text) - removes from index only, confirmation required
  if (ctxDeleteEntry) {
    ctxDeleteEntry.addEventListener('click', async (e) => {
      e.stopPropagation()
      if (ctxMenu) ctxMenu.style.display = 'none'
      if (!ctxTargetSessionId) return
      showConfirm(
        'Delete Entry from Index?',
        `This will remove the session from the search index:\n${ctxTargetSessionId}\n\nThe original archive file is NOT deleted. This can be undone by re-indexing.`,
        async () => {
          hideConfirm()
          try {
            await synAPI.deleteSession(ctxTargetSessionId)
            allSessions = allSessions.filter(s => (s as { id: string }).id !== ctxTargetSessionId)
            if (selectedSessionId === ctxTargetSessionId) {
              closeSession()
            }
            renderSessionList(allSessions)
          } catch (err) {
            console.error('Delete entry failed:', err)
            alert('Failed to delete entry: ' + (err as Error).message)
          }
          ctxTargetSessionId = null
        }
      )
    })
  }

  // Context menu: Archive on Vault - copies session content into Brain Vault as a .md note
  if (ctxArchiveOnVault) {
    ctxArchiveOnVault.addEventListener('click', async (e) => {
      e.stopPropagation()
      if (ctxMenu) ctxMenu.style.display = 'none'
      if (!ctxTargetSessionId) return
      try {
        const session = await synAPI.readSession(ctxTargetSessionId)
        if (!(session as { messages?: unknown[] })) {
          alert('Session not found: ' + ctxTargetSessionId)
          return
        }

        // Build markdown content from session
        const messages = (session as { messages?: unknown[] }).messages || []
        const lines = [
          '# Session: ' + ((session as { title?: string }).title || ctxTargetSessionId),
          '',
          'Harness: ' + ((session as { harness?: string }).harness || 'unknown'),
          'Session ID: ' + ctxTargetSessionId,
          'Created: ' + ((session as { created_at?: string }).created_at || ''),
          '',
          '## Messages',
          ''
        ]
        for (const m of messages as unknown[]) {
          const role = ((m as { role?: string }).role || 'unknown').toUpperCase()
          const ts = ((m as { timestamp?: string }).timestamp ? ' (' + (m as { timestamp?: string }).timestamp + ')' : '')
          lines.push('### ' + role + ts)
          lines.push('')
          lines.push(((m as { content?: string }).content || ''))
          lines.push('')
          lines.push('---')
          lines.push('')
        }
        // Add archive tag at the bottom, after the last interaction
        lines.push('', '---', '', 'Archived from Syn session.')

        // Generate a serial number tag (#000000-#999999) for this archived note
        const serialResult = await synAPI.brainNextSerial()
        const serialTag = (serialResult as { ok?: boolean; serial?: number }).ok ? '#' + String((serialResult as { serial?: number }).serial).padStart(6, '0') : '#000000'
        lines.push('', 'Serial: [[Serial: ' + serialTag + ']]')

        const fileName = 'sessions/session-' + ctxTargetSessionId.replace(/[^a-z0-9]/gi, '-') + '.md'
        const result = await synAPI.brainWrite(fileName, lines.join('\n') + '\n')
        if ((result as { ok?: boolean }).ok) {
          alert('Session archived to Brain Vault as "' + fileName + '" with serial ' + serialTag)
        } else {
          alert('Failed to archive session: ' + (result as { error?: string }).error)
        }
      } catch (err) {
        console.error('Archive on Vault failed:', err)
        alert('Failed to archive session: ' + (err as Error).message)
      }
      ctxTargetSessionId = null
    })
  }

  if (ctxConfirmCancel) {
    ctxConfirmCancel.addEventListener('click', () => {
      hideConfirm()
      ctxTargetSessionId = null
    })
  }

  if (ctxConfirmDelete) {
    ctxConfirmDelete.addEventListener('click', async () => {
      hideConfirm()
      if (pendingConfirm) {
        await pendingConfirm()
        pendingConfirm = null
      }
      ctxTargetSessionId = null
    })
  }

  function showConfirm (title: string, message: string, onConfirm: () => void) {
    if (ctxConfirmTitle) ctxConfirmTitle.textContent = title
    if (ctxConfirmMessage) ctxConfirmMessage.textContent = message
    pendingConfirm = onConfirm
    if (ctxConfirmOverlay) ctxConfirmOverlay.style.display = 'flex'
  }

  function hideConfirm () {
    if (ctxConfirmOverlay) ctxConfirmOverlay.style.display = 'none'
    pendingConfirm = null
  }

  function closeSession () {
    selectedSessionId = null
    if (sessionView) {
      sessionView.classList.add('hidden')
      sessionView.style.display = 'none'
    }
    if (emptyState) {
      emptyState.classList.remove('hidden')
      emptyState.style.display = 'flex'
    }
    renderSessionList(allSessions)
  }

  async function init () {
    setStatusLoading()
    try {
      const config = await synAPI.getConfig()
      batchSize = (config as { batchSize?: number }).batchSize || 10
      if (settingBatchSize) settingBatchSize.value = String(batchSize)

      // Load harness enable/disable settings
      try {
        const settings = await synAPI.getHarnessSettings()
        harnessSettings = Object.fromEntries(((settings as unknown[]).map((s: unknown) => { const obj = s as { name: string; enabled: boolean }; return [obj.name, obj.enabled] })))
        renderHarnessSettings()
      } catch (e) {
        console.error('Failed to load harness settings:', e)
      }

      // Auto-detect harnesses on first run if none configured
      const configObj = config as { harnessDirectories?: string[] }
      if (!configObj.harnessDirectories || configObj.harnessDirectories.length === 0) {
        await scanAndAutodetectHarnesses()
      } else {
        // Ensure all configured sources are registered in the engine (idempotent)
        for (const dir of configObj.harnessDirectories) {
          try {
            await synAPI.addHarness(dir)
          } catch (e) {
            console.error('Failed to add harness:', dir, (e as Error).message)
          }
        }

        // Index all sources so sessions appear in the list
        try {
          await synAPI.indexAllSources()
        } catch (e) {
          console.error('Indexing failed:', (e as Error).message)
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
      alert('Init failed: ' + (e as Error).message)
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

  function renderSessionList (sessions: unknown[]) {
    if (!sessionList) return
    sessionList.innerHTML = ''

    // If no session is selected, show empty state
    if (!selectedSessionId) {
      if (emptyState) {
        emptyState.classList.remove('hidden')
        emptyState.style.display = 'flex'
      }
      if (sessionView) {
        sessionView.classList.add('hidden')
        sessionView.style.display = 'none'
      }
    } else {
      if (emptyState) {
        emptyState.classList.add('hidden')
        emptyState.style.display = 'none'
      }
      if (sessionView) {
        sessionView.classList.remove('hidden')
        sessionView.style.display = 'flex'
      }
    }

    if (sessions.length === 0) {
      sessionList.innerHTML = '<div style="padding:12px;color:#666;font-size:12px">No sessions found. Add a harness directory from the menu.</div>'
      return
    }

    const fragment = document.createDocumentFragment()
    sessions.forEach((s) => {
      const sessionObj = s as { id: string; title: string; harness: string }
      const item = document.createElement('div')
      item.className = `session-item${selectedSessionId === sessionObj.id ? ' selected' : ''}`
      item.setAttribute('tabindex', '0')
      item.setAttribute('role', 'option')
      item.setAttribute('aria-label', `${escapeHtml(sessionObj.title)} - ${escapeHtml(sessionObj.harness)}`)
      item.setAttribute('aria-selected', String(selectedSessionId === sessionObj.id))
      item.innerHTML = `
        <div class="label">${escapeHtml(sessionObj.title)}</div>
        <div class="harness">${escapeHtml(sessionObj.harness)}</div>
      `
      item.addEventListener('click', () => {
        selectedSessionId = sessionObj.id
        renderSessionList(allSessions)
        loadSessionContent(sessionObj)
      })

      // Right-click context menu
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (ctxMenu) ctxMenu.style.display = 'none'
        ctxTargetSessionId = sessionObj.id
        // Position menu near cursor, clamped to viewport
        let left = e.clientX
        let top = e.clientY
        const menuWidth = ctxMenu ? ctxMenu.offsetWidth : 200
        const menuHeight = ctxMenu ? ctxMenu.offsetHeight : 120
        if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth - 8
        if (top + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight - 8
        if (left < 8) left = 8
        if (top < 8) top = 8
        if (ctxMenu) {
          ctxMenu.style.left = left + 'px'
          ctxMenu.style.top = top + 'px'
          ctxMenu.style.display = 'block'
        }
      })

      fragment.appendChild(item)
    })
    sessionList.appendChild(fragment)
  }

  async function loadSessionContent (session: { id: string; harness: string; file_path?: string; source_path?: string }) {
    if (emptyState) {
      emptyState.classList.add('hidden')
      emptyState.style.display = 'none'
    }
    if (sessionView) {
      sessionView.classList.remove('hidden')
      sessionView.style.display = 'flex'
    }

    if (metaHarness) metaHarness.textContent = session.harness
    if (metaSessionId) metaSessionId.textContent = session.id
    if (metaPath) metaPath.textContent = session.file_path || session.source_path || ''

    setStatusLoading()
    try {
      const data = await synAPI.readSession(session.id)
      const messages = (data as { messages?: unknown[] }).messages || []
      renderMessages(messages as unknown[])
    } catch (e) {
      if (sessionContent) sessionContent.innerHTML = `<div style="color:#ff6666;padding:12px">Error loading session: ${escapeHtml((e as Error).message)}</div>`
    } finally {
      setStatusIdle()
    }
  }

  // Load a Brain Vault .md file into the session view with search highlighting.
  async function loadVaultContent (result: { path: string }) {
    if (emptyState) {
      emptyState.classList.add('hidden')
      emptyState.style.display = 'none'
    }
    if (sessionView) {
      sessionView.classList.remove('hidden')
      sessionView.style.display = 'flex'
    }

    if (metaHarness) metaHarness.textContent = 'vault'
    if (metaSessionId) metaSessionId.textContent = result.path
    if (metaPath) metaPath.textContent = result.path

    setStatusLoading()
    try {
      const data = await synAPI.brainRead(result.path)
      if (!(data as { ok?: boolean }).ok) {
        if (sessionContent) sessionContent.innerHTML = `<div style="color:#ff6666;padding:12px">Error reading vault file: ${escapeHtml((data as { error?: string }).error || 'unknown')}</div>`
        return
      }
      const content = (data as { content?: string }).content || ''
      const highlighted = searchQuery ? highlightText(escapeHtml(content), searchQuery) : escapeHtml(content)
      if (sessionContent) {
        sessionContent.innerHTML = `
          <div style="padding:12px;color:#e0e0e0;line-height:1.6;white-space:pre-wrap;font-size:14px">${highlighted}</div>
        `
      }
      // Auto-scroll to the first search match and keep the highlight while search state persists
      if (searchQuery && sessionContent) {
        const first = sessionContent.querySelector('.highlight')
        if (first) {
          first.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
    } catch (e) {
      if (sessionContent) sessionContent.innerHTML = `<div style="color:#ff6666;padding:12px">Error reading vault file: ${escapeHtml((e as Error).message)}</div>`
    } finally {
      setStatusIdle()
    }
  }

  function renderMessages (messages: unknown[]) {
    if (!sessionContent) return
    if (!messages || messages.length === 0) {
      sessionContent.innerHTML = '<div style="color:#666;font-style:italic;padding:12px">No messages found.</div>'
      return
    }

    const parts: string[] = []
    messages.forEach((m, _i) => {
      const msg = m as { role?: string; timestamp?: string; content?: string }
      const role = (msg.role || 'unknown').toLowerCase()
      const roleColor = role === 'user' ? '#53C68B' : role === 'assistant' ? '#00ccff' : '#888888'
      const roleLabel = role.charAt(0).toUpperCase() + role.slice(1)
      const ts = msg.timestamp ? ` <span style="color:#666;font-size:11px;margin-left:8px">${escapeHtml(msg.timestamp)}</span>` : ''
      const content = escapeHtml(msg.content || '')
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
      const currentPaths = new Set(((current as unknown[]).map((h: unknown) => (h as { path?: string }).path).filter(Boolean) as string[]))
      let added = 0
      for (const d of (detected as string[])) {
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
      if (btn) {
        const orig = btn.textContent
        btn.textContent = `Found ${added} new harness${added !== 1 ? 'es' : ''}`
        setTimeout(() => { btn.textContent = orig }, 2000)
      }
    } catch (e) {
      console.error('Scan failed:', e)
      alert('Scan failed: ' + (e as Error).message)
    } finally {
      setStatusIdle()
    }
    menuOpen = false
    if (menuPanel) menuPanel.style.display = 'none'
  }

  function renderHarnesses () {
    loadHarnesses()
  }

  async function loadHarnesses () {
    if (!harnessList) return
    const harnesses = await synAPI.listHarnesses()
    harnessList.innerHTML = ''

    if (harnesses.length === 0) {
      harnessList.innerHTML = '<div style="padding:8px;color:#666;font-size:12px">No harnesses configured</div>'
      return
    }

    // Group by harness name to compact duplicates
    const grouped = new Map<string, unknown[]>()
    ;(harnesses as unknown[]).forEach((h) => {
      const harnessObj = h as { harness?: string; name?: string; path?: string }
      const key = (harnessObj.harness || harnessObj.name || harnessObj.path) as string
      if (!grouped.has(key)) {
        grouped.set(key, [])
      }
      grouped.get(key)!.push(h)
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
      if (removeBtn) {
        removeBtn.addEventListener('click', async (e) => {
          e.stopPropagation()
          try {
            // Remove all directories for this harness
            for (const h of items) {
              const harnessObj = h as { path?: string }
              await synAPI.removeHarness(harnessObj.path || h)
            }
            loadHarnesses()
            await loadSessions()
          } catch (err) {
            console.error('Remove harness failed:', err)
            alert('Failed to remove harness: ' + (err as Error).message)
          }
        })
      }
      if (harnessList) harnessList.appendChild(item)
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
          <input type="checkbox" class="harness-toggle" data-harness="${escapeHtml(name)}" ${enabled ? 'checked' : ''} aria-checked="${String(enabled)}">
          <span>${escapeHtml(name)}</span>
        </label>
      `
      const toggle = row.querySelector('.harness-toggle') as HTMLInputElement | null
      if (toggle) {
        toggle.addEventListener('change', async (_e) => {
          const on = toggle.checked
          harnessSettings[name] = on
          try {
            await synAPI.setHarnessSetting(name, on)
            await loadSessions()
            renderHarnessSettings()
          } catch (err) {
            console.error('Failed to save harness setting:', err)
            toggle.checked = !on
            harnessSettings[name] = !on
            alert('Failed to save harness setting: ' + (err as Error).message)
          }
        })
      }
      if (harnessSettingsEl) harnessSettingsEl.appendChild(row)
    })
  }

  // Initialize
  init()

  // ═══ Column resizing ════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
  const sidebar = document.querySelector('.sidebar') as HTMLElement | null
  const panel = document.querySelector('.panel') as HTMLElement | null
  const resizerSidebar = document.getElementById('resizerSidebar') as HTMLElement | null
  const resizerTerminal = document.getElementById('resizerTerminal') as HTMLElement | null

  let resizing = false
  let resizerType: 'sidebar' | 'terminal' | null = null
  let startX = 0
  let startSidebarWidth = 300
  let startTerminalWidth = 500

  function startResize (e: MouseEvent, type: 'sidebar' | 'terminal') {
    e.preventDefault()
    resizing = true
    resizerType = type
    startX = e.clientX
    startSidebarWidth = sidebar ? sidebar.offsetWidth : 300
    const terminalColumnEl = document.querySelector('.terminal-column') as HTMLElement | null
    startTerminalWidth = terminalColumnEl ? terminalColumnEl.offsetWidth : 500
    if (document.body) document.body.style.cursor = 'col-resize'
    if (type === 'sidebar') {
      if (resizerSidebar) resizerSidebar.classList.add('active')
    } else {
      if (resizerTerminal) resizerTerminal.classList.add('active')
    }
  }

  function endResize () {
    resizing = false
    resizerType = null
    if (document.body) document.body.style.cursor = ''
    if (resizerSidebar) resizerSidebar.classList.remove('active')
    if (resizerTerminal) resizerTerminal.classList.remove('active')
  }

  function doResize (e: MouseEvent) {
    if (!resizing) return
    e.preventDefault()
    const dx = e.clientX - startX
    const containerEl = document.querySelector('.container') as HTMLElement | null
    const containerWidth = containerEl ? containerEl.offsetWidth : 800
    const minWidth = 280

    if (resizerType === 'sidebar') {
      let newWidth = startSidebarWidth + dx
      newWidth = Math.max(minWidth, Math.min(newWidth, containerWidth - minWidth - 280))
      if (sidebar) sidebar.style.width = newWidth + 'px'
      if (panel) panel.style.flex = '1'
      if (resizerSidebar) resizerSidebar.style.left = newWidth + 'px'
    } else if (resizerType === 'terminal') {
      let newWidth = startTerminalWidth - dx
      newWidth = Math.max(minWidth, Math.min(newWidth, containerWidth - minWidth - 280))
      const terminalColumnEl = document.getElementById('terminalColumn') as HTMLElement | null
      if (terminalColumnEl) {
        terminalColumnEl.style.width = newWidth + 'px'
        terminalColumnEl.style.flex = '0 0 auto'
      }
      if (panel) panel.style.flex = '1'
      if (resizerTerminal) resizerTerminal.style.right = newWidth + 'px'
      // Update toggle position if terminal is visible
      if (terminalVisible) {
        updateTogglePosition()
      }
    }
  }

  if (resizerSidebar) {
    resizerSidebar.addEventListener('mousedown', (e) => startResize(e, 'sidebar'))
  }
  if (resizerTerminal) {
    resizerTerminal.addEventListener('mousedown', (e) => startResize(e, 'terminal'))
  }
  document.addEventListener('mousemove', doResize)
  document.addEventListener('mouseup', endResize)

  // Check DB health on startup (Gate G7)
  checkDbHealth()
}

// Helpers
function escapeHtml (text: unknown): string {
  if (!text) return ''
  const div = document.createElement('div')
  div.textContent = String(text)
  return div.innerHTML
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setup)
} else {
  setup()
}

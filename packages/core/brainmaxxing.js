/**
 * Brainmaxxing console commands for Syn.
 *
 * Ported from poteto/brainmaxxing and adapted to Syn's architecture:
 * terminal + MCP + Memory Vault (brain/).
 *
 * Every command reads brain/index.md first, then operates on the Memory Vault
 * and/or indexed sessions via the IndexingEngine.
 *
 * Usage:
 *   const bm = require('./brainmaxxing')
 *   await bm.reflect(sessionId, engine)
 *   await bm.meditate(engine)
 *   await bm.ruminate(engine)
 *   await bm.plan(task, engine)
 *   await bm.review(content, engine)
 *   await bm.brainRead(relativePath)
 *   await bm.brainWrite(relativePath, content)
 *   await bm.brainList()
 *   await bm.rebuildIndex()
 */

const path = require('path')
const fs = require('fs')

// Brain vault lives at the repo root: <repo>/brain
// Can be overridden at runtime via setBrainDir() (used by settings menu)
let BRAIN_DIR = path.join(__dirname, '..', '..', 'brain')

/**
 * Override the Brain Vault directory at runtime.
 * @param {string} newDir - Absolute path to the new brain vault directory
 */
function setBrainDir (newDir) {
  if (!path.isAbsolute(newDir)) throw new Error('Brain dir must be absolute')
  BRAIN_DIR = newDir
  ensureDir(BRAIN_DIR)
}

function ensureDir (dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

function slugify (text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

// ── Brain Vault path containment (G1) ────────────────────────────────

/**
 * Contain a caller-supplied path inside the brain vault.
 * Resolves BRAIN_DIR + relativePath and rejects absolute paths, traversal
 * (`..`) segments, mixed separators, and any resolved target outside BRAIN_DIR
 * — including symlink escapes via realpath.
 * @param {string} relativePath - Path relative to BRAIN_DIR
 * @returns {string} Resolved absolute path inside BRAIN_DIR
 * @throws {Error} If the path cannot be contained
 */
function containBrainPath (relativePath) {
  if (typeof relativePath !== 'string' || relativePath.trim() === '') {
    throw new Error(`Invalid brain path: ${JSON.stringify(relativePath)}`)
  }
  if (path.isAbsolute(relativePath)) {
    throw new Error(`Absolute brain paths are not allowed: ${relativePath}`)
  }
  if (relativePath.includes('/') && relativePath.includes('\\')) {
    throw new Error(`Mixed path separators are not allowed: ${relativePath}`)
  }
  const segments = relativePath.split(/[\\/]+/)
  if (segments.includes('..')) {
    throw new Error(`Path traversal ("..") is not allowed in brain paths: ${relativePath}`)
  }
  const resolved = path.resolve(BRAIN_DIR, relativePath)
  if (resolved !== BRAIN_DIR && !resolved.startsWith(BRAIN_DIR + path.sep)) {
    throw new Error(`Brain path escapes vault: ${relativePath}`)
  }
  const brainDirReal = fs.realpathSync(BRAIN_DIR)
  let targetReal
  try {
    targetReal = fs.realpathSync(resolved)
  } catch (e) {
    if (e.code !== 'ENOENT') throw e
    // New files: fall back to the already-lexically-contained resolved path
    targetReal = resolved
  }
  if (targetReal !== brainDirReal && !targetReal.startsWith(brainDirReal + path.sep)) {
    throw new Error(`Brain path escapes vault via symlink: ${relativePath}`)
  }
  return resolved
}

// ── Brain Vault helpers ──────────────────────────────────────────────────

/**
 * Read a brain/memory file from the vault.
 * @param {string} relativePath - Path relative to BRAIN_DIR
 * @returns {{ok:boolean, path?:string, content?:string, error?:string}} Read result
 */
function brainRead (relativePath) {
  let filePath
  try {
    filePath = containBrainPath(relativePath)
  } catch (e) {
    return { ok: false, error: e.message }
  }
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `Brain file not found: ${relativePath}` }
  }
  const content = fs.readFileSync(filePath, 'utf8')
  return { ok: true, path: relativePath, content }
}

/**
 * Write a brain/memory file to the vault.
 * @param {string} relativePath - Path relative to BRAIN_DIR
 * @param {string} content - File content
 * @returns {{ok:boolean, path?:string, error?:string}} Write result
 */
function brainWrite (relativePath, content) {
  let filePath
  try {
    filePath = containBrainPath(relativePath)
  } catch (e) {
    return { ok: false, error: e.message }
  }
  ensureDir(BRAIN_DIR)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf8')
  return { ok: true, path: relativePath }
}

/**
 * List all .md files in the brain vault.
 * @returns {string[]} Sorted array of paths relative to BRAIN_DIR
 */
function brainList () {
  ensureDir(BRAIN_DIR)
  const files = []
  function walk (dir, prefix) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (entry.isSymbolicLink()) continue
        walk(full, rel)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(rel)
      }
    }
  }
  walk(BRAIN_DIR, '')
  return files.sort()
}

/**
 * Rename a brain/memory file in the vault.
 * @param {string} oldPath - Current path relative to BRAIN_DIR
 * @param {string} newPath - New path relative to BRAIN_DIR
 * @returns {{ok:boolean, path?:string, error?:string}} Rename result
 */
function brainRename (oldPath, newPath) {
  let oldFilePath
  let newFilePath
  try {
    oldFilePath = containBrainPath(oldPath)
  } catch (e) {
    return { ok: false, error: e.message }
  }
  try {
    newFilePath = containBrainPath(newPath)
  } catch (e) {
    return { ok: false, error: e.message }
  }
  if (!fs.existsSync(oldFilePath)) {
    return { ok: false, error: `Brain file not found: ${oldPath}` }
  }
  if (fs.existsSync(newFilePath)) {
    return { ok: false, error: `Brain file already exists: ${newPath}` }
  }
  ensureDir(path.dirname(newFilePath))
  fs.renameSync(oldFilePath, newFilePath)
  return { ok: true, path: newPath }
}

/**
 * Delete a brain/memory file from the vault.
 * @param {string} relativePath - Path relative to BRAIN_DIR
 * @returns {{ok:boolean, error?:string}} Delete result
 */
function brainDelete (relativePath) {
  let filePath
  try {
    filePath = containBrainPath(relativePath)
  } catch (e) {
    return { ok: false, error: e.message }
  }
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `Brain file not found: ${relativePath}` }
  }
  fs.unlinkSync(filePath)
  return { ok: true }
}

/**
 * Import .md files from a source path (file or folder) into the brain vault.
 * @param {string} sourcePath - Absolute path to a .md file or folder
 * @returns {{ok:boolean, imported:number, files:string[], errors:Array<{file:string,error:string}>>}
 */
function brainImport (sourcePath) {
  const errors = []
  const imported = []
  let count = 0

  function copyFile (src, relName) {
    try {
      const destPath = path.join(BRAIN_DIR, relName)
      ensureDir(path.dirname(destPath))
      const content = fs.readFileSync(src, 'utf8')
      fs.writeFileSync(destPath, content, 'utf8')
      imported.push(relName)
      count++
    } catch (e) {
      errors.push({ file: src, error: e.message })
    }
  }

  function walkDir (dir, prefix) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        if (entry.isSymbolicLink()) continue
        walkDir(full, rel)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        copyFile(full, rel)
      }
    }
  }

  try {
    const stat = fs.statSync(sourcePath)
    if (stat.isDirectory()) {
      walkDir(sourcePath, '')
    } else if (stat.isFile() && sourcePath.toLowerCase().endsWith('.md')) {
      const relName = path.basename(sourcePath)
      copyFile(sourcePath, relName)
    } else {
      return { ok: false, imported: 0, files: [], errors: [{ file: sourcePath, error: 'Not a .md file or directory' }] }
    }
  } catch (e) {
    return { ok: false, imported: 0, files: [], errors: [{ file: sourcePath, error: e.message }] }
  }

  return { ok: true, imported: count, files: imported, errors }
}

/**
 * Rebuild brain/index.md from all vault files.
 * @returns {{ok:boolean, files:number}} Rebuild result with file count
 */
function rebuildIndex () {
  ensureDir(BRAIN_DIR)
  const files = brainList()
  const lines = ['# Brain Index', '', 'Root entry point for the Syn Memory Vault. Every brain file is reachable from here.', '', '## Sections', '']
  // Group files by top-level directory
  const groups = {}
  for (const f of files) {
    const top = f.split('/')[0]
    if (!groups[top]) groups[top] = []
    groups[top].push(f)
  }
  const order = ['index.md', 'principles.md', 'codebase.md', 'principles', 'codebase', 'memories', 'plans', 'sessions']
  const seen = new Set()
  for (const key of order) {
    if (groups[key]) {
      for (const f of groups[key]) {
        if (f === 'index.md') continue
        const name = f.replace(/\.md$/, '').split('/').pop()
        lines.push(`- [[${f.replace(/\.md$/, '')}]] — ${name}`)
        seen.add(f)
      }
    }
  }
  for (const f of files) {
    if (seen.has(f) || f === 'index.md') continue
    const name = f.replace(/\.md$/, '').split('/').pop()
    lines.push(`- [[${f.replace(/\.md$/, '')}]] — ${name}`)
  }
  lines.push('', '## Rules', '')
  lines.push('- One topic per file. File name = topic slug (lowercase, hyphenated).')
  lines.push('- `[[wikilink]]` format: `[[section/file-name]]`.')
  lines.push('- Index files are link-only, no inlined content.')
  lines.push('- `brain/index.md` is the root; every brain file reachable from it.')
  lines.push('- Plain markdown, `# Title`, no frontmatter, bullets over prose.')
  lines.push('- Keep notes under ~50 lines.')
  const content = lines.join('\n') + '\n'
  brainWrite('index.md', content)
  return { ok: true, files: files.length }
}

function readIndexMd () {
  const r = brainRead('index.md')
  return r.ok ? r.content : ''
}

// ── /reflect ─────────────────────────────────────────────────────────────
// Scan a session for learnings and write a memory to brain/memories/

const LEARNING_KEYWORDS = [
  'decided', 'decision', 'implemented', 'implementation', 'fixed', 'fix',
  'error', 'bug', 'solution', 'solved', 'pattern', 'architecture', 'approach',
  'learned', 'note', 'remember', 'important', 'key', 'insight'
]

function extractLearnings (content) {
  const lines = content.split('\n')
  const learnings = []
  for (const line of lines) {
    const lower = line.toLowerCase()
    if (LEARNING_KEYWORDS.some(k => lower.includes(k))) {
      const trimmed = line.trim()
      if (trimmed.length > 0 && trimmed.length < 200) {
        learnings.push(trimmed)
      }
    }
  }
  // Dedup
  return [...new Set(learnings)].slice(0, 20)
}

/**
 * /reflect: Scan a session for learnings and write a memory to brain/memories/.
 * @param {string} sessionId - ID of the session to reflect on
 * @param {Object} engine - IndexingEngine instance with getSession()
 * @returns {{ok:boolean, error?:string, path?:string, title?:string, learningsCount?:number, learnings?:string[]}} Reflect result
 */
async function reflect (sessionId, engine) {
  if (!engine || !engine.getSession) {
    return { ok: false, error: 'IndexingEngine not provided' }
  }
  const session = engine.getSession(sessionId)
  if (!session) {
    return { ok: false, error: `Session not found: ${sessionId}` }
  }
  const messages = session.messages || []
  const text = messages.map(m => m.content || '').join('\n')
  const learnings = extractLearnings(text)
  const title = session.title || sessionId
  const slug = slugify(title)
  const date = new Date().toISOString().slice(0, 10)
  const fileName = `memories/reflect-${date}-${slug}.md`
  const lines = [
    `# Reflect: ${title}`,
    '',
    `Source: session [[${sessionId}]] (harness: ${session.harness || 'unknown'})`,
    `Reflected on: ${new Date().toISOString()}`,
    '',
    '## Learnings',
    ''
  ]
  if (learnings.length === 0) {
    lines.push('- No distinct learnings detected in this session.')
  } else {
    for (const l of learnings) {
      lines.push(`- ${l}`)
    }
  }
  lines.push('', '---', '', 'Generated by `/reflect` (Syn brainmaxxing).')
  brainWrite(fileName, lines.join('\n') + '\n')
  rebuildIndex()
  return {
    ok: true,
    path: fileName,
    title,
    learningsCount: learnings.length,
    learnings
  }
}

// ── /meditate ────────────────────────────────────────────────────────────
// Audit brain vault, prune stale notes, extract principles

/**
 * /meditate: Audit brain vault, prune stale notes, extract principles.
 * @param {Object} engine - IndexingEngine instance (unused, kept for signature consistency)
 * @returns {{ok:boolean, filesAudited:number, principlesExtracted:number, staleNotes:string[], report:string, path?:string}} Meditate report
 */
async function meditate (engine) {
  const files = brainList()
  const report = {
    ok: true,
    filesAudited: files.length,
    principlesExtracted: 0,
    staleNotes: [],
    report: ''
  }
  const principleKeywords = ['principle', 'rule', 'never', 'always', 'must', 'should', 'guideline']
  const extracted = []
  for (const f of files) {
    const r = brainRead(f)
    if (!r.ok) continue
    const content = r.content
    const lower = content.toLowerCase()
    for (const kw of principleKeywords) {
      if (lower.includes(kw)) {
        extracted.push({ file: f, keyword: kw })
        break
      }
    }
    // Detect potentially stale notes (very short, placeholder-like)
    if (content.trim().length < 40 && f !== 'index.md') {
      report.staleNotes.push(f)
    }
  }
  report.principlesExtracted = extracted.length
  const lines = [
    '# Meditate Report',
    '',
    `Audited on: ${new Date().toISOString()}`,
    `Files audited: ${files.length}`,
    `Principles extracted: ${extracted.length}`,
    `Stale notes: ${report.staleNotes.length}`,
    '',
    '## Extracted Principles',
    ''
  ]
  if (extracted.length === 0) {
    lines.push('- No principle candidates found.')
  } else {
    for (const e of extracted) {
      lines.push(`- [[${e.file}]] (keyword: ${e.keyword})`)
    }
  }
  lines.push('', '## Stale Notes (candidates for pruning)', '')
  if (report.staleNotes.length === 0) {
    lines.push('- No stale notes detected.')
  } else {
    for (const f of report.staleNotes) {
      lines.push(`- [[${f}]]`)
    }
  }
  lines.push('', '---', '', 'Generated by `/meditate` (Syn brainmaxxing).')
  const reportFile = `principles/meditate-${new Date().toISOString().slice(0, 10)}.md`
  brainWrite(reportFile, lines.join('\n') + '\n')
  rebuildIndex()
  report.path = reportFile
  return report
}

// ── /ruminate ────────────────────────────────────────────────────────────
// Mine archived sessions for uncaptured patterns

/**
 * /ruminate: Mine archived sessions for uncaptured patterns.
 * @param {Object} engine - IndexingEngine instance with listSessions()/getSession()
 * @returns {{ok:boolean, error?:string, path?:string, sessionsScanned:number, patternsFound:number, patterns:Array}} Ruminate result
 */
async function ruminate (engine) {
  if (!engine || !engine.listSessions || !engine.getSession) {
    return { ok: false, error: 'IndexingEngine not provided' }
  }
  const sessions = engine.listSessions({}) || []
  const patterns = []
  for (const s of sessions.slice(0, 50)) {
    const session = engine.getSession(s.session_id)
    if (!session) continue
    const messages = session.messages || []
    const text = messages.map(m => m.content || '').join('\n').toLowerCase()
    const hits = []
    for (const kw of ['refactor', 'refactoring', 'architecture', 'design pattern', 'workaround', 'hack', 'todo', 'fixme', 'optimization', 'performance']) {
      if (text.includes(kw)) hits.push(kw)
    }
    if (hits.length > 0) {
      patterns.push({ sessionId: s.session_id, title: s.title, harness: s.harness, hits })
    }
  }
  const date = new Date().toISOString().slice(0, 10)
  const fileName = `sessions/ruminate-${date}.md`
  const lines = [
    '# Ruminate: Archived Session Patterns',
    '',
    `Minied on: ${new Date().toISOString()}`,
    `Sessions scanned: ${sessions.length}`,
    `Patterns found: ${patterns.length}`,
    '',
    '## Patterns',
    ''
  ]
  if (patterns.length === 0) {
    lines.push('- No recurring patterns detected in sampled sessions.')
  } else {
    for (const p of patterns) {
      lines.push(`- [[session:${p.sessionId}]] "${p.title}" (${p.harness}): ${p.hits.join(', ')}`)
    }
  }
  lines.push('', '---', '', 'Generated by `/ruminate` (Syn brainmaxxing).')
  brainWrite(fileName, lines.join('\n') + '\n')
  rebuildIndex()
  return { ok: true, path: fileName, sessionsScanned: sessions.length, patternsFound: patterns.length, patterns }
}

// ── /plan ────────────────────────────────────────────────────────────────
// Break a task into phased plans, write to brain/plans/

/**
 * /plan: Break a task into phased plans, write to brain/plans/.
 * @param {string} task - Task description
 * @param {Object} engine - IndexingEngine instance (unused, kept for signature consistency)
 * @returns {{ok:boolean, path:string, task:string}} Plan result
 */
async function plan (task, engine) {
  const date = new Date().toISOString().slice(0, 10)
  const slug = slugify(task)
  const fileName = `plans/plan-${date}-${slug}.md`
  const lines = [
    `# Plan: ${task}`,
    '',
    `Created: ${new Date().toISOString()}`,
    '',
    '## Phases',
    '',
    '1. Discovery — research the task and gather context (use `/locate` to search prior sessions).',
    '2. Design — sketch the approach and check against brain principles.',
    '3. Implement — write the code, keeping sessions read-only.',
    '4. Validate — run tests, lint, and the validation loop for this phase.',
    '5. Document — update brain/ and write a memory via `/reflect`.',
    '',
    '## Success Condition',
    '',
    '- The plan is complete when every checkpoint is validated before proceeding.',
    '',
    '---',
    '',
    `Generated by \`/plan\` (Syn brainmaxxing) for task: ${task}`
  ]
  brainWrite(fileName, lines.join('\n') + '\n')
  rebuildIndex()
  return { ok: true, path: fileName, task }
}

// ── /review ──────────────────────────────────────────────────────────────
// Review code/plans against principles

/**
 * /review: Review code/plans against principles.
 * @param {string} content - Content to review
 * @param {Object} engine - IndexingEngine instance (unused, kept for signature consistency)
 * @returns {{ok:boolean, path:string, issues:Array<{severity:string,message:string}>}} Review result
 */
async function review (content, engine) {
  const issues = []
  const lower = content.toLowerCase()
  if (lower.includes('copy ') || lower.includes('duplicate')) {
    issues.push({ severity: 'high', message: 'Avoid copying or duplicating original session files (read-only principle).' })
  }
  if (lower.includes('network') || lower.includes('fetch(') || lower.includes('axios')) {
    issues.push({ severity: 'medium', message: 'MCP server is local-only over stdio; avoid network calls.' })
  }
  if (!lower.includes('principle') && content.length > 200) {
    issues.push({ severity: 'low', message: 'Consider referencing relevant brain principles in this review target.' })
  }
  const date = new Date().toISOString().slice(0, 10)
  const slug = slugify(content.slice(0, 40))
  const fileName = `plans/review-${date}-${slug}.md`
  const lines = [
    '# Review',
    '',
    `Reviewed: ${new Date().toISOString()}`,
    `Issues found: ${issues.length}`,
    '',
    '## Issues',
    ''
  ]
  if (issues.length === 0) {
    lines.push('- No issues found against current principles.')
  } else {
    let i = 1
    for (const issue of issues) {
      lines.push(`${i}. [${issue.severity}] ${issue.message}`)
      i++
    }
  }
  lines.push('', '---', '', 'Generated by `/review` (Syn brainmaxxing).')
  brainWrite(fileName, lines.join('\n') + '\n')
  rebuildIndex()
  return { ok: true, path: fileName, issues }
}

module.exports = {
  BRAIN_DIR,
  containBrainPath,
  setBrainDir,
  brainRead,
  brainWrite,
  brainRename,
  brainDelete,
  brainList,
  brainImport,
  rebuildIndex,
  readIndexMd,
  reflect,
  meditate,
  ruminate,
  plan,
  review
}

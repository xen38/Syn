// Gate G1 — Brain path containment + brainmaxxing read/write/list shape
// Validates nextphase.md Phase A: containBrainPath for brainRead/brainWrite,
// plus read/write/list round-trip, command output shapes, and index.md rebuild.

const path = require('path')
const fs = require('fs')
const bm = require('../packages/core/brainmaxxing')

const BRAIN_DIR = bm.BRAIN_DIR
const REPO_ROOT = path.join(__dirname, '..')

let passed = 0
let failed = 0

function assert (condition, name) {
  if (condition) { passed += 1; console.log(`  PASS: ${name}`) } else { failed += 1; console.log(`  FAIL: ${name}`) }
}

function unlinkSilent (filePath) {
  try { fs.unlinkSync(filePath) } catch (e) {}
}

function rmdirRecursiveSilent (dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.readdirSync(dirPath).forEach(f => {
        const fp = path.join(dirPath, f)
        if (fs.statSync(fp).isDirectory()) rmdirRecursiveSilent(fp)
        else fs.unlinkSync(fp)
      })
      fs.rmdirSync(dirPath)
    }
  } catch (e) {}
}

async function containmentTests () {
  console.log('\n=== G1: Path containment ===')

  const badPaths = [
    '../../../escape.txt',
    '..\\..\\..\\escape.txt',
    'principles/../../../escape.txt',
    'foo/..\\..\\bar.md',
    '..',
    '..\\..'
  ]
  const absolutePath = process.platform === 'win32' ? 'C:\\Windows\\win.ini' : '/etc/passwd'
  assert(path.isAbsolute(absolutePath), 'fixture is absolute on this platform')

  // Outside-vault locations that must never be written to
  const outsideCandidates = [
    path.join(REPO_ROOT, '..', '..', 'escape.txt'),
    path.join(REPO_ROOT, 'escape.txt')
  ]
  outsideCandidates.forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p) })

  for (const p of [...badPaths, absolutePath]) {
    const writeResult = bm.brainWrite(p, 'escape attempt')
    assert(!writeResult.ok, `brainWrite rejected: ${JSON.stringify(p)}`)
    const readResult = bm.brainRead(p)
    assert(!readResult.ok, `brainRead rejected: ${JSON.stringify(p)}`)
  }

  // Simulate the MCP handler error path: non-ok result becomes isError
  function mcpHandle (name, args) {
    const result = name === 'syn_read_brain' ? bm.brainRead(args.path) : bm.brainWrite(args.path, args.content)
    return !result.ok ? { isError: true, error: result.error } : { ok: true }
  }
  assert(mcpHandle('syn_write_brain', { path: '../../../escape.txt', content: 'x' }).isError, 'MCP syn_write_brain traversal -> error')
  assert(mcpHandle('syn_read_brain', { path: '../../../package.json' }).isError, 'MCP syn_read_brain traversal -> error')

  outsideCandidates.forEach(p => {
    assert(!fs.existsSync(p), `no file written outside vault: ${p}`)
  })

  // Absolute path rejection carries a specific message
  const absoluteResult = bm.brainRead(absolutePath)
  assert(!absoluteResult.ok && absoluteResult.error.includes('Absolute'), 'absolute path rejected with message')

  // Legitimate in-vault ops unchanged
  assert(bm.brainRead('index.md').ok, 'brainRead index.md ok')
  assert(typeof bm.containBrainPath('principles/meditate-2026-11-14.md') === 'string', 'containBrainPath resolves in-vault path')
}

async function roundTripTests () {
  console.log('\n=== G1: read/write/list round-trip ===')

  const testFile = 'g1-containment-tmp.md'
  const testFilePath = path.join(BRAIN_DIR, testFile)
  try {
    const w = bm.brainWrite(testFile, '# G1 containment check\n')
    assert(w.ok && w.path === testFile, 'brainWrite in-vault file ok')
    const r = bm.brainRead(testFile)
    assert(r.ok && r.path === testFile && r.content === '# G1 containment check\n', 'brainRead round-trip matches written content')
    assert(bm.brainList().includes(testFile), 'brainList contains newly written file')

    const nested = 'g1-containment-tmp/nested.md'
    const w2 = bm.brainWrite(nested, 'nested\n')
    assert(w2.ok, 'brainWrite nested path ok')
    assert(bm.brainList().includes(nested), 'brainList contains nested file')
  } finally {
    unlinkSilent(testFilePath)
    rmdirRecursiveSilent(path.join(BRAIN_DIR, 'g1-containment-tmp'))
    bm.rebuildIndex()
  }

  // Non-.md files are not listed
  const stray = path.join(BRAIN_DIR, 'g1-containment-stray.txt')
  fs.writeFileSync(stray, 'not a memory\n')
  try {
    assert(!bm.brainList().includes('g1-containment-stray.txt'), 'brainList excludes non-.md files')
  } finally {
    unlinkSilent(stray)
    bm.rebuildIndex()
  }

  // Every listed entry is relative, ends with .md, and has no traversal
  bm.brainList().forEach(f => {
    assert(f.endsWith('.md'), `brainList entry ends with .md: ${f}`)
    assert(!f.includes('..'), `brainList entry has no traversal: ${f}`)
    assert(!path.isAbsolute(f), `brainList entry is relative: ${f}`)
  })
}

async function shapeTests () {
  console.log('\n=== G1: command output shape ===')
  const today = new Date().toISOString().slice(0, 10)

  const planResult = await bm.plan('G1 containment test task')
  assert(planResult.ok && planResult.task === 'G1 containment test task', 'plan output shape')
  assert(typeof planResult.path === 'string' && planResult.path.startsWith(`plans/plan-${today}-`), 'plan path under plans/')

  const reviewResult = await bm.review('avoid network calls and duplication')
  assert(reviewResult.ok && Array.isArray(reviewResult.issues), 'review output shape')
  assert(typeof reviewResult.path === 'string' && reviewResult.path.startsWith(`plans/review-${today}-`), 'review path under plans/')

  const meditateResult = await bm.meditate({})
  assert(meditateResult.ok && typeof meditateResult.filesAudited === 'number', 'meditate output shape')
  assert(typeof meditateResult.report === 'string' && meditateResult.path.startsWith(`principles/meditate-${today}`), 'meditate path under principles/')

  const reflectResult = await bm.reflect('sess-g1', {
    getSession: () => ({
      title: 'G1 Session',
      messages: [{ role: 'user', content: 'decided to implement path containment' }],
      harness: 'test'
    })
  })
  assert(reflectResult.ok && typeof reflectResult.learningsCount === 'number', 'reflect output shape')
  assert(reflectResult.path.startsWith(`memories/reflect-${today}-`), 'reflect path under memories/')

  const ruminateResult = await bm.ruminate({ listSessions: () => [], getSession: () => null })
  assert(ruminateResult.ok && ruminateResult.sessionsScanned === 0 && ruminateResult.patternsFound === 0, 'ruminate output shape')
  assert(ruminateResult.path.startsWith(`sessions/ruminate-${today}`), 'ruminate path under sessions/')

  // Clean up generated vault files and rebuild the index
  ;[
    planResult.path,
    reviewResult.path,
    meditateResult.path,
    reflectResult.path,
    ruminateResult.path
  ].forEach(p => unlinkSilent(path.join(BRAIN_DIR, p)))
  bm.rebuildIndex()
}

async function indexTests () {
  console.log('\n=== G1: index.md rebuild ===')
  const result = bm.rebuildIndex()
  assert(result.ok && typeof result.files === 'number' && result.files >= 1, 'rebuildIndex output shape')
  const indexPath = path.join(BRAIN_DIR, 'index.md')
  assert(fs.existsSync(indexPath), 'brain/index.md exists after rebuild')
  assert(fs.readFileSync(indexPath, 'utf8').includes('# Brain Index'), 'index.md has root header')
}

async function main () {
  await containmentTests()
  await roundTripTests()
  await shapeTests()
  await indexTests()

  console.log(`\n=== G1 brainmaxxing tests: ${passed} passed, ${failed} failed ===`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => {
  console.error('Test error:', e)
  process.exit(1)
})

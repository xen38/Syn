// Gate G1 — Brain path containment + brainmaxxing read/write/list shape
// Validates nextphase.md Phase A: containBrainPath for brainRead/brainWrite,
// plus read/write/list round-trip, command output shapes, and index.md rebuild.

import path from 'path'
import fs from 'fs'
import { brainWrite, brainRead, brainList, containBrainPath, rebuildIndex, reflect, meditate, ruminate, plan, review, BRAIN_DIR } from '../packages/core/brainmaxxing'

const REPO_ROOT = path.join(__dirname, '..')

let passed = 0
let failed = 0

function assert (condition: boolean, name: string) {
  if (condition) { passed += 1; console.log(`  PASS: ${name}`) } else { failed += 1; console.log(`  FAIL: ${name}`) }
}

function unlinkSilent (filePath: string) {
  try { fs.unlinkSync(filePath) } catch {}
}

function rmdirRecursiveSilent (dirPath: string) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.readdirSync(dirPath).forEach(f => {
        const fp = path.join(dirPath, f)
        if (fs.statSync(fp).isDirectory()) rmdirRecursiveSilent(fp)
        else fs.unlinkSync(fp)
      })
      fs.rmdirSync(dirPath)
    }
  } catch {}
}

async function containmentTests () {
  console.log('\n=== G1: Path containment ===')

  const badPaths: string[] = [
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
  const outsideCandidates: string[] = [
    path.join(REPO_ROOT, '..', '..', 'escape.txt'),
    path.join(REPO_ROOT, 'escape.txt')
  ]
  outsideCandidates.forEach(p => { if (fs.existsSync(p)) fs.unlinkSync(p) })

  for (const p of [...badPaths, absolutePath]) {
    const writeResult = brainWrite(p, 'escape attempt')
    assert(writeResult.ok !== true, `brainWrite rejected: ${JSON.stringify(p)}`)
    const readResult = brainRead(p)
    assert(readResult.ok !== true, `brainRead rejected: ${JSON.stringify(p)}`)
  }

  // Simulate the MCP handler error path: non-ok result becomes isError
  function mcpHandle (name: string, args: { path: string; content?: string }) {
    const result = name === 'syn_read_brain' ? brainRead(args.path) : brainWrite(args.path, args.content ?? '')
    return result.ok !== true ? { isError: true, error: result.error } : { isError: false, error: undefined }
  }
  assert(mcpHandle('syn_write_brain', { path: '../../../escape.txt', content: 'x' }).isError, 'MCP syn_write_brain traversal -> error')
  assert(mcpHandle('syn_read_brain', { path: '../../../package.json' }).isError, 'MCP syn_read_brain traversal -> error')

  outsideCandidates.forEach(p => {
    assert(!fs.existsSync(p), `no file written outside vault: ${p}`)
  })

  // Absolute path rejection carries a specific message
  const absoluteResult = brainRead(absolutePath)
  assert(absoluteResult.ok !== true && absoluteResult.error !== undefined && absoluteResult.error.includes('Absolute'), 'absolute path rejected with message')

  // Legitimate in-vault ops unchanged
  assert(brainRead('index.md').ok !== false, 'brainRead index.md ok')
  assert(typeof containBrainPath('principles/meditate-2026-11-14.md') === 'string', 'containBrainPath resolves in-vault path')
}

async function roundTripTests () {
  console.log('\n=== G1: read/write/list round-trip ===')

  const testFile = 'g1-containment-tmp.md'
  const testFilePath = path.join(BRAIN_DIR, testFile)
  try {
    const w = brainWrite(testFile, '# G1 containment check\n')
    assert(w.ok !== false && w.path === testFile, 'brainWrite in-vault file ok')
    const r = brainRead(testFile)
    assert(r.ok !== false && r.path === testFile && r.content === '# G1 containment check\n', 'brainRead round-trip matches written content')
    assert(brainList().includes(testFile), 'brainList contains newly written file')

    const nested = 'g1-containment-tmp/nested.md'
    const w2 = brainWrite(nested, 'nested\n')
    assert(w2.ok !== false, 'brainWrite nested path ok')
    assert(brainList().includes(nested), 'brainList contains nested file')
  } finally {
    unlinkSilent(testFilePath)
    rmdirRecursiveSilent(path.join(BRAIN_DIR, 'g1-containment-tmp'))
    rebuildIndex()
  }

  // Non-.md files are not listed
  const stray = path.join(BRAIN_DIR, 'g1-containment-stray.txt')
  fs.writeFileSync(stray, 'not a memory\n')
  try {
    assert(!brainList().includes('g1-containment-stray.txt'), 'brainList excludes non-.md files')
  } finally {
    unlinkSilent(stray)
    rebuildIndex()
  }

  // Every listed entry is relative, ends with .md, and has no traversal
  brainList().forEach(f => {
    assert(f.endsWith('.md'), `brainList entry ends with .md: ${f}`)
    assert(!f.includes('..'), `brainList entry has no traversal: ${f}`)
    assert(!path.isAbsolute(f), `brainList entry is relative: ${f}`)
  })
}

async function shapeTests () {
  console.log('\n=== G1: command output shape ===')
  const today = new Date().toISOString().slice(0, 10)

  const planResult = await plan('G1 containment test task', {})
  assert(planResult.ok !== false && planResult.task === 'G1 containment test task', 'plan output shape')
  assert(typeof planResult.path === 'string' && planResult.path.startsWith(`plans/plan-${today}-`), 'plan path under plans/')

  const reviewResult = await review('avoid network calls and duplication', {})
  assert(reviewResult.ok !== false && Array.isArray(reviewResult.issues), 'review output shape')
  assert(typeof reviewResult.path === 'string' && reviewResult.path.startsWith(`plans/review-${today}-`), 'review path under plans/')

  const meditateResult = await meditate({})
  assert(meditateResult.ok !== false && typeof meditateResult.filesAudited === 'number', 'meditate output shape')
  assert(typeof meditateResult.report === 'string' && typeof meditateResult.path === 'string' && meditateResult.path.startsWith(`principles/meditate-${today}`), 'meditate path under principles/')

  const reflectResult = await reflect('sess-g1', {
    getSession: () => ({
      id: 1,
      session_id: 'sess-g1',
      message_index: 0,
      title: 'G1 Session',
      timestamp: new Date().toISOString(),
      content: 'decided to implement path containment',
      role: 'user',
      tool_calls: null,
      harness: 'test',
      source_path: 'test/session.md',
      file_path: 'test/session.md',
      file_ext: '.md',
      file_mtime: Date.now(),
      file_size: 100,
      file_hash: 'abc123',
      created_at: new Date().toISOString(),
      indexed_at: new Date().toISOString(),
      content_hash: 'def456',
      messages: [{ session_id: 'sess-g1', message_index: 0, role: 'user', timestamp: new Date().toISOString(), content: 'decided to implement path containment', tool_calls: null }]
    })
  })
  assert(reflectResult.ok !== false && typeof reflectResult.learningsCount === 'number', 'reflect output shape')
  assert(typeof reflectResult.path === 'string' && reflectResult.path.startsWith(`memories/reflect-${today}-`), 'reflect path under memories/')

  const ruminateResult = await ruminate({ listSessions: () => [], getSession: () => null })
  assert(ruminateResult.ok !== false && ruminateResult.sessionsScanned === 0 && ruminateResult.patternsFound === 0, 'ruminate output shape')
  assert(typeof ruminateResult.path === 'string' && ruminateResult.path.startsWith(`sessions/ruminate-${today}`), 'ruminate path under sessions/')

  // Clean up generated vault files and rebuild the index
  ;[
    planResult.path,
    reviewResult.path,
    meditateResult.path,
    reflectResult.path,
    ruminateResult.path
  ].filter((p): p is string => p !== undefined).forEach(p => unlinkSilent(path.join(BRAIN_DIR, p)))
  rebuildIndex()
}

async function indexTests () {
  console.log('\n=== G1: index.md rebuild ===')
  const result = rebuildIndex()
  assert(result.ok !== false && typeof result.files === 'number' && result.files >= 1, 'rebuildIndex output shape')
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

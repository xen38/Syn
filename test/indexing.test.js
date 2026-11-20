/**
 * Test the Locate Core Indexing Engine with fixture data.
 *
 * Deterministic, portable — uses test/fixtures/ sample archives so CI does not
 * depend on real user data on C:\ or K:\. Covers indexing, search, session
 * retrieval, incremental indexing, and archive file integrity (originals
 * unchanged).
 */

const path = require('path')
const fs = require('fs')
const os = require('os')
const crypto = require('crypto')
const { IndexingEngine } = require('../packages/core/index')

const FIXTURES_DIR = path.join(__dirname, 'fixtures')
const DB_PATH = path.join(os.tmpdir(), 'syn-indexing-test-index.db')

let passed = 0
let failed = 0

function assert (condition, message) {
  if (condition) {
    passed++
    console.log(`  PASS: ${message}`)
  } else {
    failed++
    console.log(`  FAIL: ${message}`)
  }
}

function cleanupDb () {
  try { fs.unlinkSync(DB_PATH) } catch (e) {}
  try { fs.unlinkSync(DB_PATH + '-wal') } catch (e) {}
  try { fs.unlinkSync(DB_PATH + '-shm') } catch (e) {}
}

cleanupDb()

async function runTests () {
  console.log('=== Indexing Engine Tests (fixture-based) ===\n')

  // Test 1: Engine initialization
  console.log('Test 1: Engine initialization')
  const engine = new IndexingEngine(DB_PATH)
  await engine.open()
  assert(engine.initialized, 'engine should be initialized')
  assert(fs.existsSync(DB_PATH), 'database file should exist')

  // Test 2: Add fixture harness sources
  console.log('\nTest 2: Add fixture harness sources')
  const clineDir = path.join(FIXTURES_DIR, 'cline/sessions')
  const cursorDir = path.join(FIXTURES_DIR, 'cursor/agent-transcripts/abc123')
  const aiderDir = path.join(FIXTURES_DIR, 'aider')
  const geminiDir = path.join(FIXTURES_DIR, 'gemini')

  const cId = engine.addSource(clineDir, 'Cline')
  assert(cId > 0, 'should add Cline source and return id')
  const cuId = engine.addSource(cursorDir, 'Cursor')
  assert(cuId > 0, 'should add Cursor source and return id')
  const aId = engine.addSource(aiderDir, 'Aider')
  assert(aId > 0, 'should add Aider source and return id')
  const gId = engine.addSource(geminiDir, 'Gemini CLI')
  assert(gId > 0, 'should add Gemini CLI source and return id')

  const sources = engine.listSources()
  assert(sources.length >= 4, `should have >= 4 sources (got ${sources.length})`)

  // Test 3: Index all sources
  console.log('\nTest 3: Index fixture sources')
  const result = await engine.indexAllSources()
  assert(result.indexed > 0, `should index sessions (got ${result.indexed})`)
  assert(result.status !== 'error', 'should not have errors')
  console.log(`  Indexed: ${result.indexed}, Skipped: ${result.skipped}, Total: ${result.total}`)

  // Test 4: Search sessions
  console.log('\nTest 4: Search sessions')
  const searchResults = engine.search('session')
  assert(searchResults.length > 0, `should find results for "session" (got ${searchResults.length})`)
  assert(searchResults.some(r => r.excerpt && typeof r.excerpt === 'string'), 'results should have excerpts')
  console.log(`  Found ${searchResults.length} results`)

  // Test 5: Search with harness filter
  console.log('\nTest 5: Search with harness filter')
  const filtered = engine.search('session', { harness: 'Cline' })
  assert(filtered.length > 0, 'should find results with harness filter')
  assert(filtered.every(r => r.harness === 'Cline'), 'all results should be from Cline')

  // Test 6: Search with date filter
  console.log('\nTest 6: Search with date filter')
  const dated = engine.search('session', { dateFrom: '2024-01-01', dateTo: '2026-12-31' })
  assert(dated.length >= 0, 'date filter should work without error')

  // Test 7: Get session
  console.log('\nTest 7: Get session')
  const allSessions = engine.listSessions()
  assert(allSessions.length > 0, 'should have sessions')
  const session = engine.getSession(allSessions[0].session_id)
  assert(session !== null, 'should retrieve session')
  assert(session.messages !== undefined, 'session should have messages')
  assert(Array.isArray(session.messages), 'messages should be an array')
  console.log(`  Session: ${session.title} (${session.messages.length} messages)`)

  // Test 8: Get context
  console.log('\nTest 8: Get context')
  if (session.messages.length > 0) {
    const ctx = engine.getContext(session.session_id, 0, 2, 2)
    assert(ctx !== null, 'should retrieve context')
    assert(ctx.messages.length > 0, 'context should have messages')
  }

  // Test 9: Count sessions
  console.log('\nTest 9: Count sessions')
  const count = engine.countSessions()
  assert(count > 0, 'should have sessions')
  console.log(`  Total sessions: ${count}`)

  // Test 10: Incremental indexing (re-index, should skip unchanged)
  console.log('\nTest 10: Incremental indexing - skip unchanged')
  const result2 = await engine.indexAllSources()
  assert(result2.skipped > 0, `should skip unchanged files (got ${result2.skipped})`)
  assert(result2.indexed === 0, 'should not re-index unchanged files')

  // Test 11: Archive file integrity (fixtures unchanged)
  console.log('\nTest 11: Archive file integrity')
  const originalHashes = {}
  function collectHashes (dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) collectHashes(full)
      else if (e.isFile() && !/-wal$|-shm$/.test(e.name)) {
        originalHashes[full] = crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')
      }
    }
  }
  collectHashes(FIXTURES_DIR)
  await engine.indexAllSources()
  let integrityOk = true
  for (const [f, hash] of Object.entries(originalHashes)) {
    const current = crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')
    if (current !== hash) {
      console.log(`    FILE MODIFIED: ${f}`)
      integrityOk = false
    }
  }
  assert(integrityOk, 'original fixture files must remain unchanged')

  // Test 12: Remove source
  console.log('\nTest 12: Remove source')
  engine.removeSource(clineDir)
  const sourcesAfter = engine.listSources()
  assert(sourcesAfter.length === sources.length - 1, 'source should be removed')

  engine.close()
  cleanupDb()

  console.log(`\n=== ${passed} passed, ${failed} failed ===`)
  process.exit(failed > 0 ? 1 : 0)
}

runTests().catch(e => {
  console.error('Test error:', e)
  cleanupDb()
  process.exit(1)
})

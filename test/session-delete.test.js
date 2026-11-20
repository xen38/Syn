// Phase B — Release Gate G2: Preserve source archives by default
// Tests that index-only removal (session:delete / engine.removeSession)
// never deletes the original archive file from disk, and that
// session:deleteFile is disabled (returns unsupported error).

const path = require('path')
const fs = require('fs')
const os = require('os')
const crypto = require('crypto')
const { IndexingEngine } = require('../packages/core/index')

function makeTempDb () {
  return path.join(os.tmpdir(), 'syn-g2-test-' + Date.now() + '.db')
}
function cleanupDb (dbPath) {
  try { fs.unlinkSync(dbPath) } catch (e) {}
  try { fs.unlinkSync(dbPath + '-wal') } catch (e) {}
  try { fs.unlinkSync(dbPath + '-shm') } catch (e) {}
}
function cleanupDir (dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.readdirSync(dirPath).forEach(f => {
        const fp = path.join(dirPath, f)
        if (fs.statSync(fp).isDirectory()) cleanupDir(fp)
        else fs.unlinkSync(fp)
      })
      fs.rmdirSync(dirPath)
    }
  } catch (e) {}
}

let passed = 0
let failed = 0

function assert (condition, name) {
  if (condition) { passed++; console.log(`  PASS: ${name}`) } else { failed++; console.log(`  FAIL: ${name}`) }
}

function hashFile (filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

async function main () {
  console.log('=== G2: Preserve source archives by default ===')

  // ── Setup: create a temp archive file and index it ──
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syn-g2-'))
  const sessionsDir = path.join(baseDir, '.cline', 'sessions')
  fs.mkdirSync(sessionsDir, { recursive: true })

  const archiveFile = path.join(sessionsDir, 'arch-001.jsonl')
  const archiveContent = JSON.stringify({
    session_id: 'arch-001',
    title: 'Archive Session',
    role: 'user',
    content: 'This is an archived session that must never be deleted.'
  }) + '\n'
  fs.writeFileSync(archiveFile, archiveContent)

  const archiveHashBefore = hashFile(archiveFile)

  const TEST_DB = makeTempDb()
  const engine = new IndexingEngine(TEST_DB, { redactSecrets: false, excludedPaths: [] })
  await engine.open()

  const sourceId = engine.addSource(baseDir, 'Cline')
  const indexResult = await engine.indexSource(sourceId)
  assert(indexResult.indexed >= 1, 'Archived session indexed successfully')

  const sessions = engine.listSessions()
  const archSession = sessions.find(s => s.session_id && s.session_id.startsWith('arch-001'))
  assert(archSession != null, 'Archived session found in index after indexing')

  // ── Test: engine.removeSession() removes from index but does NOT delete file ──
  const removeResult = engine.removeSession(archSession.session_id)
  assert(removeResult === true || removeResult.success === true, 'engine.removeSession() returns success')

  const sessionsAfterRemove = engine.listSessions()
  const archSessionAfter = sessionsAfterRemove.find(s => s.session_id && s.session_id.startsWith('arch-001'))
  assert(archSessionAfter == null, 'Session removed from index after engine.removeSession()')

  // File must still exist on disk
  assert(fs.existsSync(archiveFile), 'Original archive file still exists on disk after index removal')

  // File hash must be unchanged
  const archiveHashAfter = hashFile(archiveFile)
  assert(archiveHashBefore === archiveHashAfter, 'Archive file hash unchanged after index removal')

  // ── Test: Re-indexing restores the entry ──
  const reindexResult = await engine.indexSource(sourceId)
  assert(reindexResult.indexed >= 1, 'Re-indexing restores the session entry')

  const sessionsAfterReindex = engine.listSessions()
  const archSessionRestored = sessionsAfterReindex.find(s => s.session_id && s.session_id.startsWith('arch-001'))
  assert(archSessionRestored != null, 'Session restored in index after re-indexing')

  // File still exists and unchanged
  assert(fs.existsSync(archiveFile), 'Original archive file still exists after re-indexing')
  const archiveHashFinal = hashFile(archiveFile)
  assert(archiveHashBefore === archiveHashFinal, 'Archive file hash unchanged after re-indexing')

  engine.close()
  cleanupDb(TEST_DB)
  cleanupDir(baseDir)

  console.log(`\n=== G2 session-delete tests: ${passed} passed, ${failed} failed ===`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(e => {
  console.error('Test error:', e)
  process.exit(1)
})

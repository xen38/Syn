// Phase 8 — Privacy & Security tests
// Secret redaction + path exclusions

import path from 'path'
import fs from 'fs'
import os from 'os'
import { IndexingEngine } from '../packages/core/index'

function makeTempDb () {
  return path.join(os.tmpdir(), 'syn-security-test-' + Date.now() + '.db')
}
function cleanupDb (dbPath: string) {
  try { fs.unlinkSync(dbPath) } catch (e) {}
  try { fs.unlinkSync(dbPath + '-wal') } catch (e) {}
  try { fs.unlinkSync(dbPath + '-shm') } catch (e) {}
}
function cleanupDir (dirPath: string) {
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

interface RedactionPattern {
  name: string
  pattern: RegExp
  replacement: string
}

interface EngineOptions {
  redactSecrets?: boolean
  excludedPaths?: string[]
  secretPatterns?: RedactionPattern[]
}

let passed = 0
let failed = 0

function assert (condition: boolean, name: string) {
  if (condition) { passed++; console.log(`  PASS: ${name}`) } else { failed++; console.log(`  FAIL: ${name}`) }
}

async function main () {
  console.log('=== Phase 8.1: Secret redaction ===')

  // Cline-style directory: .cline/sessions/<file>.jsonl
  const baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'syn-sec-'))
  const clineDir = path.join(baseDir, '.cline', 'sessions')
  fs.mkdirSync(clineDir, { recursive: true })

  const secretFile = path.join(clineDir, 'test-session.jsonl')
  const secretLines = [
    { session_id: 'sec-001', title: 'Secret test session', role: 'user', content: 'My GitHub token is ghp_abcdefghijklmnopqrstuvwxyz1234567890' },
    { session_id: 'sec-001', title: 'Secret test session', role: 'assistant', content: 'I can help with that AWS key AKIAIOSFODNN7EXAMPLE' },
    { session_id: 'sec-001', title: 'Secret test session', role: 'user', content: 'Normal message without secrets' }
  ]
  fs.writeFileSync(secretFile, secretLines.map(l => JSON.stringify(l)).join('\n') + '\n')

  const TEST_DB = makeTempDb()
  const engine = new IndexingEngine(TEST_DB, { redactSecrets: true, excludedPaths: [] } as EngineOptions)
  await engine.open()

  const sourceId = engine.addSource(baseDir, 'Cline')
  const result = await engine.indexSource(sourceId)
  assert(result.indexed >= 1, 'Indexed secret-containing session')

  const searchResults = engine.search('[REDACTED_GITHUB_TOKEN]')
  assert(searchResults.length > 0, 'Secret session found in index')
  const secSession = searchResults[0]
  if (secSession) {
    const full = engine.getSession(secSession.session_id)
    const userMsg = full!.messages.find(m => m.role === 'user' && m.content.includes('[REDACTED_GITHUB_TOKEN]'))
    const assistantMsg = full!.messages.find(m => m.role === 'assistant' && m.content.includes('[REDACTED_AWS_KEY]'))
    const normalMsg = full!.messages.find(m => m.content === 'Normal message without secrets')
    assert(!!(userMsg && !userMsg.content.includes('ghp_')), 'GitHub token redacted from user message')
    assert(!!(userMsg && userMsg.content.includes('[REDACTED_GITHUB_TOKEN]')), 'GitHub token replaced with redaction marker')
    assert(!!(assistantMsg && !assistantMsg.content.includes('AKIA')), 'AWS key redacted from assistant message')
    assert(!!(assistantMsg && assistantMsg.content.includes('[REDACTED_AWS_KEY]')), 'AWS key replaced with redaction marker')
    assert(normalMsg != null, 'Normal message preserved unchanged')
  }

  // Verify original file on disk is untouched
  const originalContent = fs.readFileSync(secretFile, 'utf8')
  assert(originalContent.includes('ghp_'), 'Original file on disk still contains GitHub token')
  assert(originalContent.includes('AKIA'), 'Original file on disk still contains AWS key')

  engine.close()
  cleanupDb(TEST_DB)
  cleanupDir(baseDir)

  // Engine with redaction disabled
  const TEST_DB2 = makeTempDb()
  const engine2 = new IndexingEngine(TEST_DB2, { redactSecrets: false, excludedPaths: [] } as EngineOptions)
  await engine2.open()

  const baseDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'syn-sec-'))
  const clineDir2 = path.join(baseDir2, '.cline', 'sessions')
  fs.mkdirSync(clineDir2, { recursive: true })
  const secretFile2 = path.join(clineDir2, 'test-session.jsonl')
  const lines2 = [
    { session_id: 'sec-002', title: 'No redaction test', role: 'user', content: 'Token: ghp_abcdefghijklmnopqrstuvwxyz1234567890' }
  ]
  fs.writeFileSync(secretFile2, lines2.map(l => JSON.stringify(l)).join('\n') + '\n')

  const sourceId2 = engine2.addSource(baseDir2, 'Cline')
  await engine2.indexSource(sourceId2)
  const searchResults2 = engine2.search('ghp_')
  assert(searchResults2.length > 0, 'Session indexed without redaction')
  const secSession2 = searchResults2[0]
  if (secSession2) {
    const full2 = engine2.getSession(secSession2.session_id)
    const userMsg2 = full2!.messages.find(m => m.role === 'user')
    assert(!!(userMsg2 && userMsg2.content.includes('ghp_')), 'Secret NOT redacted when redactSecrets is false')
  }

  engine2.close()
  cleanupDb(TEST_DB2)
  cleanupDir(baseDir2)

  console.log('\n=== Phase 8.2: Path exclusions ===')

  const TEST_DB3 = makeTempDb()
  const engine3 = new IndexingEngine(TEST_DB3, { redactSecrets: false, excludedPaths: [] } as EngineOptions)
  await engine3.open()

  const baseDir3 = fs.mkdtempSync(path.join(os.tmpdir(), 'syn-sec-'))
  const includedDir = path.join(baseDir3, '.cline', 'sessions', 'included')
  const excludedDir = path.join(baseDir3, '.cline', 'sessions', 'excluded')
  fs.mkdirSync(includedDir, { recursive: true })
  fs.mkdirSync(excludedDir, { recursive: true })

  fs.writeFileSync(path.join(includedDir, 'included-session.jsonl'), JSON.stringify({
    session_id: 'incl-001', title: 'Included Session', role: 'user', content: 'I should be indexed'
  }) + '\n')

  fs.writeFileSync(path.join(excludedDir, 'excluded-session.jsonl'), JSON.stringify({
    session_id: 'excl-001', title: 'Excluded Session', role: 'user', content: 'I should NOT be indexed'
  }) + '\n')

  const sourceId3 = engine3.addSource(baseDir3, 'Cline')
  await engine3.indexSource(sourceId3)
  const sessions3 = engine3.listSessions()
  assert(sessions3.length >= 2, 'Both sessions indexed without exclusions (got ' + sessions3.length + ')')

  engine3.close()
  cleanupDb(TEST_DB3)

  const engine3b = new IndexingEngine(TEST_DB3, {
    redactSecrets: false,
    excludedPaths: [excludedDir]
  } as EngineOptions)
  await engine3b.open()

  const sourceId3b = engine3b.addSource(baseDir3, 'Cline')
  await engine3b.indexSource(sourceId3b)
  const sessions3b = engine3b.listSessions()
  assert(sessions3b.length === 1, 'Only included session indexed with exclusion (got ' + sessions3b.length + ')')
  const exclSession = sessions3b.find(s => s.session_id === 'excl-001')
  assert(exclSession == null, 'Excluded session not in index')

  engine3b.close()
  cleanupDb(TEST_DB3)
  cleanupDir(baseDir3)

  console.log('\n=== Phase 8.2b: Precise exclusion matching (no sibling false positives) ===')

  const TEST_DB4 = makeTempDb()
  const engine4 = new IndexingEngine(TEST_DB4, { redactSecrets: false, excludedPaths: [] } as EngineOptions)
  await engine4.open()

  const baseDir4 = fs.mkdtempSync(path.join(os.tmpdir(), 'syn-sec-'))
  const clineDir4 = path.join(baseDir4, '.cline')
  const clineBackupDir = path.join(baseDir4, '.cline-backup')
  fs.mkdirSync(path.join(clineDir4, 'sessions'), { recursive: true })
  fs.mkdirSync(path.join(clineBackupDir, 'sessions'), { recursive: true })

  fs.writeFileSync(path.join(clineDir4, 'sessions', 'cline-session.jsonl'), JSON.stringify({
    session_id: 'cline-001', title: 'Cline Session', role: 'user', content: 'I should be indexed'
  }) + '\n')

  fs.writeFileSync(path.join(clineBackupDir, 'sessions', 'backup-session.jsonl'), JSON.stringify({
    session_id: 'backup-001', title: 'Backup Session', role: 'user', content: 'I should ALSO be indexed (not excluded)'
  }) + '\n')

  // Exclude .cline but NOT .cline-backup — substring match would wrongly exclude both
  const engine4b = new IndexingEngine(TEST_DB4, {
    redactSecrets: false,
    excludedPaths: [clineDir4]
  } as EngineOptions)
  await engine4b.open()

  const sourceId4b = engine4b.addSource(baseDir4, 'Cline')
  await engine4b.indexSource(sourceId4b)
  const sessions4b = engine4b.listSessions()
  const clineSession = sessions4b.find(s => s.session_id && s.session_id.startsWith('cline-001'))
  const backupSession = sessions4b.find(s => s.session_id && s.session_id.startsWith('backup-001'))
  assert(clineSession == null, 'Excluded .cline session not in index')
  assert(backupSession != null, 'Sibling .cline-backup session NOT wrongly excluded (no false positive)')

  engine4b.close()
  cleanupDb(TEST_DB4)
  cleanupDir(baseDir4)

  console.log('\n=== Phase 8.2c: Case normalization ===')

  const TEST_DB5 = makeTempDb()
  const engine5 = new IndexingEngine(TEST_DB5, { redactSecrets: false, excludedPaths: [] } as EngineOptions)
  await engine5.open()

  const baseDir5 = fs.mkdtempSync(path.join(os.tmpdir(), 'syn-sec-'))
  const excludedDir5 = path.join(baseDir5, '.cline-EXCLUDED')
  const includedDir5 = path.join(baseDir5, '.cline-included')
  fs.mkdirSync(path.join(excludedDir5, 'sessions'), { recursive: true })
  fs.mkdirSync(path.join(includedDir5, 'sessions'), { recursive: true })

  fs.writeFileSync(path.join(excludedDir5, 'sessions', 'ex-session.jsonl'), JSON.stringify({
    session_id: 'ex-001', title: 'Excluded', role: 'user', content: 'Should be excluded'
  }) + '\n')

  fs.writeFileSync(path.join(includedDir5, 'sessions', 'in-session.jsonl'), JSON.stringify({
    session_id: 'in-001', title: 'Included', role: 'user', content: 'Should be indexed'
  }) + '\n')

  // Use a different case than the on-disk directory so POSIX (case-sensitive)
  // does NOT match, while Windows/macOS (case-insensitive) DOES match.
  const engine5b = new IndexingEngine(TEST_DB5, {
    redactSecrets: false,
    excludedPaths: [path.join(baseDir5, '.cline-excluded')]
  } as EngineOptions)
  await engine5b.open()

  const sourceId5b = engine5b.addSource(baseDir5, 'Cline')
  await engine5b.indexSource(sourceId5b)
  const sessions5b = engine5b.listSessions()
  const exSession = sessions5b.find(s => s.session_id && s.session_id.startsWith('ex-001'))
  const inSession = sessions5b.find(s => s.session_id && s.session_id.startsWith('in-001'))
  if (process.platform === 'win32' || process.platform === 'darwin') {
    assert(exSession == null, 'Case-insensitive exclusion matched despite different case')
    assert(inSession != null, 'Non-excluded session still indexed')
  } else {
    assert(exSession != null, 'POSIX: case-sensitive exclusion did not match (expected)')
    assert(inSession != null, 'POSIX: non-excluded session indexed')
  }

  engine5b.close()
  cleanupDb(TEST_DB5)
  cleanupDir(baseDir5)

  console.log('\n=== Phase 8.2d: Exact match exclusion ===')

  const TEST_DB6 = makeTempDb()
  const engine6 = new IndexingEngine(TEST_DB6, { redactSecrets: false, excludedPaths: [] } as EngineOptions)
  await engine6.open()

  const baseDir6 = fs.mkdtempSync(path.join(os.tmpdir(), 'syn-sec-'))
  const exactDir = path.join(baseDir6, '.cline-exact-exclude')
  const siblingDir = path.join(baseDir6, '.cline-exact-exclude-sibling')
  fs.mkdirSync(path.join(exactDir, 'sessions'), { recursive: true })
  fs.mkdirSync(path.join(siblingDir, 'sessions'), { recursive: true })

  fs.writeFileSync(path.join(exactDir, 'sessions', 'exact-session.jsonl'), JSON.stringify({
    session_id: 'exact-001', title: 'Exact Excluded', role: 'user', content: 'Excluded by exact match'
  }) + '\n')

  fs.writeFileSync(path.join(siblingDir, 'sessions', 'sibling-session.jsonl'), JSON.stringify({
    session_id: 'sibling-001', title: 'Sibling Kept', role: 'user', content: 'Kept despite similar name'
  }) + '\n')

  // Exclude only the exact directory, not a sibling that starts with the same prefix
  const engine6b = new IndexingEngine(TEST_DB6, {
    redactSecrets: false,
    excludedPaths: [exactDir]
  } as EngineOptions)
  await engine6b.open()

  const sourceId6b = engine6b.addSource(baseDir6, 'Cline')
  await engine6b.indexSource(sourceId6b)
  const sessions6b = engine6b.listSessions()
  const exactSession = sessions6b.find(s => s.session_id && s.session_id.startsWith('exact-001'))
  const siblingSession = sessions6b.find(s => s.session_id && s.session_id.startsWith('sibling-001'))
  assert(exactSession == null, 'Exact-match excluded directory not indexed')
  assert(siblingSession != null, 'Sibling with similar prefix NOT wrongly excluded')

  engine6b.close()
  cleanupDb(TEST_DB6)
  cleanupDir(baseDir6)

  console.log('\n=== Phase 8.3: Custom redaction patterns + token variants ===')

  const TEST_DB7 = makeTempDb()
  const engine7 = new IndexingEngine(TEST_DB7, {
    redactSecrets: true,
    secretPatterns: [
      { name: 'custom-token', pattern: /syn_token_[A-Za-z0-9]{24,}/g, replacement: '[REDACTED_CUSTOM_TOKEN]' },
      { name: 'legacy-key', pattern: /legacy_[A-Za-z0-9_]{16,}/g, replacement: '[REDACTED_LEGACY_KEY]' }
    ],
    excludedPaths: []
  } as EngineOptions)
  await engine7.open()

  const baseDir7 = fs.mkdtempSync(path.join(os.tmpdir(), 'syn-sec-'))
  const clineDir7 = path.join(baseDir7, '.cline', 'sessions')
  fs.mkdirSync(clineDir7, { recursive: true })

  fs.writeFileSync(path.join(clineDir7, 'custom-token.jsonl'), [
    { session_id: 'ct-001', title: 'Custom Token', role: 'user', content: 'Key: syn_token_abcdefghijklmnopqrstuvwx' },
    { session_id: 'ct-001', title: 'Custom Token', role: 'assistant', content: 'Legacy: legacy_mysecretkey123456' },
    { session_id: 'ct-001', title: 'Custom Token', role: 'user', content: 'No secret here' }
  ].map(l => JSON.stringify(l)).join('\n') + '\n')

  const sourceId7 = engine7.addSource(baseDir7, 'Cline')
  await engine7.indexSource(sourceId7)
  const sessions7 = engine7.listSessions()
  const ctSession = sessions7.find(s => s.session_id && s.session_id.startsWith('ct-001'))
  assert(ctSession != null, 'Custom token session indexed')
  if (ctSession) {
    const full7 = engine7.getSession(ctSession.session_id)
    const userMsg = full7!.messages.find(m => m.role === 'user' && m.content.includes('[REDACTED_CUSTOM_TOKEN]'))
    const assistantMsg = full7!.messages.find(m => m.role === 'assistant' && m.content.includes('[REDACTED_LEGACY_KEY]'))
    const normalMsg = full7!.messages.find(m => m.content === 'No secret here')
    assert(!!(userMsg && !userMsg.content.includes('syn_token_')), 'Custom token pattern redacted')
    assert(!!(userMsg && userMsg.content.includes('[REDACTED_CUSTOM_TOKEN]')), 'Custom token replaced with marker')
    assert(!!(assistantMsg && !assistantMsg.content.includes('legacy_')), 'Legacy key pattern redacted')
    assert(!!(assistantMsg && assistantMsg.content.includes('[REDACTED_LEGACY_KEY]')), 'Legacy key replaced with marker')
    assert(normalMsg != null, 'Normal message preserved unchanged')
  }

  engine7.close()
  cleanupDb(TEST_DB7)
  cleanupDir(baseDir7)

  console.log('\n=== Phase G7: Corrupt index DB recovery ===')

  // G7.1: Corrupt DB detected on open — backup preserved, original not deleted
  const TEST_DB8 = makeTempDb()
  const engine8 = new IndexingEngine(TEST_DB8, { redactSecrets: false, excludedPaths: [] } as EngineOptions)
  await engine8.open()
  engine8.close()
  cleanupDb(TEST_DB8)

  // Write garbage to the DB file to simulate corruption
  fs.writeFileSync(TEST_DB8, 'this is not a valid SQLite database')

  const engine8b = new IndexingEngine(TEST_DB8, { redactSecrets: false, excludedPaths: [] } as EngineOptions)
  await engine8b.open()
  assert(engine8b.dbHealth === 'corrupt', 'Corrupt DB detected on open (dbHealth=corrupt)')
  assert(engine8b.db === null, 'DB instance is null when corrupt')
  // Original corrupt file must still exist (never auto-deleted)
  assert(fs.existsSync(TEST_DB8), 'Original corrupt DB file preserved (not deleted)')
  // A .bak backup should exist next to it
  const bakFiles = fs.readdirSync(path.dirname(TEST_DB8)).filter(f => f.startsWith(path.basename(TEST_DB8) + '.corrupt-') && f.endsWith('.bak'))
  assert(bakFiles.length >= 1, 'Timestamped backup of corrupt DB created (' + bakFiles.length + ' found)')
  engine8b.close()
  cleanupDb(TEST_DB8)
  // Also clean up any leftover .bak files
  try {
    fs.readdirSync(path.dirname(TEST_DB8)).forEach(f => {
      if (f.startsWith(path.basename(TEST_DB8) + '.corrupt-') && f.endsWith('.bak')) {
        fs.unlinkSync(path.join(path.dirname(TEST_DB8), f))
      }
    })
  } catch (_) {}

  // G7.2: Rebuild from corrupt DB creates fresh healthy DB
  const TEST_DB9 = makeTempDb()
  const engine9 = new IndexingEngine(TEST_DB9, { redactSecrets: false, excludedPaths: [] } as EngineOptions)
  await engine9.open()
  engine9.close()

  // Corrupt it
  fs.writeFileSync(TEST_DB9, 'corrupted garbage data')

  const engine9b = new IndexingEngine(TEST_DB9, { redactSecrets: false, excludedPaths: [] } as EngineOptions)
  await engine9b.open()
  assert(engine9b.dbHealth === 'corrupt', 'Corrupt DB detected before rebuild')

  // Rebuild
  const rebuildResult = await engine9b.rebuild()
  assert(engine9b.dbHealth === 'healthy', 'DB healthy after rebuild')
  assert(rebuildResult.indexed === 0, 'No sources to index on fresh rebuild (got ' + rebuildResult.indexed + ')')
  engine9b.close()
  cleanupDb(TEST_DB9)

  // G7.3: Rebuild preserves corrupt DB as .bak when preserveCorrupt=true
  const TEST_DB10 = makeTempDb()
  const engine10 = new IndexingEngine(TEST_DB10, { redactSecrets: false, excludedPaths: [] } as EngineOptions)
  await engine10.open()
  engine10.close()

  fs.writeFileSync(TEST_DB10, 'more corruption')

  const engine10b = new IndexingEngine(TEST_DB10, { redactSecrets: false, excludedPaths: [] } as EngineOptions)
  await engine10b.open()
  await engine10b.rebuild(true)
  const bakFiles10 = fs.readdirSync(path.dirname(TEST_DB10)).filter(f => f.startsWith(path.basename(TEST_DB10) + '.rebuild-') && f.endsWith('.bak'))
  assert(bakFiles10.length >= 1, 'Rebuild backup created (' + bakFiles10.length + ' found)')
  // Clean up
  try {
    fs.readdirSync(path.dirname(TEST_DB10)).forEach(f => {
      if (f.startsWith(path.basename(TEST_DB10) + '.rebuild-') && f.endsWith('.bak')) {
        fs.unlinkSync(path.join(path.dirname(TEST_DB10), f))
      }
    })
  } catch (_) {}
  engine10b.close()
  cleanupDb(TEST_DB10)

  console.log(`\n=== Security tests: ${passed} passed, ${failed} failed ===`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((e: unknown) => {
  console.error('Test error:', e)
  process.exit(1)
})

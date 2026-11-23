import path from 'path'
import fs from 'fs'
import { IndexingEngine } from './packages/core/index'

const INDEX_DB_PATH = 'C:\\Users\\luizy\\AppData\\Roaming\\locate\\locate-index.db'

// Ensure directory exists
const dir = path.dirname(INDEX_DB_PATH)
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

const engine = new IndexingEngine(INDEX_DB_PATH)

async function main (): Promise<void> {
  await engine.open()

  // Harness directories to index (both C: and K:)
  const harnessDirs: string[] = [
    'C:\\Users\\luizy\\.cline',
    'C:\\Users\\luizy\\.codex',
    'C:\\Users\\luizy\\.copilot',
    'C:\\Users\\luizy\\.cursor',
    'C:\\Users\\luizy\\.pi',
    'C:\\Users\\luizy\\.t3',
    'C:\\Users\\luizy\\.local\\share\\opencode',
    'C:\\Users\\luizy\\.claude',
    'K:\\Users\\luizy\\.cline',
    'K:\\Users\\luizy\\.codex',
    'K:\\Users\\luizy\\.copilot',
    'K:\\Users\\luizy\\.cursor',
    'K:\\Users\\luizy\\.pi',
    'K:\\Users\\luizy\\.t3',
    'K:\\Users\\luizy\\.claude'
  ]

  // Add sources
  for (const dirPath of harnessDirs) {
    if (fs.existsSync(dirPath)) {
      console.log('Adding source:', dirPath)
      engine.addSource(dirPath)
    } else {
      console.log('Skipping (not found):', dirPath)
    }
  }

  // Index all sources
  console.log('\nIndexing all sources...')
  const results = await engine.indexAllSources({ batchSize: 5 })
  for (const r of results.sources) {
    if ('error' in r) {
      console.log('  ERROR', r.sourcePath, ':', r.error)
    } else {
      console.log('  ', r.sourcePath, '-> indexed:', r.indexed, 'skipped:', r.skipped, 'total_sessions:', r.sessionCount)
    }
  }

  // List all sessions
  console.log('\n=== All indexed sessions ===')
  const sessions = engine.listSessions()
  console.log('Total sessions:', sessions.length)
  for (const s of sessions) {
    console.log('---')
    console.log('  session_id:', s.session_id)
    console.log('  title:', s.title)
    console.log('  harness:', s.harness)
    console.log('  source_path:', s.source_path)
    console.log('  file_path:', s.file_path)
    console.log('  content_len:', (s.content || '').length)
    const contentPreview = (s.content || '').replace(/\n/g, ' ').substring(0, 120)
    console.log('  content_preview:', contentPreview)
  }

  engine.close()
  console.log('\nDone.')
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})

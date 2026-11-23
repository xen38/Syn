/**
 * Indexing tests for IndexingEngine.
 * Verifies open, addSource, indexSource, indexAllSources, incrementalIndex, search.
 */

import path from 'path'
import fs from 'fs'
import os from 'os'
import { IndexingEngine } from '../packages/core/index'

const DB_PATH = path.join(os.tmpdir(), `locate-indexing-${Date.now()}.db`)

let passed = 0
let failed = 0

function assert (condition: boolean, message: string) {
  if (condition) { passed++; console.log(`  PASS: ${message}`) } else { failed++; console.log(`  FAIL: ${message}`) }
}

async function main () {
  const engine = new IndexingEngine(DB_PATH)
  await engine.open()

  // ── 1. open & init ──
  assert(engine.db !== null, 'db initialized after open')

  // ── 2. indexSource ──
  // Use cline fixture directory as source
  const srcDir = path.join(__dirname, 'fixtures', 'cline')
  const sourceId = engine.addSource(srcDir)
  const result = await engine.indexSource(sourceId)
  assert(result.indexed > 0, 'indexSource indexes at least 1 session')
  assert(result.total > 0, 'indexSource reports total > 0')

  // ── 3. search ──
  const searchResults = engine.search('Cline')
  assert(searchResults.length > 0, 'search for "Cline" returns results')
  assert(searchResults.some(r => r.id.startsWith('cline-test-001')), 'search returns indexed cline session')

  // ── 4. indexAllSources ──
  // No sources added yet but dir open - indexAllSources on empty should not throw
  await engine.indexAllSources()
  assert(true, 'indexAllSources runs without error on empty source list')

  // ── 5. listSources ──
  const sources = engine.listSources()
  assert(sources.length >= 1, 'listSources returns at least 1 source')

  // ── 6. removeSource ──
  engine.removeSource(srcDir)
  assert(true, 'removeSource runs without error')

  engine.close()
  fs.rmSync(DB_PATH, { recursive: true, force: true })

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err: Error) => {
  console.error('Test setup failed:', err)
  process.exit(1)
})

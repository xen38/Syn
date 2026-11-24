import { cp } from 'fs/promises'
import { join } from 'path'

const root = join(process.cwd(), 'dist')

await cp('renderer', join(root, 'renderer'), { recursive: true })
await cp('assets', join(root, 'assets'), { recursive: true })
// sql.js needs its wasm file available at dist/node_modules/sql.js/dist/sql-wasm.wasm
await cp('node_modules/sql.js/dist/sql-wasm.wasm', join(root, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm'))

console.log('Assets copied to dist/')

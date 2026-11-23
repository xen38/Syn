import Database from 'better-sqlite3'

const db = new Database(process.env.APPDATA! + '\\locate\\locate-index.db')
const cols = db.prepare('PRAGMA table_info(sessions)').all() as Array<{ name: string }>
console.log('Session columns:', JSON.stringify(cols.map(c => c.name)))
const rows = db.prepare('SELECT session_id, title, harness FROM sessions WHERE harness = ?').all('Codex') as Array<{ session_id: string; title: string; harness: string }>
console.log('Codex sessions:', JSON.stringify(rows, null, 2))
db.close()

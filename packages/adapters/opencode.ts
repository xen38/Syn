/**
 * OpenCode archive adapter.
 *
 * Handles OpenCode (anomalyco/opencode) sessions stored in a single
 * SQLite database at ~/.local/share/opencode/opencode.db.
 *
 * Schema:
 *   session(id, project_id, directory, title, time_created, time_updated, ...)
 *   message(id, session_id, time_created, data JSON)  -- data has role, etc.
 *   part(id, message_id, session_id, data JSON)       -- data has type, text/tool/reasoning
 *
 * Each session row becomes one session. Messages are read from the message
 * table, with content parts joined from the part table.
 */

import path from 'path'
import fs from 'fs'
import Database from 'better-sqlite3'
import { BaseAdapter, SessionData, Message } from './base'

const OPENARCHIVE_DB_PATHS: string[] = [
  // Primary OpenCode location
  process.env.LOCATE_OPENERCODE_DB ||
    (process.platform === 'win32'
      ? process.env.LOCALAPPDATA
        ? path.join(process.env.LOCALAPPDATA, '..', 'Local', 'share', 'opencode', 'opencode.db')
        : path.join(process.env.USERPROFILE || '', '.local', 'share', 'opencode', 'opencode.db')
      : path.join(process.env.HOME || '', '.local', 'share', 'opencode', 'opencode.db')),
  path.join(process.env.HOME || '', '.opencode', 'opencode.db'),
  path.join(process.env.HOME || '', '.local', 'share', 'opencode', 'opencode.db')
]

function findOpencodeDb (): string | null {
  for (const p of OPENARCHIVE_DB_PATHS) {
    if (p && fs.existsSync(p)) return p
  }
  return null
}

class OpencodeAdapter extends BaseAdapter {
  constructor (options: Record<string, unknown> = {}) {
    super({
      name: (options.name as string | undefined) ?? 'OpenCode',
      harness: (options.harness as string | undefined) ?? 'OpenCode',
      extensions: ['.db'],
      ...options
    })
  }

  canHandle (filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    const base = path.basename(filePath).toLowerCase()
    return ext === '.db' && base === 'opencode.db'
  }

  /**
   * Discover the OpenCode database file.
   */
  discover (_dirPath: string): { filePath: string; ext: string }[] {
    const results: { filePath: string; ext: string }[] = []
    const dbPath = findOpencodeDb()
    if (dbPath && this.canHandle(dbPath)) {
      results.push({ filePath: dbPath, ext: '.db' })
    }
    return results
  }

  parseSession (_filePath: string): SessionData | null {
    // Multi-session database; use parseAllSessions instead
    return null
  }

  /**
   * Parse all sessions from the OpenCode database.
   */
  parseAllSessions (filePath: string): Promise<SessionData[]> {
    const sessions: SessionData[] = []
    let db: Database.Database | null = null
    try {
      db = Database(filePath, { readonly: true })
      if (!db) return Promise.resolve(sessions)

      // Load all sessions
      const sessionRows = db
        .prepare('SELECT * FROM session ORDER BY time_created')
        .all() as Record<string, unknown>[]

      // Load all messages indexed by session_id
      const messageRows = db
        .prepare('SELECT * FROM message ORDER BY session_id, time_created')
        .all() as Record<string, unknown>[]
      const messagesBySession = new Map<string, Record<string, unknown>[]>()
      for (const m of messageRows) {
        const sid = m.session_id as string | undefined
        if (!sid) continue
        if (!messagesBySession.has(sid)) messagesBySession.set(sid, [])
        messagesBySession.get(sid)!.push(m)
      }

      // Load all parts indexed by message_id
      const partRows = db
        .prepare('SELECT * FROM part ORDER BY message_id, time_created')
        .all() as Record<string, unknown>[]
      const partsByMessage = new Map<number, Record<string, unknown>[]>()
      for (const p of partRows) {
        const mid = p.message_id as number | undefined
        if (mid === undefined) continue
        if (!partsByMessage.has(mid)) partsByMessage.set(mid, [])
        partsByMessage.get(mid)!.push(p)
      }

      for (const s of sessionRows) {
        const sessionId = s.id as string
        const title = (s.title as string | undefined) || sessionId
        const createdAt = s.time_created as string | undefined
          ? new Date(s.time_created as string).toISOString()
          : ''

        const messages: Message[] = []
        const msgList = messagesBySession.get(sessionId) || []
        for (const m of msgList) {
          let data: Record<string, unknown> = {}
          try {
            data = JSON.parse((m.data as string | undefined) || '{}')
          } catch (e) {
            data = {}
          }

          const role = (data.role as string | undefined) || 'unknown'
          const timestamp = data.time && typeof data.time === 'object' && (data.time as Record<string, unknown>).created
            ? new Date((data.time as Record<string, unknown>).created as string).toISOString()
            : (m.time_created as string | undefined)
              ? new Date(m.time_created as string).toISOString()
              : ''

          // Build content from parts
          const parts = partsByMessage.get(m.id as number) || []
          const partTexts: string[] = []
          for (const p of parts) {
            let pd: Record<string, unknown> = {}
            try {
              pd = JSON.parse((p.data as string | undefined) || '{}')
            } catch (e) {
              pd = {}
            }
            const pdType = pd.type as string | undefined
            const pdText = pd.text as string | undefined
            if (pdType === 'text' && pdText) {
              partTexts.push(pdText)
            } else if (pdType === 'reasoning' && pdText) {
              partTexts.push('[reasoning] ' + pdText)
            } else if (pdType === 'tool') {
              partTexts.push('[tool] ' + ((pd.text as string | undefined) || (pd.tool as string | undefined) || ''))
            } else if (pdType === 'step-start') {
              partTexts.push('[step-start]')
            } else if (pdType === 'step-finish') {
              partTexts.push('[step-finish]')
            } else if (pdText) {
              partTexts.push(pdText)
            }
          }

          let content = ''
          if (partTexts.length > 0) {
            content = partTexts.join('\n')
          } else if (data.content) {
            content = typeof data.content === 'string'
              ? data.content
              : JSON.stringify(data.content)
          } else if (data.summary) {
            content = data.summary as string
          } else if (data.text) {
            content = data.text as string
          }

          messages.push({
            session_id: sessionId,
            message_index: messages.length,
            role,
            timestamp,
            content,
            tool_calls: null
          })
        }

        if (messages.length === 0) continue

        sessions.push({
          sessionId,
          title,
          createdAt,
          messages,
          filePath,
          harness: this.harness
        })
      }
    } catch (e) {
      // Skip unreadable databases
    } finally {
      if (db) db.close()
    }
    return Promise.resolve(sessions)
  }

  async extractText (filePath: string): Promise<string> {
    const sessions = await this.parseAllSessions(filePath)
    return sessions
      .map(s => s.messages.map(m => m.content).join('\n'))
      .join('\n')
  }
}

export { OpencodeAdapter, findOpencodeDb }

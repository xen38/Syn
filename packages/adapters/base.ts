/**
 * Base harness adapter.
 *
 * Each harness adapter implements a common interface for discovering,
 * parsing, and extracting content from session archive files.
 *
 * All file access is read-only. Original archives are never modified.
 */

import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

export interface Message {
  session_id: string
  message_index: number
  role: string
  timestamp: string
  content: string
  tool_calls: unknown
}

export interface SessionData {
  sessionId: string
  title: string
  createdAt: string
  messages: Message[]
  filePath: string
  harness: string
  _meta?: Record<string, unknown>
}

class BaseAdapter {
  name: string
  harness: string
  extensions: string[]

  constructor (options: Record<string, unknown> = {}) {
    this.name = (options.name as string | undefined) ?? 'Unknown'
    this.harness = (options.harness as string | undefined) ?? 'Unknown'
    this.extensions = (options.extensions as string[] | undefined) ?? []
  }

  // ── Discovery ─────────────────────────────────────────────────────────

  /**
   * Check if this adapter can handle a given file path.
   * Returns true if the file extension matches.
   */
  canHandle (filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    return this.extensions.includes(ext)
  }

  /**
   * Discover session files in a directory.
   * Returns an array of { filePath, ext } objects.
   */
  discover (dirPath: string): { filePath: string; ext: string }[] {
    const results: { filePath: string; ext: string }[] = []
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        if (entry.isDirectory()) {
          results.push(...this.discover(fullPath))
        } else if (entry.isFile() && this.canHandle(fullPath)) {
          results.push({ filePath: fullPath, ext: path.extname(entry.name).toLowerCase() })
        }
      }
    } catch (e) {
      // Skip inaccessible directories
    }
    return results
  }

  // ── Parsing ───────────────────────────────────────────────────────────

  /**
   * Parse a session file into structured data.
   * Returns { sessionId, title, createdAt, messages: [] } or null.
   */
  parseSession (_filePath: string): SessionData | null {
    throw new Error('parseSession not implemented')
  }

  /**
   * Parse all sessions from a file (e.g. SQLite databases with multiple sessions).
   * Default implementation returns empty array; override in adapters that support it.
   */
  parseAllSessions (_filePath: string): Promise<SessionData[]> {
    return Promise.resolve([])
  }

  /**
   * Extract full text content from a file for indexing.
   */
  async extractText (_filePath: string): Promise<string> {
    throw new Error('extractText not implemented')
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  _readFile (filePath: string): string {
    return fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '')
  }

  _fingerprint (filePath: string): { mtime: number; size: number; hash: string } {
    try {
      const stat = fs.statSync(filePath)
      const hash = crypto.createHash('sha256')
        .update(filePath + '|' + stat.size + '|' + stat.mtimeMs)
        .digest('hex')
      return { mtime: stat.mtimeMs, size: stat.size, hash }
    } catch (e) {
      return { mtime: 0, size: 0, hash: '' }
    }
  }
}

export { BaseAdapter }

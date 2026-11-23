/**
 * Text/Markdown archive adapter.
 *
 * Handles harnesses that store sessions as plain text or Markdown files:
 *   - Cursor (.cursor/agents/*.md)
 *   - Cline (.cline/sessions/*.md, *.txt)
 *
 * Paragraphs separated by blank lines are treated as individual messages.
 */

import path from 'path'
import { BaseAdapter, SessionData, Message } from './base'

class TextAdapter extends BaseAdapter {
  constructor (options: Record<string, unknown> = {}) {
    super({
      name: (options.name as string | undefined) ?? 'Text',
      harness: (options.harness as string | undefined) ?? 'Unknown',
      extensions: ['.md', '.txt'],
      ...options
    })
  }

  canHandle (filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase()
    return ext === '.md' || ext === '.txt'
  }

  parseSession (filePath: string): SessionData | null {
    const content = this._readFile(filePath)
    const sessionId = path.basename(filePath, path.extname(filePath))
    const firstLine = content.split('\n')[0]
    const title = firstLine ? firstLine.substring(0, 200) : sessionId
    const createdAt = ''

    // Split into paragraphs as messages
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim())
    const messages: Message[] = paragraphs.map((p, i) => ({
      session_id: sessionId,
      message_index: i,
      role: 'unknown',
      timestamp: '',
      content: p.trim(),
      tool_calls: null
    }))

    return {
      sessionId,
      title,
      createdAt,
      messages,
      filePath,
      harness: this.harness
    }
  }

  async extractText (filePath: string): Promise<string> {
    return this._readFile(filePath)
  }
}

export { TextAdapter }

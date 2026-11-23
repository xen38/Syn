/**
 * JSON archive adapter.
 *
 * Handles harnesses that store sessions as JSON files:
 *   - Cline (.cline/sessions/*.json)
 *
 * A JSON file may contain a single session object or an array of messages.
 */

import path from 'path'
import { BaseAdapter, SessionData, Message } from './base'
import { JsonlAdapter } from './jsonl'

type JsonObj = Record<string, unknown>

function getStr (obj: JsonObj, key: string): string {
  const val = obj[key]
  return typeof val === 'string' ? val : ''
}

class JsonAdapter extends BaseAdapter {
  constructor (options: Record<string, unknown> = {}) {
    super({
      name: (options.name as string | undefined) ?? 'JSON',
      harness: (options.harness as string | undefined) ?? 'Unknown',
      extensions: ['.json'],
      ...options
    })
  }

  canHandle (filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.json'
  }

  parseSession (filePath: string): SessionData | null {
    const content = this._readFile(filePath)
    let obj: Record<string, unknown>
    try {
      obj = JSON.parse(content) as Record<string, unknown>
    } catch (e) {
      // Fall back to treating as JSONL
      return new JsonlAdapter({ harness: this.harness }).parseSession(filePath)
    }

    const sessionId = getStr(obj, 'session_id') || getStr(obj, 'id') || path.basename(filePath, '.json')
    const title = getStr(obj, 'title') || getStr(obj, 'label') || sessionId
    const createdAt = getStr(obj, 'timestamp') || getStr(obj, 'created_at') || ''
    const messages: Message[] = []

    if (Array.isArray(obj.messages)) {
      ;(obj.messages as unknown[]).forEach((m, i) => {
        const msg = m as Record<string, unknown>
        messages.push({
          session_id: sessionId,
          message_index: i,
          role: (msg.role as string | undefined) || 'unknown',
          timestamp: (msg.timestamp as string | undefined) || '',
          content: ((msg.content as string | undefined) || (msg.text as string | undefined) || (msg.message as string | undefined) || ''),
          tool_calls: (msg.tool_calls as unknown) || null
        })
      })
    } else {
      // Single message object or session metadata (e.g. Cline)
      const contentVal = (obj.prompt as string | undefined) || (obj.content as string | undefined) || (obj.text as string | undefined) || (obj.message as string | undefined) || ''
      messages.push({
        session_id: sessionId,
        message_index: 0,
        role: (obj.role as string | undefined) || 'user',
        timestamp: (obj.timestamp as string | undefined) || (obj.created_at as string | undefined) || '',
        content: typeof contentVal === 'string' ? contentVal : '',
        tool_calls: (obj.tool_calls as unknown) || null
      })
    }

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
    const parsed = this.parseSession(filePath)
    if (!parsed) return ''
    return parsed.messages.map(m => m.content).join('\n')
  }
}

export { JsonAdapter }

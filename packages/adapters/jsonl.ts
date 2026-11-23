/**
 * JSONL archive adapter.
 *
 * Handles harnesses that store sessions as JSON Lines files:
 *   - Pi (.pi/agent/sessions/*.jsonl)
 *   - Cline (.cline/sessions/*.jsonl)
 *
 * Each line is a JSON object representing a message.
 */

import path from 'path'
import { BaseAdapter, SessionData, Message } from './base'

type JsonObj = Record<string, unknown>

function getStr (obj: JsonObj, key: string): string {
  const val = obj[key]
  return typeof val === 'string' ? val : ''
}

class JsonlAdapter extends BaseAdapter {
  constructor (options: Record<string, unknown> = {}) {
    super({
      name: (options.name as string | undefined) ?? 'JSONL',
      harness: (options.harness as string | undefined) ?? 'Unknown',
      extensions: ['.jsonl', '.ndjson'],
      ...options
    })
  }

  canHandle (filePath: string): boolean {
    return path.extname(filePath).toLowerCase() === '.jsonl'
  }

  parseSession (filePath: string): SessionData | null {
    const content = this._readFile(filePath).trim()
    const messages: Message[] = []
    let sessionId = path.basename(filePath, '.jsonl')
    let title = sessionId
    let createdAt = ''

    // Helper to extract text content from a message object
    const extractContent = (obj: JsonObj): string => {
      let c: unknown = obj.content || obj.text || obj.message || ''
      if (typeof c === 'object' && c !== null) {
        if (Array.isArray(c)) {
          c = c.map(x => (typeof x === 'string' ? x : (x as JsonObj).text || '')).filter(Boolean).join('\n')
        } else if (typeof (c as JsonObj).text === 'string') {
          c = (c as JsonObj).text
        } else if (typeof (c as JsonObj).content === 'string') {
          c = (c as JsonObj).content
        } else if (Array.isArray((c as JsonObj).content)) {
          c = ((c as JsonObj).content as unknown[]).map(x => (typeof x === 'string' ? x : (x as JsonObj).text || '')).filter(Boolean).join('\n')
        } else {
          c = ''
        }
      }
      return typeof c === 'string' ? c : ''
    }

    // Try parsing the whole file as JSON (handles single JSON object or array)
    try {
      const obj = JSON.parse(content)
      const arr = Array.isArray(obj) ? obj : [obj]
      let index = 0
      for (const item of arr) {
        if (typeof item !== 'object' || item === null) continue
        const itemObj = item as JsonObj
        if (itemObj.session_id) sessionId = getStr(itemObj, 'session_id')
        if (itemObj.title && !title) title = getStr(itemObj, 'title')
        if (itemObj.timestamp && !createdAt) createdAt = getStr(itemObj, 'timestamp')
        messages.push({
          session_id: sessionId,
          message_index: index++,
          role: getStr(itemObj, 'role') || 'unknown',
          timestamp: getStr(itemObj, 'timestamp'),
          content: extractContent(itemObj),
          tool_calls: (itemObj.tool_calls as unknown) || (itemObj.tools as unknown) || null
        })
      }
      if (!createdAt && messages.length > 0) createdAt = messages[0].timestamp || ''
      return { sessionId, title, createdAt, messages, filePath, harness: this.harness }
    } catch (e) {
      // Fall back to multi-line JSON chunks separated by blank lines
      // (e.g. Pi harness stores pretty-printed JSON objects separated by blank lines)
    }

    // Multi-line JSON chunks: split concatenated JSON objects by tracking brace depth,
    // accounting for strings and escape sequences.
    const chunks = splitConcatJson(content)
    let chunkIndex = 0
    let chunkMessages = 0
    for (const chunk of chunks) {
      try {
        const obj = JSON.parse(chunk)
        if (typeof obj !== 'object' || obj === null) continue
        const obj2 = obj as JsonObj
        if (obj2.session_id) sessionId = getStr(obj2, 'session_id')
        if (obj2.title && !title) title = getStr(obj2, 'title')
        if (obj2.timestamp && !createdAt) createdAt = getStr(obj2, 'timestamp')
        messages.push({
          session_id: sessionId,
          message_index: chunkIndex++,
          role: getStr(obj2, 'role') || 'unknown',
          timestamp: getStr(obj2, 'timestamp'),
          content: extractContent(obj2),
          tool_calls: (obj2.tool_calls as unknown) || (obj2.tools as unknown) || null
        })
        chunkMessages++
      } catch (e) {
        // Skip unparseable chunks
      }
    }
    if (chunkMessages > 0) {
      if (!createdAt && messages.length > 0) createdAt = messages[0].timestamp || ''
      return { sessionId, title, createdAt, messages, filePath, harness: this.harness }
    }

    // Line-by-line JSONL (each line is a complete JSON object)
    const lines = content.split('\n').filter(l => l.trim())
    let index = 0
    for (const line of lines) {
      try {
        const obj = JSON.parse(line)
        if (typeof obj !== 'object' || obj === null) continue
        const obj3 = obj as JsonObj
        if (obj3.session_id) sessionId = getStr(obj3, 'session_id')
        if (obj3.title && !title) title = getStr(obj3, 'title')
        if (obj3.timestamp && !createdAt) createdAt = getStr(obj3, 'timestamp')
        messages.push({
          session_id: sessionId,
          message_index: index++,
          role: getStr(obj3, 'role') || 'unknown',
          timestamp: getStr(obj3, 'timestamp'),
          content: extractContent(obj3),
          tool_calls: (obj3.tool_calls as unknown) || (obj3.tools as unknown) || null
        })
      } catch (e) {
        // Skip unparseable lines
      }
    }

    if (!createdAt && messages.length > 0) createdAt = messages[0].timestamp || ''
    return { sessionId, title, createdAt, messages, filePath, harness: this.harness }
  }

  async parseAllSessions (filePath: string): Promise<import('./base').SessionData[]> {
    const parsed = this.parseSession(filePath)
    return parsed ? [parsed] : []
  }

  async extractText (filePath: string): Promise<string> {
    const parsed = this.parseSession(filePath)
    if (!parsed) return ''
    return parsed.messages.map(m => m.content).join('\n')
  }
}

// Split concatenated JSON objects (e.g. }\n{) by tracking brace depth,
// accounting for strings and escape sequences.
function splitConcatJson (content: string): string[] {
  const chunks: string[] = []
  let depth = 0
  let inString = false
  let escape = false
  let start = 0
  for (let i = 0; i < content.length; i++) {
    const ch = content[i]
    if (inString) {
      if (escape) { escape = false; continue }
      if (ch === '\\') { escape = true; continue }
      if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === '{') { if (depth === 0) start = i; depth++ } else if (ch === '}') { depth--; if (depth === 0) chunks.push(content.slice(start, i + 1)) }
  }
  return chunks.filter(c => c.trim())
}

export { JsonlAdapter }

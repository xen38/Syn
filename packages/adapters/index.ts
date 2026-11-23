/**
 * Locate Harness Adapters
 *
 * Modular adapter system for parsing session archives from different
 * AI coding harnesses. Each adapter implements a common interface for
 * discovery, parsing, and text extraction.
 */

import { BaseAdapter } from './base'
import { SQLiteAdapter } from './sqlite'
import { JsonlAdapter } from './jsonl'
import { JsonAdapter } from './json'
import { TextAdapter } from './text'
import { AdapterRegistry, detectHarness, getSessionValidator } from './registry'

export {
  BaseAdapter,
  SQLiteAdapter,
  JsonlAdapter,
  JsonAdapter,
  TextAdapter,
  AdapterRegistry,
  detectHarness,
  getSessionValidator
}

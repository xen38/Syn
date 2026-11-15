/**
 * SQLite compatibility wrapper for sql.js.
 *
 * Wraps a sql.js Database object to provide a better-sqlite3-compatible API:
 *   - db.prepare(sql) returns a statement with .all(params), .get(params), .run(params)
 *   - .all() returns array of row objects
 *   - .get() returns a single row object or undefined
 *   - .run() returns { changes, lastInsertRowid }
 *
 * @typedef {Object} PreparedStatement
 * @property {(...args: any[]) => any[]} all - Execute query, return all rows
 * @property {(...args: any[]) => Object|undefined} get - Execute query, return first row
 * @property {(...args: any[]) => {changes:number,lastInsertRowid:number}} run - Execute statement, return info
 *
 * @typedef {Object} SqlJsDatabase
 * @property {(sql:string) => PreparedStatement} prepare - Prepare a SQL statement
 * @property {(sql:string) => void} exec - Execute one or more SQL statements
 * @property {(fn:Function) => Function} transaction - Wrap fn in BEGIN/COMMIT
 * @property {() => Buffer} export - Export database to buffer
 */

/**
 * Wraps a sql.js Database object to provide a better-sqlite3-compatible API.
 * @param {SqlJsDatabase} db - sql.js Database instance to wrap
 * @returns {SqlJsDatabase} The wrapped database (mutated in place)
 */
function wrapDb (db) {
  const origPrepare = db.prepare.bind(db)
  db.prepare = function (sql) {
    const stmt = origPrepare(sql)
    const bindParams = (args) => {
      if (args.length === 0) return
      if (Array.isArray(args[0])) {
        stmt.bind(args[0])
      } else if (typeof args[0] === 'object' && args[0] !== null) {
        stmt.bind(args[0]) // named parameters
      } else {
        stmt.bind(args) // positional parameters
      }
    }
    return {
      all (...args) {
        const rows = []
        bindParams(args)
        while (stmt.step()) {
          const rowArr = stmt.get()
          const row = {}
          stmt.getColumnNames().forEach((col, i) => {
            row[col] = rowArr[i]
          })
          rows.push(row)
        }
        stmt.reset()
        return rows
      },
      get (...args) {
        bindParams(args)
        let row
        if (stmt.step()) {
          const rowArr = stmt.get()
          row = {}
          stmt.getColumnNames().forEach((col, i) => {
            row[col] = rowArr[i]
          })
        }
        stmt.reset()
        return row
      },
      run (...args) {
        bindParams(args)
        stmt.step()
        const info = {
          changes: stmt.changes || 0,
          lastInsertRowid: stmt.lastInsertRowid || 0
        }
        stmt.reset()
        return info
      }
    }
  }

  // sql.js doesn't have db.transaction(); implement with BEGIN/COMMIT
  db.transaction = function (fn) {
    return function () {
      db.exec('BEGIN')
      try {
        const result = fn()
        db.exec('COMMIT')
        return result
      } catch (e) {
        db.exec('ROLLBACK')
        throw e
      }
    }
  }

  return db
}

module.exports = { wrapDb }

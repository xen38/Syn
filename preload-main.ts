// This script runs before main.js and patches require('electron') to return built-in modules

/* eslint-disable @typescript-eslint/no-explicit-any */
import { Module } from 'module'
import path from 'path'

const originalLoad = Module._load

// Track if we've already patched
let patched = false

Module._load = function (this: any, request: string, parent: any, isMain: boolean, ..._rest: any[]) {
  if (request === 'electron' && process.versions && process.versions.electron && !patched) {
    patched = true
    try {
      // Save the original paths
      const originalPaths = Module.globalPaths.slice()

      // Remove the node_modules/electron path from global paths
      Module.globalPaths = Module.globalPaths.filter(p => !p.includes('node_modules' + path.sep + 'electron'))

      // Also modify the parent's paths if it exists
      if (parent && parent.paths) {
        parent.paths = parent.paths.filter(p => !p.includes('node_modules' + path.sep + 'electron'))
      }

      // Now try to load 'electron' - it should hit the built-in
      const result = Module._load('electron', parent, isMain)

      // Restore paths
      Module.globalPaths = originalPaths

      patched = false
      return result
    } catch (e) {
      console.error('Preload patch failed:', e.message)
      patched = false
    }
  }
  return originalLoad.apply(this, [request, parent, isMain])
}

console.log('[preload-main] Electron module patch installed')

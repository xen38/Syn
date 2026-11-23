// Wrapper that removes the npm electron package from module paths before loading main.ts

import { Module } from 'module'
import path from 'path'

// Remove any node_modules/electron paths from global paths
Module.globalPaths = Module.globalPaths.filter(p => !p.includes(path.sep + 'electron' + path.sep))

// Also patch _resolveFilename to intercept 'electron' requests
const originalResolve = Module._resolveFilename
Module._resolveFilename = function (this: NodeModule, request: string, _parent: NodeModule | undefined, _isMain: boolean, // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _options?: any) {
  if (request === 'electron' && process.versions && process.versions.electron) {
    // Return a special internal module identifier
    return 'electron-internal'
  }
  // eslint-disable-next-line prefer-rest-params
  return originalResolve.apply(this, arguments)
}

const originalLoad = Module._load
Module._load = function (this: NodeModule, request: string, _parent: NodeModule | undefined, _isMain: boolean) {
  if (request === 'electron-internal' && process.versions && process.versions.electron) {
    // Try to load the built-in electron modules
    // They should be available through the internal module system
    // Try to access them through the internal module cache
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalElectron = (Module as any)._cache.electron
      if (internalElectron && internalElectron.exports && typeof internalElectron.exports === 'object' && internalElectron.exports.app) {
        return internalElectron.exports
      }
    } catch (e) {}

    // Try to find any cached electron module
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cache = (Module as any)._cache
      for (const key of Object.keys(cache)) {
        const entry = cache[key]
        if (key.includes('electron') && entry && entry.exports && typeof entry.exports === 'object' && entry.exports.app) {
          return entry.exports
        }
      }
    } catch (e) {}

    // Try loading through the native module system
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const NativeModule = require('internal/bootstrap/loaders')
      if (NativeModule && NativeModule.nonInternalExists('electron')) {
        return NativeModule.require('electron')
      }
    } catch (e) {}

    // If all else fails, throw an error that will be caught by the fallback
    throw new Error('Built-in electron modules not accessible')
  }
  // eslint-disable-next-line prefer-rest-params
  return originalLoad.apply(this, arguments)
}

console.log('[wrapper] Module resolution patched')

// Load main.ts
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('./main.ts')
} catch (e) {
  if (e instanceof Error && e.message.includes('Built-in electron modules not accessible')) {
    console.error('[wrapper] Falling back to npm package (will not work properly)')
    // Restore original behavior
    Module._load = originalLoad
    Module._resolveFilename = originalResolve
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('./main.ts')
  } else {
    throw e
  }
}

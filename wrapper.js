// Wrapper that removes the npm electron package from module paths before loading main.js

const Module = require('module')
const path = require('path')

// Remove any node_modules/electron paths from global paths
Module.globalPaths = Module.globalPaths.filter(p => !p.includes(path.sep + 'electron' + path.sep))

// Also patch _resolveFilename to intercept 'electron' requests
const originalResolve = Module._resolveFilename
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === 'electron' && process.versions && process.versions.electron) {
    // Return a special internal module identifier
    return 'electron-internal'
  }
  return originalResolve.apply(this, arguments)
}

const originalLoad = Module._load
Module._load = function (request, parent, isMain) {
  if (request === 'electron-internal' && process.versions && process.versions.electron) {
    // Try to load the built-in electron modules
    // They should be available through the internal module system
    // Try to access them through the internal module cache
    try {
      const internalElectron = Module._cache.electron
      if (internalElectron && internalElectron.exports && typeof internalElectron.exports === 'object' && internalElectron.exports.app) {
        return internalElectron.exports
      }
    } catch (e) {}

    // Try to find any cached electron module
    for (const key of Object.keys(Module._cache)) {
      if (key.includes('electron') && Module._cache[key].exports && typeof Module._cache[key].exports === 'object' && Module._cache[key].exports.app) {
        return Module._cache[key].exports
      }
    }

    // Try loading through the native module system
    try {
      const NativeModule = require('internal/bootstrap/loaders')
      if (NativeModule && NativeModule.nonInternalExists('electron')) {
        return NativeModule.require('electron')
      }
    } catch (e) {}

    // If all else fails, throw an error that will be caught by the fallback
    throw new Error('Built-in electron modules not accessible')
  }
  return originalLoad.apply(this, arguments)
}

console.log('[wrapper] Module resolution patched')

// Load main.js
try {
  require('./main.js')
} catch (e) {
  if (e.message.includes('Built-in electron modules not accessible')) {
    console.error('[wrapper] Falling back to npm package (will not work properly)')
    // Restore original behavior
    Module._load = originalLoad
    Module._resolveFilename = originalResolve
    require('./main.js')
  } else {
    throw e
  }
}

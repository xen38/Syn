// Bootstrap script that patches require('electron') BEFORE any other code runs

import { Module } from 'module'
const originalLoad = Module._load

Module._load = function (this: NodeModule, request: string, _parent: NodeModule | undefined, _isMain: boolean) {
  if (request === 'electron' && process.versions && process.versions.electron) {
    // We're inside Electron and someone is requiring 'electron'
    // The built-in modules should be available - let's try to access them
    try {
      // The built-in electron modules are exposed through process._linkedBinding
      // or through the internal module system
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const common = (process as any)._linkedBinding('electron_common')
      if (common && common.electron) {
        return common.electron
      }
    } catch (e) {}

    try {
      // Try the internal binding
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const binding = (process as any)._linkedBinding('electron')
      if (binding) {
        return binding
      }
    } catch (e) {}

    // If all else fails, let it fall through to the npm package
    // but we need to prevent infinite recursion
  }
  // eslint-disable-next-line prefer-rest-params
  return originalLoad.apply(this, arguments)
}

console.log('[bootstrap] Electron module load patch installed')

// Now load the actual main
require('./main.ts')

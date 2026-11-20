// This script runs before main.js and patches require('electron') to return built-in modules

const Module = require('module');
const originalResolve = Module._resolveFilename;
const originalLoad = Module._load;
const path = require('path');

// Track if we've already patched
let patched = false;

Module._load = function(request, parent, isMain) {
  if (request === 'electron' && process.versions && process.versions.electron && !patched) {
    patched = true;
    try {
      // The built-in electron modules should be available through the internal module system
      // Try to access them by using the internal require that bypasses the npm package
      // We can do this by temporarily removing the npm package from the resolution paths
      
      // Save the original paths
      const originalPaths = Module.globalPaths.slice();
      
      // Remove the node_modules/electron path from global paths
      Module.globalPaths = Module.globalPaths.filter(p => !p.includes('node_modules' + path.sep + 'electron'));
      
      // Also modify the parent's paths if it exists
      if (parent && parent.paths) {
        parent.paths = parent.paths.filter(p => !p.includes('node_modules' + path.sep + 'electron'));
      }
      
      // Now try to load 'electron' - it should hit the built-in
      const result = Module._load('electron', parent, isMain);
      
      // Restore paths
      Module.globalPaths = originalPaths;
      
      patched = false;
      return result;
    } catch (e) {
      console.error('Preload patch failed:', e.message);
      patched = false;
    }
  }
  return originalLoad.apply(this, arguments);
};

console.log('[preload-main] Electron module patch installed');

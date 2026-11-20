// Bootstrap script that patches require('electron') BEFORE any other code runs

const Module = require('module');
const originalLoad = Module._load;

Module._load = function(request, parent, isMain) {
  if (request === 'electron' && process.versions && process.versions.electron) {
    // We're inside Electron and someone is requiring 'electron'
    // The built-in modules should be available - let's try to access them
    try {
      // The built-in electron modules are exposed through process._linkedBinding
      // or through the internal module system
      const common = process._linkedBinding('electron_common');
      if (common && common.electron) {
        return common.electron;
      }
    } catch(e) {}
    
    try {
      // Try the internal binding
      const binding = process._linkedBinding('electron');
      if (binding) {
        return binding;
      }
    } catch(e) {}
    
    // If all else fails, let it fall through to the npm package
    // but we need to prevent infinite recursion
  }
  return originalLoad.apply(this, arguments);
};

console.log('[bootstrap] Electron module load patch installed');

// Now load the actual main
require('./main.js');

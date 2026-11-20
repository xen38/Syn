// This shim sets up require('electron') to return built-in modules
// when running inside Electron, then loads the actual main.js

const Module = require('module');
const originalResolve = Module._resolveFilename;

Module._resolveFilename = function(request, parent, isMain, options) {
  if (request === 'electron' && process.versions && process.versions.electron) {
    // Return a special marker that tells Module._load to use the built-in
    return 'electron';
  }
  return originalResolve.apply(this, arguments);
};

const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === 'electron' && process.versions && process.versions.electron) {
    // Load the built-in electron module
    // The built-in module is available as a native module
    try {
      // Try to get it from the native module system
      const NativeModule = require('native_module');
      if (NativeModule && NativeModule.nonInternalExists('electron')) {
        return NativeModule.require('electron');
      }
    } catch(e) {}
    // If that fails, try the regular load which should now hit the built-in
    return originalLoad.call(this, request, parent, isMain);
  }
  return originalLoad.apply(this, arguments);
};

// Now load the actual main.js
require('./main.js');

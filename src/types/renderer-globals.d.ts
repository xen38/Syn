import type { SynAPI } from '../preload'

declare global {
  interface Window {
    synAPI: SynAPI
    locateAPI: SynAPI
  }
}

export {}

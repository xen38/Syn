declare module 'electron' {
  export interface IpcRenderer {
    invoke(channel: string, ...args: unknown[]): Promise<unknown>
    on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void
    removeListener(channel: string, listener: (...args: unknown[]) => void): void
  }

  export interface ContextBridge {
    exposeInMainWorld(apiKey: string, api: Record<string, unknown>): void
  }

  const contextBridge: ContextBridge
  const ipcRenderer: IpcRenderer

  export { contextBridge, ipcRenderer }
}

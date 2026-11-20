import * as electron from 'electron/main';
const { app, BrowserWindow } = electron;
console.log('app:', typeof app)
console.log('BrowserWindow:', typeof BrowserWindow)
app.on('ready', () => {
  console.log('ready!')
  console.log('userData:', app.getPath('userData'))
  app.quit()
})

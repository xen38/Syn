const { app } = require('electron')
console.log('app:', typeof app)
console.log('app.getPath:', typeof app.getPath)
app.on('ready', () => {
  console.log('ready:', app.getPath('userData'))
  app.quit()
})

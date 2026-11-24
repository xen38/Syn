import { cp } from 'fs/promises'
import { join } from 'path'

const root = join(process.cwd(), 'dist')

await cp('renderer', join(root, 'renderer'), { recursive: true })
await cp('assets', join(root, 'assets'), { recursive: true })

console.log('Assets copied to dist/')

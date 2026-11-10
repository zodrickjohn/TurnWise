import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Offline: emits sw.js with every built and public file to precache (not the link-preview image); the cache name changes with the file list
const offline = (): Plugin => ({
  name: 'offline',
  apply: 'build',
  generateBundle(_, bundle) {
    const files = ['./', ...Object.keys(bundle), ...readdirSync('public').filter(f => f !== 'og.png')].map(f => (f === './' ? f : './' + f))
    const sw = readFileSync('src/sw.js', 'utf8'), name = 'turnwise-' + createHash('sha1').update(files.join() + sw).digest('hex').slice(0, 10)
    this.emitFile({ type: 'asset', fileName: 'sw.js', source: `const CACHE = '${name}', FILES = ${JSON.stringify(files)}\n` + sw })
  },
})

// Relative asset paths: the site works at any address, including GitHub Pages' /TurnWise/ sub-path.
// three.js gets its own file, so an app update doesn't make returning visitors download it again
export default defineConfig({
  plugins: [react(), offline()],
  base: './',
  build: { chunkSizeWarningLimit: 600, rolldownOptions: { output: { codeSplitting: { groups: [{ name: 'three', test: /node_modules[\\/]three/ }] } } } },
})

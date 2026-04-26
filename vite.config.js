import { defineConfig } from 'vite'

export default defineConfig({
  root: 'viz',
  base: process.env.VITE_BASE || '/',
  publicDir: '../data/processed',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'),
    // Empty string locally — only shown on CI where GITHUB_SHA is set
    __BUILD_SHA__:   JSON.stringify((process.env.GITHUB_SHA || '').slice(0, 7)),
    __BUILD_DATE__:  JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
})

import { defineConfig } from 'vite'

export default defineConfig({
  root: 'viz',
  // Serve data/processed/ as static assets — no copying or symlinking needed.
  // Vite copies this directory into dist/ on build, so GitHub Pages gets the data too.
  publicDir: '../data/processed',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})

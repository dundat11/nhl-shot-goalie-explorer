import { defineConfig } from 'vite'

export default defineConfig({
  root: 'viz',
  // VITE_BASE is set to /utah-mammoth/ by the GitHub Actions workflow.
  // Locally it defaults to / so dev server works without configuration.
  base: process.env.VITE_BASE || '/',
  publicDir: '../data/processed',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})

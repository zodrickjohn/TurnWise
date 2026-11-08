import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative asset paths: the site works at any address, including GitHub Pages' /TurnWise/ sub-path
export default defineConfig({ plugins: [react()], base: './' })

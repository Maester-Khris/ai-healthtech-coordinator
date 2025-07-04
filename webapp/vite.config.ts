import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
//base: process.env.VITE_BASE_PATH || env.BASE_PATH  {mode} loadEnv
export default defineConfig(()=>{
  //const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      react(),
      tailwindcss()
    ],
    base:'/'
  }
})

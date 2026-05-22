import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json']
  },
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        button: path.resolve(__dirname, 'src/components/button/index.html'),
        switch: path.resolve(__dirname, 'src/components/switch/index.html'),
        input: path.resolve(__dirname, 'src/components/input/index.html'),
        notfound: path.resolve(__dirname, 'src/notfound/index.html'),
      }
    }
  },
})

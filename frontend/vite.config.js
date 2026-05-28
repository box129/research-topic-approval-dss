import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path
      }
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.js',
    exclude: [...configDefaults.exclude, 'tests/smoke/**'],
    css: false, // Disable CSS processing to avoid PostCSS/Tailwind dependency issues in tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        'node_modules/',
        'tests/',
        'coverage/',
        '*.config.js',
        'src/main.jsx'
      ],
      statements: 70,
      branches: 70,
      functions: 70,
      lines: 70
    }
  },
})

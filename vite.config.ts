import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// `vite build --mode artifact`：打包成單一 HTML，發布為 claude.ai 的 Claude 頁面
// 一般 build：GitHub Pages 的 PWA 版本
export default defineConfig(({ mode }) => ({
  base: './',
  build: mode === 'artifact'
    ? { outDir: 'dist-artifact', assetsInlineLimit: 100_000_000, cssCodeSplit: false, modulePreload: false, rollupOptions: { output: { inlineDynamicImports: true } } }
    : {},
  plugins: [
    react(),
    mode === 'artifact'
      ? null
      : VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['icon.svg'],
          manifest: {
            name: '減重飲食紀錄',
            short_name: '減重紀錄',
            description: '個人體重與飲食追蹤',
            lang: 'zh-TW',
            theme_color: '#15803d',
            background_color: '#f4f6f3',
            display: 'standalone',
            start_url: '.',
            icons: [
              { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
              { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
              { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
            ]
          }
        })
  ]
}))

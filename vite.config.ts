import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages ではリポジトリ名の下に置かれるので、ワークフローから BASE_PATH="/<リポジトリ名>/" を渡す
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    VitePWA({
      // 講義中に勝手に再読み込みしないよう、新しい版は次に開いたときに使う
      registerType: 'prompt',
      injectRegister: 'auto',
      manifest: {
        name: 'ノート',
        short_name: 'ノート',
        lang: 'ja',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#0C1224',
        background_color: '#0C1224',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // フォントとPDF.jsのworkerを含め、全ファイルを事前に保存してオフラインで動かす
        globPatterns: ['**/*.{js,mjs,css,html,woff2,png,svg,ico}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: { environment: 'jsdom' },
});

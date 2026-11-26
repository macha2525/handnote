// ホーム画面用アイコンを public/icons/icon.svg から作る：node scripts/make-icons.mjs
// Playwright（Chromium）で描いて PNG にする。角は端末が丸めるので正方形のまま書き出す
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const out = new URL('../public/icons/', import.meta.url);

const browser = await chromium.launch();
for (const n of [180, 192, 512]) {
  const page = await browser.newPage({ viewport: { width: n, height: n } });
  await page.setContent(`<style>html,body{margin:0}svg{display:block;width:${n}px;height:${n}px}</style>${svg}`);
  await page.screenshot({ path: new URL(`icon-${n}.png`, out).pathname });
  await page.close();
}
await browser.close();
console.log('icons written');

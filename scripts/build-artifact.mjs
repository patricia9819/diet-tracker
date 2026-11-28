// 把 vite 的 artifact 打包結果合併成一個可發布的 Claude 頁面 HTML（不含 html/head/body 標籤）
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'

const dir = 'dist-artifact/assets'
const files = readdirSync(dir)
const js = files.filter((f) => f.endsWith('.js')).map((f) => readFileSync(`${dir}/${f}`, 'utf8')).join('\n')
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(`${dir}/${f}`, 'utf8')).join('\n')
const safeJs = js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--')

const html = `<title>減重紀錄</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${css}</style>
<div id="root"></div>
<script type="module">${safeJs}</script>
`
writeFileSync('dist-artifact/diet-tracker.html', html)
console.log('dist-artifact/diet-tracker.html', (html.length / 1024).toFixed(0), 'KB')

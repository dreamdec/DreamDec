// Renders each pin's HTML with a load-time probe and reports anything that
// escapes the 1000x1500 frame — cheaper and more reliable than eyeballing nine PNGs.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SRC = path.join(HERE, 'preview', 'pin-src');
const W = 1000;
const H = 1500;

const fileUrl = (p) => `file:///${String(p).replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1:')}`;

const PROBE = `<script>
addEventListener('load', () => {
  const pin = document.querySelector('.pin');
  const r = pin.getBoundingClientRect();
  const out = [];
  pin.querySelectorAll('h1, p, span, img, .card, .cell, .grid, .foot').forEach((el) => {
    const b = el.getBoundingClientRect();
    if (b.bottom > r.bottom + 1 || b.right > r.right + 1 || b.left < r.left - 1 || b.top < r.top - 1) {
      out.push((el.className || el.tagName) + ' bottom=' + Math.round(b.bottom));
    }
  });
  document.title = JSON.stringify({ sh: document.documentElement.scrollHeight, ov: out });
});
<\/script>`;

if (!fs.existsSync(SRC)) {
  console.error('preview/pin-src/ is empty — run `node make-pins.mjs` first.');
  process.exit(1);
}

let bad = 0;
for (const f of fs.readdirSync(SRC).filter((n) => n.endsWith('.html')).sort()) {
  const html = fs.readFileSync(path.join(SRC, f), 'utf8').replace('</body>', PROBE + '</body>');
  const probePath = path.join(SRC, '_probe_' + f);
  fs.writeFileSync(probePath, html);
  const dom = execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--window-size=${W},${H}`, '--force-device-scale-factor=1',
    '--virtual-time-budget=25000', '--dump-dom', fileUrl(probePath),
  ], { encoding: 'utf8', maxBuffer: 1 << 28 });
  fs.rmSync(probePath);

  const m = dom.match(/<title>([\s\S]*?)<\/title>/);
  let info = null;
  try { info = JSON.parse(m[1].replace(/&quot;/g, '"')); } catch { /* probe did not report */ }
  const issue = !info
    ? 'probe returned nothing'
    : info.sh > H
      ? `content height ${info.sh}px`
      : info.ov.length
        ? `escapes frame: ${info.ov.join(', ')}`
        : '';
  if (issue) bad++;
  console.log(`  ${f.replace(/\.html$/, '').padEnd(30)} ${issue || 'ok'}`);
}
console.log(bad ? `\n${bad} pin(s) overflow the frame` : `\nall pins fit ${W}x${H}`);
process.exit(bad ? 1 : 0);

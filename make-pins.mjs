import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PIN_DIR = path.join(HERE, 'src', 'pins');
const WORK = path.join(HERE, 'preview', 'pin-src');
const W = 1000;
const H = 1500;

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// "Best invisible look: Yieach clear acrylic six pack" -> "Best invisible look"
const award = (slot) => (slot.draftHeading ?? '').split(':')[0].trim();

const slugOf = (slot) => slot.id;

const BASE_CSS = `
  :root {
    --paper: #fbf8f3; --card: #ffffff; --ink: #211d18; --ink-soft: #5a5148;
    --clay: #b45c37; --clay-deep: #93472a; --sage: #6d7f61; --gold: #a87d21;
    --line: #e8dfd0; --muted: #8b8177;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body {
    font-family: 'Karla', system-ui, sans-serif; color: var(--ink);
    background: var(--paper); -webkit-font-smoothing: antialiased;
  }
  .pin { width: ${W}px; height: ${H}px; display: flex; flex-direction: column; padding: 46px 46px 34px; }
  .eyebrow {
    display: flex; align-items: center; gap: 14px;
    font: 700 21px/1 'Karla', sans-serif; letter-spacing: .16em; text-transform: uppercase; color: var(--clay);
  }
  .eyebrow .rule { flex: 1; height: 2px; background: var(--line); }
  .display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }
  .foot {
    flex: 0 0 auto; margin-top: 30px; padding-top: 26px; border-top: 2px solid var(--line);
    display: flex; align-items: flex-end; justify-content: space-between; gap: 20px;
  }
  .foot .mark { display: flex; align-items: center; gap: 13px; }
  .foot .mark img { width: 38px; height: 38px; display: block; }
  .foot .word { font: 600 30px/1 'Fraunces', serif; letter-spacing: -.01em; }
  .foot .word span { color: var(--clay); }
  .foot .site { font: 400 21px/1.3 'Karla', sans-serif; color: var(--muted); text-align: right; }
  .foot .site b { display: block; color: var(--ink-soft); font-weight: 700; letter-spacing: .02em; }
  .chip {
    display: inline-flex; align-items: center; gap: 10px; align-self: flex-start;
    background: #f4ece0; color: var(--clay-deep); border-radius: 999px;
    font: 700 21px/1 'Karla', sans-serif; letter-spacing: .05em; text-transform: uppercase;
    padding: 13px 22px;
  }
  .chip::before { content: ''; width: 9px; height: 9px; border-radius: 50%; background: var(--sage); }
`;

function page(title, css, body) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..600&family=Karla:ital,wght@0,400..700;1,400&display=swap" rel="stylesheet">
<style>${BASE_CSS}${css}</style>
<title>${esc(title)}</title></head>
<body><div class="pin">${body}</div></body></html>`;
}

const fileUrl = (p) => `file:///${String(p).replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1:')}`;

function productPin(slot) {
  const head = award(slot) || slot.type;
  const body = `
    <div class="eyebrow">No-drill bedroom shelving<span class="rule"></span></div>
    <h1 class="display">${esc(head)}</h1>
    <figure>
      <img src="${fileUrl(path.join(HERE, 'src', slot.pick.image))}" alt="">
    </figure>
    <div class="copy">
      <p class="name display">${esc(slot.pick.title)}</p>
      <p class="spec">${esc(slot.pick.spec)}</p>
      <span class="chip">${esc(slot.mount)}</span>
    </div>
    <div class="foot">
      <div class="mark"><img src="${fileUrl(path.join(HERE, 'src', 'icon.svg'))}" alt=""><span class="word display">Dream<span>Dec</span></span></div>
      <p class="site"><b>dreamdec.pages.dev</b>Contains an Amazon affiliate link</p>
    </div>`;
  const css = `
    h1 { font-size: 74px; line-height: 1.06; letter-spacing: -.02em; margin: 18px 0 26px; text-wrap: balance; }
    figure {
      flex: 1 1 auto; min-height: 0; background: var(--card); border: 2px solid var(--line);
      border-radius: 26px; display: flex; align-items: center; justify-content: center; padding: 30px;
    }
    figure img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
    .copy { margin: 34px 0 0; flex: 0 0 auto; display: flex; flex-direction: column; gap: 14px; }
    .name { font-size: 40px; line-height: 1.22; font-weight: 600; letter-spacing: -.01em; }
    .spec { font-size: 27px; line-height: 1.4; color: var(--clay-deep); font-weight: 600; }
  `;
  return page(slot.pick.title, css, body);
}

function collagePin(slots, part, total) {
  const tiles = slots.map((s) => `
      <div class="cell">
        <div class="shot"><img src="${fileUrl(path.join(HERE, 'src', s.pick.image))}" alt=""></div>
        <p class="label">${esc(award(s))}</p>
        <p class="how">${esc(s.mount)}</p>
      </div>`).join('');
  const body = `
    <div class="eyebrow">Renter-friendly bedroom<span class="rule"></span></div>
    <h1 class="display">Damage-free wall shelves<br><em>that need zero drilling</em></h1>
    <p class="sub">Four of eight · part ${part} of ${total} · full list on the site</p>
    <div class="grid">${tiles}</div>
    <div class="foot">
      <div class="mark"><img src="${fileUrl(path.join(HERE, 'src', 'icon.svg'))}" alt=""><span class="word display">Dream<span>Dec</span></span></div>
      <p class="site"><b>dreamdec.pages.dev</b>Contains Amazon affiliate links</p>
    </div>`;
  const css = `
    h1 { font-size: 62px; line-height: 1.08; letter-spacing: -.02em; margin: 16px 0 0; }
    h1 em { font-style: italic; color: var(--clay); font-weight: 400; }
    .sub { margin: 14px 0 26px; font-size: 25px; color: var(--muted); letter-spacing: .02em; }
    .grid { flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 22px; min-height: 0; }
    .cell { background: var(--card); border: 2px solid var(--line); border-radius: 22px; padding: 18px; display: flex; flex-direction: column; gap: 10px; min-height: 0; }
    .shot { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
    .shot img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
    .label { font: 600 26px/1.2 'Fraunces', serif; letter-spacing: -.01em; }
    .how { font: 700 19px/1.2 'Karla', sans-serif; text-transform: uppercase; letter-spacing: .07em; color: var(--clay-deep); }
  `;
  return page(`No-drill shelves part ${part}`, css, body);
}

fs.mkdirSync(PIN_DIR, { recursive: true });
fs.mkdirSync(WORK, { recursive: true });

const article = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'articles.json'), 'utf8'))
  .articles.find((a) => a.slug === 'no-drill-wall-shelves');
const filled = article.slots.filter((s) => s.pick?.image && s.pick?.amazonUrl);
if (filled.length !== 8) throw new Error(`expected 8 filled shelf picks, found ${filled.length}`);

const jobs = [];
for (const slot of filled) jobs.push({ name: slugOf(slot), html: productPin(slot) });
const halves = [filled.slice(0, 4), filled.slice(4)];
halves.forEach((group, i) => jobs.push({ name: `collage-${i + 1}`, html: collagePin(group, i + 1, halves.length) }));

for (const job of jobs) {
  const htmlPath = path.join(WORK, `${job.name}.html`);
  const pngPath = path.join(PIN_DIR, `${job.name}.png`);
  fs.writeFileSync(htmlPath, job.html);
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--window-size=${W},${H}`, '--force-device-scale-factor=1',
    '--virtual-time-budget=20000', `--screenshot=${pngPath}`, fileUrl(htmlPath),
  ], { stdio: 'ignore' });
  const kb = Math.round(fs.statSync(pngPath).size / 1024);
  console.log(`  ${job.name.padEnd(30)} ${kb} KB`);
}
console.log(`\n${jobs.length} pins rendered into src/pins/`);

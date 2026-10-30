// pinterest-pins/ is for posting by hand: one folder per article, holding that article's
// images plus the copy to paste. Everything in it is generated from data/pin-queue.json, so
// pin copy is only ever edited in the queue and this folder can never disagree with it.
//
//   node make-pins.mjs && node make-pin-upload.mjs
//
// Manual because Pinterest's Trial access tier creates API pins that only the account owner
// can see; see the note in publish-pins.mjs before assuming that has changed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_ROOT = path.join(HERE, 'pinterest-pins');
const IMG_SRC = path.join(HERE, 'src', 'pins');
const queue = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'pin-queue.json'), 'utf8'));

const bad = [];
for (const pin of queue.pins) {
  if (pin.title.length > 100) bad.push(`${pin.id}: title is ${pin.title.length} chars, Pinterest allows 100`);
  if (pin.note.length > 500) bad.push(`${pin.id}: description is ${pin.note.length} chars, Pinterest allows 500`);
  if (!/affiliate/i.test(pin.note)) bad.push(`${pin.id}: description carries no affiliate disclosure`);
  if (!pin.alt) bad.push(`${pin.id}: no alt text`);
  if (!fs.existsSync(path.join(IMG_SRC, pin.image))) bad.push(`${pin.image}: not in src/pins/ - run \`node make-pins.mjs\``);
}
if (bad.length) {
  console.error(`Fix these before generating:\n  - ${bad.join('\n  - ')}`);
  process.exit(1);
}

// Pins group by the article they point at, so a second guide drops into this folder as a
// second subfolder without anything here having to know about it. The fragment on a product
// pin's link is the popup trigger, so it is stripped for the grouping.
const articles = new Map(JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'articles.json'), 'utf8')).articles
  .map((a) => [a.slug, a]));

const groups = new Map();
for (const pin of queue.pins) {
  const pathname = new URL(pin.link).pathname.replace(/\/+$/, '');
  const slug = pathname.split('/').filter(Boolean).pop();
  // Folders are named for the article, because they get opened by hand: `pinFolder` in
  // data/articles.json wins, the URL slug is the fallback.
  const folder = articles.get(slug)?.pinFolder ?? slug;
  if (!groups.has(folder)) groups.set(folder, { pathname, pins: [] });
  groups.get(folder).pins.push(pin);
}

// Leftover flat output from when the whole queue was one article loose in this folder.
for (const stale of ['pin-text.txt', 'bulk-upload.csv']) fs.rmSync(path.join(OUT_ROOT, stale), { force: true });
for (const stale of fs.readdirSync(OUT_ROOT).filter((f) => f.endsWith('.png'))) fs.rmSync(path.join(OUT_ROOT, stale), { force: true });

let total = 0;
for (const [folder, group] of groups) {
  const dir = path.join(OUT_ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });
  for (const pin of group.pins) fs.copyFileSync(path.join(IMG_SRC, pin.image), path.join(dir, pin.image));

  // The collage is the pin whose link has no fragment - it is the one that opens the article,
  // so it goes first and everything else follows.
  const ordered = [...group.pins].sort((a, b) => (a.link.includes('#') ? 1 : 0) - (b.link.includes('#') ? 1 : 0));
  const articleTitle = ordered[0].title;
  const blocks = ordered.map((p, i) => `${i + 1}. ${p.image}
   TITLE        ${p.title}
   DESCRIPTION  ${p.note}
   LINK         ${p.link}
   ALT TEXT     ${p.alt}`);

  fs.writeFileSync(path.join(dir, 'pin-text.txt'), `${articleTitle} - ${ordered.length} pins

Post them one at a time on pinterest.com (Create -> Pin), in the order below. For each pin:
upload the image named in that block, then paste its TITLE, DESCRIPTION and LINK into the
matching fields, and put the ALT TEXT in "Add alt text". Choose the "${queue.board.name}" board.

Post block 1 first - it is the collage of all ${ordered.length - 1} picks and the only pin that
links straight to the article. The rest each open one product on that article with a Shop on
Amazon button beside it.

Every description already carries the Amazon affiliate disclosure. Do not remove it - the
disclosure has to be on the pin, not only on the landing page.

Generated from data/pin-queue.json by make-pin-upload.mjs. Edit the copy in the queue and
re-run \`node make-pins.mjs && node make-pin-upload.mjs\`; never edit this folder.

${blocks.join('\n\n')}
`);

  total += ordered.length;
  console.log(`pinterest-pins/${folder}/ - ${ordered.length} images + pin-text.txt`);
  for (const p of ordered) console.log(`  ${p.image.padEnd(36)} title ${String(p.title.length).padStart(3)}  description ${String(p.note.length).padStart(3)}`);
}
console.log(`\n${total} pins ready across ${groups.size} article folder(s).`);

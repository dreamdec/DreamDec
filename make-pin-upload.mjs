// pinterest-pins/ is the folder for hand-uploading, and it must never disagree with
// data/pin-queue.json, which is what the API publisher posts from. Both files here
// are generated, so pin copy is only ever edited in the queue.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'pinterest-pins');
const queue = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'pin-queue.json'), 'utf8'));
const SITE = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'site.json'), 'utf8')).baseUrl.replace(/\/$/, '');

const bad = [];
for (const pin of queue.pins) {
  if (pin.title.length > 100) bad.push(`${pin.id}: title is ${pin.title.length} chars, Pinterest allows 100`);
  if (pin.note.length > 500) bad.push(`${pin.id}: description is ${pin.note.length} chars, Pinterest allows 500`);
  if (!/affiliate/i.test(pin.note)) bad.push(`${pin.id}: description carries no affiliate disclosure`);
  if (!pin.alt) bad.push(`${pin.id}: no alt text`);
}
if (bad.length) {
  console.error(`Fix these in data/pin-queue.json before generating:\n  - ${bad.join('\n  - ')}`);
  process.exit(1);
}

const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
const header = ['Title', 'Description', 'Link', 'Media URL', 'Pinterest board'];
const rows = queue.pins.map((p) =>
  [p.title, p.note, p.link, `${SITE}/pins/${p.image}`, queue.board.name].map(cell).join(','));
// CRLF because the bulk uploader is built for spreadsheets, which disagree on
// line endings far more often than they disagree on anything else.
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'bulk-upload.csv'), [header.map(cell).join(','), ...rows].join('\r\n') + '\r\n');

const blocks = queue.pins.map((p, i) => `${i + 1}. ${p.image}
   TITLE:       ${p.title}
   DESCRIPTION: ${p.note}
   LINK:        ${p.link}
   ALT TEXT:    ${p.alt}`);
fs.writeFileSync(path.join(OUT, 'pin-text.txt'), `DreamDec pins - copy-paste text for each image in this folder
Upload order is top to bottom: 3 a day at 7pm, 10pm, 1am Bangladesh time.
Every description already carries the affiliate disclosure. Do not remove it.
Generated from data/pin-queue.json by make-pin-upload.mjs - edit the copy there.

${blocks.join('\n\n')}
`);

console.log(`${queue.pins.length} pins written to pinterest-pins/pin-text.txt and bulk-upload.csv`);
for (const p of queue.pins) console.log(`  ${p.id.padEnd(30)} title ${String(p.title.length).padStart(3)}  description ${String(p.note.length).padStart(3)}`);

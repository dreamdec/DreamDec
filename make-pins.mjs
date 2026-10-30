import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PIN_DIR = path.join(HERE, 'src', 'pins');
const BG_DIR = path.join(HERE, 'assets', 'pin-bg');
const WORK = path.join(HERE, 'preview', 'pin-src');
const W = 1000;
const H = 1500;

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Pin copy is written for the pin, not lifted from the article. The award phrases
// ("Cheapest way in") and the spec strings are table voice, and a caveat like
// "no load figure stated" is editorial hedging that belongs on the page.
// Nothing here asserts a load rating the article does not already state.
//
// One entry per guide, and every guide is rendered in every run: the orphan sweep at
// the bottom deletes any PNG a run did not produce, so rendering one guide alone
// would erase the others.
//
// `eyebrow` doubles as the Pinterest keyword line, so it stays search-y — but a pick
// that needs an anchor gets its own, so it never wears a "no-drill" label.
//
// House style is the card layout: the room is the background and a white card
// holding the product photo fills most of the frame, popped over it. Only the
// headline band and a margin of room stay open. `layout: 'placed'` on a pin
// instead blends the product straight into the scene with multiply, which looks
// better for picks shot on white but reads as a pasted rectangle for the ones whose
// listing photos are themselves styled room scenes.
//
// `place` is only read by the placed layout: the cutout's top-left corner and width
// as percentages of the 1000x1500 frame, tuned by eye against each scene.
const GUIDES = [
  {
    slug: 'no-drill-wall-shelves',
    // Delivered before a second guide existed, so it kept the unqualified name.
    // Every collage since is namespaced, because two guides cannot both be collage.png.
    collageFile: 'collage',
    expect: 8,
    eyebrow: 'No-drill bedroom storage',
    collage: {
      eyebrow: 'Renter-friendly bedroom',
      line: '8 Damage-Free Wall Shelves<br>That Changed My Rental Room',
      sub: 'No drill for 7 of the 8.',
      scene: 'wall',
    },
    pins: {
      'command-decor-metal-shelf': {
        name: 'Command Décor metal shelf', chip: 'Adhesive strips', scene: 'wall',
        // The listing photo is packaging above the loose shelf; only the shelf belongs on a wall.
        place: { l: 52, t: 30, w: 42, crop: { t: 60 } },
        line: 'A shelf that sticks, not screws', sub: 'Comes with the strips. Peels off without a mark.',
      },
      'yieach-acrylic-shelf-6-pack': {
        name: 'Yieach clear acrylic set', chip: 'Tape or screws', scene: 'wall',
        place: { l: 6, t: 32, w: 60 },
        line: 'Six clear shelves that disappear', sub: 'See-through, so they vanish on a pale wall.',
      },
      'fayygyh-floating-shelf-pair': {
        name: 'FAYYGYH floating pair', chip: 'Adhesive tape', scene: 'wall',
        place: { l: 56, t: 33, w: 40 },
        line: 'Two shelves. Tape only.', sub: 'The cheapest way into a wall shelf.',
      },
      'jarlink-over-door-organizer': {
        name: 'JARLINK over-door rack', chip: 'Hooks over door', scene: 'door',
        // The listing shows two racks: one already mounted on a wood door, which would
        // paste a brown rectangle onto ours, and one bare. Keep the bare one.
        place: { l: 12, t: 16, w: 55, crop: { l: 62, r: 1 } },
        line: 'Storage that hangs on the door', sub: 'Uses the back of a door you already have.',
      },
      'tension-pole-shelf': {
        name: 'Tension pole shelves', chip: 'No wall contact', scene: 'corner',
        line: 'Floor to ceiling, nothing drilled', sub: 'Wedged tight between floor and ceiling.',
      },
      'vasagle-ladder-shelf': {
        name: 'VASAGLE ladder shelf', chip: 'Leans + straps', scene: 'corner', eyebrow: 'Bedroom storage',
        place: { l: 58, t: 30, w: 38 },
        line: 'The one you do have to anchor', sub: 'Leans like a ladder, straps into the wall.',
      },
      'loghot-bedside-caddy': {
        name: 'Loghot hanging caddy', chip: 'Hangs on rail', scene: 'bedside',
        place: { l: 52, t: 54, w: 44, boost: 1.3 },
        line: 'Everything beside the bed', sub: 'Phone, meds, cables and remote in one pocket.',
      },
      'value-tree-clamp-shelf': {
        name: 'Value Tree clamp shelf', chip: 'Clamps on rail', scene: 'bedside',
        line: 'Clamps on. No holes.', sub: 'Grips the bed rail instead of the wall.',
      },
    },
  },
  {
    slug: 'narrow-desks-40-inch-wall',
    collageFile: 'collage-desks',
    expect: 6,
    eyebrow: 'Desks for small bedrooms',
    collage: {
      eyebrow: 'Renter-friendly bedroom',
      line: '6 Desks That Fit a 40-Inch Wall<br>And Changed My Rental Room',
      sub: 'Five stand alone. One folds flat on the wall.',
      scene: 'corner',
      cell: 'stack',
    },
    pins: {
      'compact-writing-desk-36': {
        name: 'DAOUTIME 36 in writing desk', chip: 'Drawers + shelves', scene: 'corner',
        line: 'Two drawers. Two shelves. 35 in.',
        sub: 'The charger lives in a drawer, so the top stays clear.',
      },
      'fold-down-wall-desk': {
        name: 'DAZIMOU fold-down desk', chip: 'Screws into the wall', scene: 'wall',
        eyebrow: 'Wall-mounted folding desk',
        line: 'The desk that folds flat', sub: '22.8 in deep when you sit at it. Gone when you stand up.',
      },
      'small-corner-desk': {
        name: 'SEDETA corner desk', chip: 'Fills the corner', scene: 'corner',
        line: 'The corner was wasted floor', sub: 'A triangular top turns two dead walls into a desk.',
      },
      'rolling-writing-table': {
        name: 'AHB rolling desk', chip: 'Casters, two lock', scene: 'wall',
        line: 'Roll it out of the way', sub: '39 in of desktop on wheels. 2 of the 4 lock.',
      },
      'slim-standing-desk': {
        name: 'Claiks standing desk', chip: 'Electric sit-stand', scene: 'wall',
        line: 'Sit-stand, 32 inches wide', sub: '28.3 to 46.5 in tall, with three saved heights.',
      },
      'console-table-desk': {
        name: 'Simple Trending console', chip: 'Laptop-width top', scene: 'door',
        line: 'A desk that reads as furniture', sub: '10.5 in deep - a laptop only, and that is the trade.',
      },
    },
  },
];


// The article's spec strings carry a "no load figure stated" hedge. True on the
// page where it reads as a caveat; on a pin it reads as a red flag.
const pinSpec = (spec) => spec.replace(/\s*·\s*no load figure stated/i, '');

// Every pin in the house style. A pin can opt into 'placed' for the shot-on-white
// listings where blending the backdrop reads better than a card.
const LAYOUT = 'card';

const fileUrl = (p) => `file:///${String(p).replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1:')}`;
const sceneUrl = (name) => fileUrl(path.join(BG_DIR, `scene-${name}.png`));

const BASE_CSS = `
  :root {
    --paper: #fbf8f3; --card: #ffffff; --ink: #211d18; --ink-soft: #5a5148;
    --clay: #b45c37; --clay-deep: #93472a; --sage: #6d7f61; --gold: #a87d21;
    --line: #e8dfd0; --muted: #8b8177;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body {
    font-family: 'Karla', system-ui, sans-serif; color: var(--ink); background: var(--paper);
    -webkit-font-smoothing: antialiased;
  }
  .pin { width: ${W}px; height: ${H}px; position: relative; display: flex; flex-direction: column; padding: 44px 44px 0; }
  .pin::before {
    content: ''; position: absolute; inset: 0; z-index: -2;
    background: var(--bg) center/cover no-repeat;
  }
  .scrim {
    position: absolute; inset: 0; z-index: -1;
    /* Two fades: the top one carries the headline, the bottom one keeps the
       product name readable where the scene has a dark floor or rug. */
    background: linear-gradient(180deg,
      rgba(251,248,243,.94) 0%, rgba(251,248,243,.86) 34%, rgba(251,248,243,.3) 58%,
      rgba(251,248,243,0) 74%, rgba(251,248,243,.55) 88%, rgba(251,248,243,.9) 100%);
  }
  /* The product JPEGs have no alpha channel, so multiply is what drops their white
     studio backdrop: white multiplied against a pale wall returns the wall. It also
     means a clear acrylic shelf stays see-through, which is the whole point of it. */
  .placed { position: absolute; z-index: 0; mix-blend-mode: multiply; display: block; height: auto; }
  .copy, .caption, .foot { position: relative; z-index: 1; }
  .eyebrow {
    display: flex; align-items: center; gap: 14px;
    font: 700 20px/1 'Karla', sans-serif; letter-spacing: .16em; text-transform: uppercase; color: var(--clay);
  }
  .eyebrow .rule { flex: 1; height: 2px; background: rgba(33,29,24,.16); }
  .display { font-family: 'Fraunces', Georgia, serif; font-optical-sizing: auto; }
  /* Full-bleed band: the wordmark and the affiliate disclosure have to stay
     readable over a dark rug or a shadowed floor, which the scene often is. */
  .foot {
    flex: 0 0 auto; margin: 26px -44px 0; padding: 20px 44px 24px;
    display: flex; align-items: center; justify-content: space-between; gap: 20px;
    background: rgba(251,248,243,.95); border-top: 2px solid var(--line);
  }
  .foot .mark { display: flex; align-items: center; gap: 12px; }
  .foot .mark img { width: 34px; height: 34px; display: block; }
  .foot .word { font: 600 27px/1 'Fraunces', serif; letter-spacing: -.01em; color: var(--ink); }
  .foot .word span { color: var(--clay); }
  .foot .site { font: 400 19px/1.35 'Karla', sans-serif; color: var(--ink-soft); text-align: right; }
  .foot .site b { display: block; color: var(--ink); font-weight: 700; letter-spacing: .02em; }
  .chip {
    display: inline-flex; align-items: center; gap: 10px; align-self: flex-start;
    background: #f4ece0; color: var(--clay-deep); border-radius: 999px;
    font: 700 20px/1 'Karla', sans-serif; letter-spacing: .05em; text-transform: uppercase; padding: 12px 20px;
  }
  .chip::before { content: ''; width: 9px; height: 9px; border-radius: 50%; background: var(--sage); }
`;

function page(css, body) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..600&family=Karla:ital,wght@0,400..700;1,400&display=swap" rel="stylesheet">
<style>${BASE_CSS}${css}</style>
</head><body>${body}</body></html>`;
}

// A pick that cannot wear the guide's keyword - the shelf that needs an anchor, the
// desk that screws into the wall - overrides `eyebrow` on its own pin.
const eyebrowFor = (guide, slot) => guide.pins[slot.id].eyebrow ?? guide.eyebrow;

function productPin(guide, slot) {
  const { name, line, sub, chip, scene, place, layout } = guide.pins[slot.id];
  const img = fileUrl(path.join(HERE, 'src', slot.pick.image));
  const clip = place?.crop
    ? `clip-path: inset(${place.crop.t ?? 0}% ${place.crop.r ?? 0}% ${place.crop.b ?? 0}% ${place.crop.l ?? 0}%);`
    : '';
  // Some listing photos are shot on pale grey, not white, and multiply can only
  // darken — that leaves a visible rectangle. Pushing the backdrop over white
  // first makes it vanish; the amount is tuned per pin because it also lifts the
  // product itself.
  const boost = place?.boost ?? 1.12;
  const copy = `
      <div class="eyebrow">${esc(eyebrowFor(guide, slot))}<span class="rule"></span></div>
      <h1 class="display">${esc(line)}</h1>
      <p class="sub">${esc(sub)}</p>`;
  const foot = `
      <div class="foot">
        <div class="mark"><img src="${fileUrl(path.join(HERE, 'src', 'icon.svg'))}" alt=""><span class="word display">Dream<span>Dec</span></span></div>
        <p class="site"><b>dreamdec.pages.dev</b>Contains an Amazon affiliate link</p>
      </div>`;

  if ((layout ?? LAYOUT) === 'card') {
    const body = `
    <div class="pin" style="--bg:url('${sceneUrl(scene)}')">
      <div class="scrim"></div>
      <div class="copy">${copy}</div>
      <div class="card">
        <div class="shot"><img src="${img}" alt=""></div>
        <div class="txt">
          <div class="left">
            <p class="name display">${esc(name)}</p>
            <p class="spec">${esc(pinSpec(slot.pick.spec))}</p>
          </div>
          <span class="chip">${esc(chip)}</span>
        </div>
      </div>
      ${foot}
    </div>`;
    return page(CARD_CSS + copyCss(), body);
  }

  const body = `
    <div class="pin" style="--bg:url('${sceneUrl(scene)}')">
      <div class="scrim"></div>
      <img class="placed" src="${img}" alt="" style="left:${place.l}%;top:${place.t}%;width:${place.w}%;filter:brightness(${boost}) contrast(1.05);${clip}">
      <div class="copy">${copy}</div>
      <div class="caption">
        <p class="name display">${esc(name)}</p>
        <span class="chip">${esc(chip)}</span>
      </div>
      ${foot}
    </div>`;
  return page(copyCss() + `
    .caption { flex: 0 0 auto; margin-top: auto; display: flex; align-items: center; gap: 18px; }
    .name { font-size: 34px; line-height: 1.1; font-weight: 600; letter-spacing: -.015em;
            text-shadow: 0 2px 14px rgba(251,248,243,.98), 0 0 34px rgba(251,248,243,.95), 0 1px 0 rgba(251,248,243,.9); }
  `, body);
}

const copyCss = () => `
  .copy { flex: 0 0 auto; }
  h1 { font-size: 76px; line-height: 1.05; letter-spacing: -.025em; margin: 20px 0 0; max-width: 15ch; }
  .sub { margin: 18px 0 0; max-width: 26ch; font-size: 29px; line-height: 1.35; font-weight: 400; color: var(--ink-soft); }
`;

const CARD_CSS = `
  /* The card is the pin: it takes every pixel the headline band does not need,
     so the photo reads at thumb size in a Pinterest feed. min-height:0 lets the
     flex children shrink instead of pushing the frame past 1500px.
     Solid white, not translucent: the listing photos are shot on white, and any
     see-through tint leaves their backdrop visible as a brighter block. */
  .card {
    flex: 1 1 auto; min-height: 0; margin: 26px 0 0;
    background: #fff; border: 2px solid var(--line);
    border-radius: 30px; padding: 30px; display: flex; flex-direction: column;
    box-shadow: 0 22px 54px rgba(33,29,24,.20);
  }
  .shot { flex: 1 1 auto; min-height: 0; display: flex; align-items: center; justify-content: center; }
  .shot img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
  .txt {
    flex: 0 0 auto; margin-top: 24px; padding-top: 24px; border-top: 2px solid var(--line);
    display: flex; align-items: flex-end; justify-content: space-between; gap: 24px;
  }
  .left { min-width: 0; display: flex; flex-direction: column; gap: 9px; }
  .name { font-size: 41px; line-height: 1.14; font-weight: 600; letter-spacing: -.018em; }
  .spec { font-size: 24px; line-height: 1.32; color: var(--clay-deep); font-weight: 600; }
  .txt .chip { flex: 0 0 auto; align-self: flex-end; }
`;

function collagePin(guide, slots) {
  const { line, sub, scene, eyebrow } = guide.collage;
  const tiles = slots.map((s) => `
      <div class="cell">
        <div class="shot"><img src="${fileUrl(path.join(HERE, 'src', s.pick.image))}" alt=""></div>
        <div class="txt">
          <p class="label">${esc(guide.pins[s.id].name)}</p>
          <p class="how">${esc(guide.pins[s.id].chip)}</p>
        </div>
      </div>`).join('');
  const body = `
    <div class="pin" style="--bg:url('${sceneUrl(scene)}')">
      <div class="scrim"></div>
      <div class="eyebrow">${esc(eyebrow)}<span class="rule"></span></div>
      <h1 class="display">${line}</h1>
      <p class="sub">${esc(sub)}</p>
      <div class="grid">${tiles}</div>
      <div class="foot">
        <div class="mark"><img src="${fileUrl(path.join(HERE, 'src', 'icon.svg'))}" alt=""><span class="word display">Dream<span>Dec</span></span></div>
        <p class="site"><b>dreamdec.pages.dev</b>Contains Amazon affiliate links</p>
      </div>
    </div>`;
  const rows = Math.ceil(slots.length / 2);
  // Two cell shapes, because the grid is only ever two tiles wide. Eight picks make
  // short rows that a thumbnail has to sit beside; six make tall rows where the same
  // 128px square leaves the bottom two thirds of the card empty, so the photo goes on
  // top and grows into the cell instead.
  const stacked = guide.collage.cell === 'stack';
  const css = `
    h1 { font-size: 54px; line-height: 1.06; letter-spacing: -.022em; margin: 14px 0 0; }
    .sub { margin: 12px 0 20px; font-size: 25px; font-weight: 700; color: var(--clay-deep); letter-spacing: .01em; }
    .grid { flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: repeat(${rows}, 1fr); gap: 14px; min-height: 0; }
    .cell { background: rgba(255,255,255,.95); border: 2px solid var(--line); border-radius: 16px; padding: 12px; display: flex; ${stacked ? 'flex-direction: column; gap: 10px;' : 'align-items: center; gap: 12px;'} min-height: 0; }
    .shot ${stacked ? '{ flex: 1 1 auto; min-height: 0; width: 100%;' : '{ flex: 0 0 128px; width: 128px; height: 128px;'} display: flex; align-items: center; justify-content: center; }
    .shot img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
    .txt { ${stacked ? 'flex: 0 0 auto; text-align: center;' : 'flex: 1; min-width: 0;'} }
    .label { font: 600 ${stacked ? '26px/1.14' : '23px/1.16'} 'Fraunces', serif; letter-spacing: -.01em; }
    .how { margin-top: 5px; font: 700 ${stacked ? '16px' : '15px'}/1.2 'Karla', sans-serif; text-transform: uppercase; letter-spacing: .05em; color: var(--clay-deep); }
  `;
  return page(css, body);
}

fs.mkdirSync(PIN_DIR, { recursive: true });
fs.mkdirSync(WORK, { recursive: true });

const articles = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'articles.json'), 'utf8')).articles;
const jobs = [];

for (const guide of GUIDES) {
  const article = articles.find((a) => a.slug === guide.slug);
  if (!article) throw new Error(`no article with slug ${guide.slug}`);
  const filled = article.slots.filter((s) => s.pick?.image && s.pick?.amazonUrl);
  if (filled.length !== guide.expect) {
    throw new Error(`${guide.slug}: expected ${guide.expect} filled picks, found ${filled.length}`);
  }
  for (const slot of filled) if (!guide.pins[slot.id]) throw new Error(`no pin copy for slot ${slot.id}`);
  for (const name of Object.values(guide.pins).map((p) => p.scene).concat(guide.collage.scene)) {
    if (!fs.existsSync(path.join(BG_DIR, `scene-${name}.png`))) throw new Error(`missing backdrop scene-${name}.png`);
  }
  for (const slot of filled) jobs.push({ name: slot.id, html: productPin(guide, slot) });
  jobs.push({ name: guide.collageFile, html: collagePin(guide, filled) });
}

for (const job of jobs) {
  const htmlPath = path.join(WORK, `${job.name}.html`);
  const pngPath = path.join(PIN_DIR, `${job.name}.png`);
  fs.writeFileSync(htmlPath, job.html);
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--window-size=${W},${H}`, '--force-device-scale-factor=1',
    '--virtual-time-budget=25000', `--screenshot=${pngPath}`, fileUrl(htmlPath),
  ], { stdio: 'ignore' });
  console.log(`  ${job.name.padEnd(30)} ${Math.round(fs.statSync(pngPath).size / 1024)} KB`);
}

// Orphans would otherwise keep shipping to dist/pins/ after a layout change.
const keep = new Set(jobs.map((j) => `${j.name}.png`));
for (const stale of fs.readdirSync(PIN_DIR)) {
  if (/\.png$/i.test(stale) && !keep.has(stale)) fs.rmSync(path.join(PIN_DIR, stale));
}

console.log(`\n${jobs.length} pins rendered into src/pins/`);

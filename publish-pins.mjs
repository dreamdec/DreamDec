// Posts the next pin in data/pin-queue.json to Pinterest.
//
// The board is the dedupe store: existing pins are read back and matched on their
// destination link, so a re-run never double-posts and CI holds no state file.
//
//   node publish-pins.mjs --dry-run     show what the next three runs would post
//   node publish-pins.mjs               post one pin
//   node publish-pins.mjs --status      queue position and token validity only
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const API = 'https://api.pinterest.com/v5';
const TOKEN_URL = 'https://api.pinterest.com/v5/oauth/token';

const args = new Set(process.argv.slice(2));
const flag = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

function readEnv() {
  const out = { ...process.env };
  const file = path.join(HERE, '.env');
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !out[m[1]]) out[m[1]] = m[2];
    }
  }
  return out;
}

const env = readEnv();
const token = env.PINTEREST_ACCESS_TOKEN;
if (!token && !args.has('--lint')) {
  console.error('No PINTEREST_ACCESS_TOKEN. Run `node pinterest-auth.mjs` first, or use --lint to check the queue offline.');
  process.exit(1);
}

async function api(pathname, init = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Print the whole body: Pinterest puts the useful text in `message` and the
    // generic `code: 1` on the same object, so showing only one hides the reason.
    throw new Error(`Pinterest ${init.method || 'GET'} ${pathname} -> ${res.status}: ${JSON.stringify(body).slice(0, 400)}`);
  }
  return body;
}

const queue = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'pin-queue.json'), 'utf8'));
// Same source the CSV generator uses, so a hand-uploaded row and an API-posted pin
// can never end up pointing at different origins.
const SITE = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'site.json'), 'utf8')).baseUrl.replace(/\/$/, '');

// A pin is "already posted" when the board holds a pin pointing at the same URL.
// Matching the link rather than the image survives a re-render of the creative.
const normalise = (u) => String(u ?? '').replace(/[?#].*$/, '').replace(/\/+$/, '');

async function resolveBoard() {
  if (env.PINTEREST_BOARD_ID) return env.PINTEREST_BOARD_ID;
  const mine = await api('/boards?field=id,name,owner&pagesize=100');
  const found = (mine.items ?? []).find((b) => b.name.toLowerCase() === queue.board.name.toLowerCase());
  if (found) return found.id;
  const created = await api('/boards', { method: 'POST', body: JSON.stringify(queue.board) });
  console.log(`Created board "${queue.board.name}" -> add PINTEREST_BOARD_ID=${created.id} to .env`);
  return created.id;
}

async function postedLinks(boardId) {
  const seen = new Set();
  let bookmark;
  do {
    const q = new URLSearchParams({ field: 'link,id', pagesize: '100', ...(bookmark ? { bookmark } : {}) });
    const page = await api(`/boards/${boardId}/pins?${q}`);
    for (const pin of page.items ?? []) seen.add(normalise(pin.link));
    bookmark = page.bookmark;
  } while (bookmark);
  return seen;
}

function imageSource(pin) {
  const local = path.join(HERE, 'dist', 'pins', pin.image);
  if (!fs.existsSync(local)) throw new Error(`${pin.image} is not in dist/pins/ — run \`node build.mjs\` and deploy first`);
  // Pinterest fetches this URL itself, so it has to be the deployed one, not a
  // file path. The site is the only host the pin images are published to.
  return `${SITE}/pins/${pin.image}`;
}

function checkLimits(pin) {
  const problems = [];
  if (pin.title.length > 100) problems.push(`title ${pin.title.length}/100 chars`);
  if (pin.note.length > 500) problems.push(`note ${pin.note.length}/500 chars`);
  if (!/affiliate/i.test(pin.note)) problems.push('note has no affiliate disclosure');
  try { imageSource(pin); } catch (e) { problems.push(e.message); }
  return problems;
}

let bad = 0;
for (const pin of queue.pins) {
  for (const problem of checkLimits(pin)) { console.error(`  ! ${pin.id}: ${problem}`); bad++; }
}
if (bad) { console.error(`\n${bad} queue entr(ies) violate Pinterest limits — fix data/pin-queue.json.`); process.exit(1); }

if (args.has('--lint')) {
  console.log(`Queue OK: ${queue.pins.length} pins, all within title/note limits, all disclosed, all images built.`);
  process.exit(0);
}

const boardId = await resolveBoard();

// Pinterest access tokens live ~30 days and refreshing rotates the refresh token,
// which CI cannot write back to a secret. So warn while there is still time to
// re-run `node pinterest-auth.mjs` locally and paste the new pair.
const expiresAt = env.PINTEREST_TOKEN_EXPIRES_AT;
if (expiresAt) {
  const daysLeft = (new Date(expiresAt).getTime() - Date.now()) / 86400000;
  if (daysLeft < 0) console.error(`WARNING: this access token expired ${new Date(expiresAt).toISOString()} — re-run pinterest-auth.mjs.`);
  else if (daysLeft < 7) console.error(`WARNING: this access token expires in ${Math.ceil(daysLeft)} days. Refreshing it here would rotate the refresh token, which Actions cannot save back to your secrets.`);
}

const already = await postedLinks(boardId);
const pending = queue.pins.filter((p) => !already.has(normalise(p.link)));

console.log(`Board ${boardId}: ${already.size} pin(s) already carry a DreamDec link.`);
for (const pin of queue.pins) {
  console.log(`  ${pending.includes(pin) ? 'queued ' : 'posted '} ${pin.id.padEnd(30)} ${imageSource(pin)}`);
}

if (args.has('--status')) process.exit(0);

const next = pending[0];
if (!next) {
  console.log('\nQueue is empty — every pin in data/pin-queue.json is on the board.');
  process.exit(0);
}

const payload = {
  board_id: boardId,
  link: next.link,
  title: next.title,
  note: next.note,
  media_source: { content_type: 'image_url', source_url: imageSource(next) },
};

// Pinterest fetches the creative itself, so a queue entry added before its
// deploy lands would post a pin with a broken image. Check the URL, not dist/.
const probe = await fetch(payload.media_source.source_url, { method: 'HEAD' });
if (!probe.ok) {
  console.error(`\nRefusing to post: ${payload.media_source.source_url} returned ${probe.status}.`);
  console.error('Deploy dist/ to Cloudflare Pages first — Pinterest downloads the image from that URL.');
  process.exit(1);
}

if (args.has('--dry-run')) {
  console.log(`\n--dry-run, nothing posted. Next pin would be:\n${JSON.stringify(payload, null, 2)}`);
  console.log(`\nRemaining after this one: ${pending.slice(1).map((p) => p.id).join(', ') || 'none'}`);
  process.exit(0);
}

const created = await api('/pins', { method: 'POST', body: JSON.stringify(payload) });
console.log(`\nPosted "${next.title}" -> ${created.url ?? created.id}`);
console.log(`Remaining in queue: ${pending.length - 1}`);

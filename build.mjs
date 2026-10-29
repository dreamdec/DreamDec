import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, 'dist');
const read = (name) => JSON.parse(fs.readFileSync(path.join(HERE, 'data', name), 'utf8'));

const site = read('site.json');
const { categories } = read('categories.json');
const { articles } = read('articles.json');
const { pages } = read('pages.json');

// Phones cache styles.css aggressively, so a CSS-only fix never reaches a reader
// who has already visited. Stamping the stylesheet with its content hash makes the
// next build force a reload.
const CSS_STAMP = crypto.createHash('sha1')
  .update(fs.readFileSync(path.join(HERE, 'src', 'styles.css')))
  .digest('hex').slice(0, 10);

const catBy = Object.fromEntries(categories.map((c) => [c.slug, c]));
const products = [];
for (const article of articles) {
  for (const slot of article.slots) products.push({ ...slot, article });
}
const productBy = Object.fromEntries(products.map((p) => [p.id, p]));

const dupes = products.filter((p, i) => products.findIndex((q) => q.id === p.id) !== i);
if (dupes.length) throw new Error(`Duplicate product ids in data/articles.json: ${[...new Set(dupes.map((d) => d.id))].join(', ')}`);

const warnings = [];
let warnedTag = false;

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function amazonHref(url) {
  if (!url) return null;
  if (!site.amazonTag) {
    if (!warnedTag) {
      warnings.push('amazonTag is null in data/site.json - outbound links carry no tracking tag, so no commission is attributed. Set it after Associates approval.');
      warnedTag = true;
    }
    return url;
  }
  try {
    const u = new URL(url);
    if (!/(^|\.)amazon\./i.test(u.hostname) && !/^amzn\./i.test(u.hostname)) return url;
    if (u.searchParams.has('tag')) return url;
    u.searchParams.set('tag', site.amazonTag);
    return u.toString();
  } catch {
    return url;
  }
}

const up = (depth) => '../'.repeat(depth);
const pad = (n) => String(n).padStart(2, '0');
const filled = (p) => Boolean(p.pick?.amazonUrl);

function awardName(slot) {
  const raw = slot.draftHeading ?? '';
  const i = raw.indexOf(':');
  return i === -1 ? { award: 'The pick', name: raw } : { award: raw.slice(0, i).trim(), name: raw.slice(i + 1).trim() };
}

function layout({ depth, file, title, description, image, body, jsonLd, section, abs }) {
  const home = abs ? `${site.baseUrl.replace(/\/$/, '')}/` : up(depth);
  const navAreas = categories.filter((c) => c.live)
    .map((c) => `<a href="${home}${c.slug}/">${esc(c.nav ?? c.title)}</a>`).join('');
  const canonical = site.baseUrl ? `<link rel="canonical" href="${esc(site.baseUrl.replace(/\/$/, ''))}/${file === 'index.html' ? '' : file.replace(/index\.html$/, '')}">` : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="theme-color" content="#fbf8f3">
<link rel="icon" href="${home}icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${home}apple-touch-icon.png">
${canonical}
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="${section ? 'article' : 'website'}">
<meta property="og:site_name" content="${esc(site.name)}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..600&family=Karla:ital,wght@0,400..700;1,400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${home}styles.css?v=${CSS_STAMP}">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
</head>
<body>
<a class="sr-only" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="${home}index.html"><svg class="brand-mark" viewBox="0 0 512 512" aria-hidden="true"><rect x="174" y="112" width="64" height="288" rx="32" fill="currentColor"/><path d="M215 118a139 139 0 0 1 0 276 190 190 0 0 0 0-276z" fill="var(--clay, #b45c37)"/></svg>Dream<span>Dec</span><small>Small-space decor</small></a>
    <nav class="nav" aria-label="Primary">
      ${navAreas}
      <a href="${home}about/">About</a>
      <a href="${home}contact/">Contact</a>
    </nav>
  </div>
</header>
<main class="wrap" id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap cols">
    <div>
      <span class="brand"><svg class="brand-mark" viewBox="0 0 512 512" aria-hidden="true"><rect x="174" y="112" width="64" height="288" rx="32" fill="currentColor"/><path d="M215 118a139 139 0 0 1 0 276 190 190 0 0 0 0-276z" fill="var(--clay, #b45c37)"/></svg>Dream<span>Dec</span></span>
      <p>${esc(site.tagline)}. Short lists of one product type, screened against the same constraints, for rooms you rent and cannot drill into.</p>
    </div>
    <div>
      <h4>Guides</h4>
      <ul>
${categories.filter((c) => c.live).map((c) => `        <li><a href="${home}${c.slug}/">${esc(c.title)}</a></li>`).join('\n')}
      </ul>
    </div>
    <div>
      <h4>Site</h4>
      <ul>
        <li><a href="${home}about/">About DreamDec</a></li>
        <li><a href="${home}disclosure/">Affiliate disclosure</a></li>
        <li><a href="${home}privacy/">Privacy policy</a></li>
        <li><a href="${home}contact/">Contact</a></li>
      </ul>
    </div>
    <p class="fine">${esc(site.disclosure)} ${esc(site.disclosureShort)}</p>
  </div>
</footer>
</body>
</html>`;
}

const disclosureAt = (depth) => `<div class="disclosure"><span>${esc(site.disclosureShort)}</span> <a href="${up(depth)}disclosure/">How we make money</a></div>`;

function pickCard(product, depth, index) {
  const cat = catBy[product.article.category];
  const isFilled = filled(product);
  const { award, name } = awardName(product);
  const title = isFilled ? product.pick.title : name;
  const href = amazonHref(product.pick?.amazonUrl);
  const pills = (product.lookingFor?.constraints ?? []).map((c) => `<li>${esc(c)}</li>`).join('');

  return `<section class="pick${isFilled ? '' : ' pending'}" id="${esc(product.id)}" aria-labelledby="t-${esc(product.id)}">
  <div class="pick-figure">
    <span class="rank" aria-hidden="true">${pad(index + 1)}</span>
    <div class="thumb">${isFilled && product.pick.image
      ? `<img src="${up(depth)}${esc(product.pick.image)}" alt="${esc(title)}" loading="lazy" decoding="async">`
      : `<div class="spec-tile"><p>${esc(isFilled ? (product.pick.spec || product.type) : product.type)}</p><span class="spec-tile-mark" aria-hidden="true"></span></div>`}</div>
  </div>
  <div>
    <span class="award-chip">${esc(award)}</span>
    <h3 id="t-${esc(product.id)}">${esc(title)}</h3>
    <p class="type">${esc(product.type)} <span class="meta">· ${esc(cat.title)}</span></p>
    ${isFilled && product.pick.spec ? `<p class="spec-line">${esc(product.pick.spec)}</p>` : ''}
    <ul class="pills">${pills}</ul>
    <p class="why">${isFilled ? esc(product.pick.verdict) : esc(product.whyItMatters)}</p>
    ${isFilled
      ? `<div class="price-row">${product.pick.price ? `<span class="price">${esc(product.pick.price)}</span>` : '<span class="price-note">Live price on Amazon</span>'}<a class="btn" href="${esc(href)}" rel="nofollow sponsored noopener" target="_blank">Shop on Amazon</a></div>${product.pick.needs ? `\n    <!-- still to confirm on ${esc(product.id)}: ${esc(product.pick.needs)} -->` : ''}`
      : `<!-- open slot ${esc(product.id)}: ${esc(product.pick.needs || 'fill amazonUrl, title, spec and verdict in data/articles.json')} -->
    <p class="slot-open-note">Not chosen yet — this slot is still open.</p>`}
  </div>
</section>`;
}

function statRow(items) {
  return `<div class="stat-row">${items.map((i) => `<span class="stat">${esc(i)}</span>`).join('')}</div>`;
}

function compareTable(article) {
  const rows = article.slots.map((slot, i) => {
    const p = productBy[slot.id];
    const { award, name } = awardName(slot);
    return `      <tr>
        <td>${pad(i + 1)}</td>
        <td class="award" data-label="Pick">${p.pick?.title ? esc(p.pick.title) : esc(name)}</td>
        <td data-label="Best for">${esc(award)}</td>
        <td data-label="How it fixes">${esc(slot.mount ?? '—')}</td>
      </tr>`;
  }).join('\n');
  return `<div class="compare">
  <table>
    <caption class="sr-only">All picks in this guide</caption>
    <thead><tr><th scope="col">#</th><th scope="col">Pick</th><th scope="col">Best for</th><th scope="col">How it fixes</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
</div>`;
}

function articlePage(article, depth) {
  const cat = catBy[article.category];
  const done = article.slots.filter(filled).length;
  const criteria = article.howWeChose.map((c) => `<li>${esc(c)}</li>`).join('');
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.metaDescription,
    dateModified: article.updated,
    author: { '@type': 'Organization', name: site.name },
    publisher: { '@type': 'Organization', name: site.name },
  };
  const body = `<p class="crumb"><a href="${up(depth)}index.html">Home</a> &rsaquo; <a href="${up(depth)}${cat.slug}/">${esc(cat.title)}</a></p>
<h1 class="guide-title">${esc(article.title)}</h1>
<p class="subtitle">${esc(article.subtitle)}</p>
${statRow([`${article.slots.length} picks compared`, `Updated ${article.updated}`, cat.title])}
${disclosureAt(depth)}
<div class="lede">${article.intro.map((p) => `<p>${esc(p)}</p>`).join('')}</div>
<div class="criteria">
  <h2>How we chose</h2>
  <ul class="checklist">${criteria}</ul>
</div>
<h2>At a glance</h2>
${compareTable(article)}
<h2>The picks</h2>
${article.slots.map((s, i) => pickCard(productBy[s.id], depth, i)).join('\n')}
${done < article.slots.length ? `<div class="draft-flag"><strong>In progress — ${done} of ${article.slots.length} picks chosen.</strong> <span>The remaining slots are still being screened.</span></div>` : ''}`;
  return { body, jsonLd };
}

function productPage(product, depth) {
  const article = product.article;
  const cat = catBy[article.category];
  const isFilled = filled(product);
  const { award, name } = awardName(product);
  const title = isFilled ? product.pick.title : name;
  const href = amazonHref(product.pick?.amazonUrl);
  const pills = (product.lookingFor?.constraints ?? []).map((c) => `<li>${esc(c)}</li>`).join('');
  return `<p class="crumb"><a href="${up(depth)}index.html">Home</a> &rsaquo; <a href="${up(depth)}${cat.slug}/">${esc(cat.title)}</a></p>
<div class="product-shell">
  <div class="product-hero">${isFilled && product.pick.image
    ? `<img src="${up(depth)}${esc(product.pick.image)}" alt="${esc(title)}">`
    : 'Photo to be added'}</div>
  <div>
    <span class="award-chip">${esc(award)}</span>
    <h1>${esc(title)}</h1>
    <p class="type">${esc(product.type)}</p>
    ${isFilled
      ? `<div class="price-row"><span class="price">${esc(product.pick.price)}</span><span class="price-note">Price checked at time of writing</span></div>
    <div class="actions">
      <a class="btn" href="${esc(href)}" rel="nofollow sponsored noopener" target="_blank">Shop on Amazon</a>
      <a class="btn ghost" href="${up(depth)}${cat.slug}/${article.slug}/">See the full list</a>
    </div>`
      : `<div class="actions">
      <span class="btn disabled">Not available yet</span>
      <a class="btn ghost" href="${up(depth)}${cat.slug}/${article.slug}/">See the full list</a>
    </div>
    <!-- fill pick for slot ${esc(product.id)} in data/articles.json -->
    <p class="slot-open-note">This slot is still open.</p>`}
    <div class="note-block">
      <h2>Why this one</h2>
      <p>${isFilled ? esc(product.pick.verdict) : esc(product.whyItMatters)}</p>
      <h2>What it had to clear</h2>
      <ul class="pills">${pills}</ul>
      <p class="meta">One of ${article.slots.length} compared in <a href="${up(depth)}${cat.slug}/${article.slug}/">${esc(article.title)}</a>.</p>
    </div>
  </div>
</div>
${disclosureAt(depth)}`;
}

function categoryPage(cat, depth) {
  const list = articles.filter((a) => a.category === cat.slug);
  const pickCount = list.reduce((n, a) => n + a.slots.length, 0);
  const cards = list.map((a, i) => `<article class="article-card">
  <span class="num" aria-hidden="true">${pad(i + 1)}</span>
  <div>
    <h3><a href="${up(depth)}${cat.slug}/${a.slug}/">${esc(a.title)}</a></h3>
    <p class="sub">${esc(a.subtitle)}</p>
    <p class="meta">${a.slots.length} picks · updated ${esc(a.updated)}</p>
  </div>
</article>`).join('\n');
  return `<p class="crumb"><a href="${up(depth)}index.html">Home</a> &rsaquo; ${esc(cat.title)}</p>
<div class="page-head">
  <p class="eyebrow">${cat.icon} &nbsp;Area</p>
  <h1>${esc(cat.title)}</h1>
  <p class="subtitle">${esc(cat.blurb)}</p>
  ${statRow([`${list.length} guides`, `${pickCount} picks compared`, 'Renter-safe only'])}
</div>
${disclosureAt(depth)}
<div class="section article-list">
${cards}
</div>
${cat.amazonSearchUrl
  ? `<p><a class="btn" href="${esc(amazonHref(cat.amazonSearchUrl))}" rel="nofollow sponsored noopener" target="_blank">Shop this area on Amazon</a></p>`
  : `<!-- to add the category button: generate a SiteStripe link with your tracking ID, then set amazonSearchUrl in data/categories.json -->
  <p class="meta">Full buying guides for this area are listed above.</p>`}`;
}

function homePage(depth) {
  const live = categories.filter((c) => c.live).map((c) => {
    const count = articles.filter((a) => a.category === c.slug).length;
    const picks = articles.filter((a) => a.category === c.slug).reduce((n, a) => n + a.slots.length, 0);
    return `<a class="area" href="${up(depth)}${c.slug}/">
  <div class="icon">${c.icon}</div>
  <h3>${esc(c.title)}</h3>
  <p>${esc(c.blurb)}</p>
  <p class="meta">${count} guide${count === 1 ? '' : 's'} · ${picks} picks</p>
</a>`;
  });
  const soon = categories.filter((c) => !c.live).map((c) => `<div class="area soon">
  <div class="icon">${c.icon}</div>
  <h3>${esc(c.title)}</h3>
  <p>${esc(c.blurb)}</p>
  <span class="badge-soon">Coming soon</span>
</div>`);
  const swatchColors = ['#b45c37', '#6d7f61', '#a87d21', '#e8dfd0', '#211d18'];
  return `<section class="hero">
  <p class="eyebrow">For rooms you rent and cannot drill into</p>
  <h1>${esc(site.tagline)}</h1>
  <p class="lede">${esc(site.description)}</p>
  <div class="swatches" aria-hidden="true">${swatchColors.map((c) => `<i style="background:${c}"></i>`).join('')}</div>
  ${disclosureAt(depth)}
</section>
<section class="section">
  <div class="section-title"><h2>Where we publish now</h2></div>
  <div class="area-grid">${live.join('\n')}</div>
</section>
<section class="section">
  <div class="section-title"><h2>Next on the list</h2></div>
  <div class="area-grid">${soon.join('\n')}</div>
</section>`;
}

function staticPage(page, depth) {
  const body = page.body.map((p) => `<p>${esc(p)}</p>`).join('');
  return `<p class="crumb"><a href="${up(depth)}index.html">Home</a> &rsaquo; ${esc(page.title)}</p>
<div class="page-head"><h1>${esc(page.title)}</h1></div>
<div class="prose">${body}${page.slug === 'contact' ? `<p class="mailto-row">Email: <a class="mailto" href="mailto:${esc(site.contactEmail)}">${esc(site.contactEmail)}</a></p>` : ''}</div>`;
}

// ---------- render ----------
fs.rmSync(DIST, { recursive: true, force: true });
const written = [];
function write(relPath, html) {
  const target = path.join(DIST, relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, html, 'utf8');
  written.push(relPath.replace(/\\/g, '/'));
}
const titled = (t) => `${t} | ${site.name}`;

write('index.html', layout({
  depth: 0, file: 'index.html', title: titled(site.name), description: site.description, body: homePage(0),
}));

for (const cat of categories.filter((c) => c.live)) {
  const depth = 1;
  const file = `${cat.slug}/index.html`;
  write(file, layout({ depth, file, title: titled(cat.title), description: cat.blurb, body: categoryPage(cat, depth) }));
}

for (const article of articles) {
  const depth = 2;
  const file = `${article.category}/${article.slug}/index.html`;
  const { body, jsonLd } = articlePage(article, depth);
  write(file, layout({ depth, file, title: titled(article.metaTitle || article.title), description: article.metaDescription, body, jsonLd, section: true }));
}

for (const product of products) {
  const depth = 2;
  const file = `p/${product.id}/index.html`;
  const title = filled(product) ? product.pick.title : awardName(product).name;
  write(file, layout({
    depth, file,
    title: titled(title),
    description: `${title}. ${product.type} - one of ${product.article.slots.length} picks compared in ${product.article.title}.`,
    image: product.pick?.image ? `${site.baseUrl.replace(/\/$/, '')}/${product.pick.image}` : null,
    body: productPage(product, depth),
    section: true,
  }));
}

for (const page of pages) {
  const depth = 1;
  const file = `${page.slug}/index.html`;
  write(file, layout({ depth, file, title: titled(page.title), description: page.metaDescription, body: staticPage(page, depth) }));
}

fs.copyFileSync(path.join(HERE, 'src', 'styles.css'), path.join(DIST, 'styles.css'));
for (const asset of fs.readdirSync(path.join(HERE, 'src'))) {
  if (/\.(svg|png|jpe?g)$/i.test(asset)) fs.copyFileSync(path.join(HERE, 'src', asset), path.join(DIST, asset));
}

// Cloudflare Pages serves this with a real 404 status; without it, unknown paths
// fall back to the home document at 200, which Google treats as a soft 404.
if (site.baseUrl) {
  const base = site.baseUrl.replace(/\/$/, '');
  write('404.html', layout({
    depth: 0, file: '404.html', abs: true,
    title: titled('Page not found'),
    description: 'That page does not exist on DreamDec. The live guides are linked from the home page.',
    body: `<div class="page-head">
  <p class="eyebrow">Error 404</p>
  <h1>That page isn't here</h1>
  <p class="subtitle">The link may be mistyped, or a guide may not have been published yet.</p>
</div>
<div class="section article-list">
${categories.filter((c) => c.live).map((c) => `<article class="article-card">
  <span class="num" aria-hidden="true">${c.icon}</span>
  <div><h3><a href="${base}/${c.slug}/">${esc(c.title)}</a></h3><p class="sub">${esc(c.blurb)}</p></div>
</article>`).join('\n')}
</div>
<p><a class="btn" href="${base}/">Back to the home page</a></p>`,
  }));
}

const pinPlan = [];
for (const article of articles) {
  const done = article.slots.filter(filled).length;
  pinPlan.push({
    type: 'collage',
    article: article.slug,
    landsOn: `${article.category}/${article.slug}/`,
    productsInFrame: article.slots.length,
    ready: done === article.slots.length,
    pinTitle: article.pinTitle,
    pinDescription: article.pinDescription,
    note: 'Split into two collages above 4 products - a 7-8 product frame is unreadable at phone size.',
  });
  for (const slot of article.slots) {
    pinPlan.push({
      type: 'product',
      id: slot.id,
      landsOn: `p/${slot.id}/`,
      ready: Boolean(productBy[slot.id].pick?.amazonUrl),
      pinTitle: productBy[slot.id].pick?.title ?? productBy[slot.id].draftHeading,
    });
  }
}
write('pin-plan.json', JSON.stringify({ generatedFrom: 'data/articles.json', cadence: '3 per day while the account is new', pins: pinPlan }, null, 2));

if (site.baseUrl) {
  const urls = written.filter((f) => f.endsWith('.html') && f !== '404.html')
    .map((f) => `${site.baseUrl.replace(/\/$/, '')}/${f === 'index.html' ? '' : f.replace(/index\.html$/, '')}`);
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n')}\n</urlset>`);
  fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site.baseUrl.replace(/\/$/, '')}/sitemap.xml\n`, 'utf8');
} else {
  fs.writeFileSync(path.join(DIST, 'robots.txt'), 'User-agent: *\nAllow: /\n', 'utf8');
  warnings.push('baseUrl is null in data/site.json - no sitemap.xml written. Set it once the host gives you the live URL, then rerun the build.');
}

if (String(site.contactEmail).includes('example.com')) warnings.push('contactEmail is still the placeholder - Amazon Associates requires a working contact address visible on the site.');
if (!site.amazonTag) warnings.push('amazonTag not set - add your Associates tracking ID after approval and rebuild; every outbound link gets tagged.');

console.log(`DreamDec build: ${written.length} files in dist/`);
console.log(`  ${products.length} product slots, ${products.filter(filled).length} filled`);
if (warnings.length) console.log('\nBefore this site goes public:\n  - ' + warnings.join('\n  - '));

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');

const htmlFiles = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return htmlFiles(full);
    return e.name.endsWith('.html') ? [full] : [];
  });

let checked = 0;
const broken = [];

for (const file of htmlFiles(DIST)) {
  const html = fs.readFileSync(file, 'utf8');
  for (const match of html.matchAll(/href="([^"#]+)"/g)) {
    const [href] = match[1].split('?');
    if (/^(https?:|mailto:)/.test(href)) continue;
    checked += 1;
    const target = path.resolve(path.dirname(file), href);
    if (!fs.existsSync(target)) {
      broken.push(`${path.relative(DIST, file)} -> ${href} (missing)`);
    } else if (fs.statSync(target).isDirectory() && !fs.existsSync(path.join(target, 'index.html'))) {
      broken.push(`${path.relative(DIST, file)} -> ${href} (directory has no index.html)`);
    }
  }
}

console.log(`${checked} internal links checked across ${htmlFiles(DIST).length} pages`);
if (broken.length) {
  console.log(`BROKEN (${broken.length}):`);
  for (const b of broken) console.log('  - ' + b);
  process.exit(1);
}
console.log('all internal links resolve');

# DreamDec

Small static affiliate site. No frameworks, no dependencies — plain Node.
Content lives in `data/*.json`, and `build.mjs` turns it into `dist/`.

## Run it

```
node build.mjs
```

Then open `dist/index.html` in a browser. That is the whole workflow: edit JSON, rebuild, the HTML is regenerated.

## Filling a product slot

Every guide has open slots. A slot is a *type of product plus the constraints it had to clear* — the real Amazon listing goes in `pick`.

Open `data/articles.json`, find the article, find the slot by its `id`, and fill the five fields:

```json
"pick": {
  "title": "Songmics 2-Tier Bathroom Storage Cabinet",
  "amazonUrl": "https://www.amazon.com/dp/B0XXXXXXXX/",
  "price": "$46.99",
  "image": "https://…",
  "verdict": "Holds the most per square inch of anything here, and the doors clear a bed frame."
}
```

- `amazonUrl` — copy it from the product page address bar. Do not shorten it and do not route it through a redirect service; Amazon treats cloaked links as a suspendable offence.
- `price` — write it as text. Prices from Amazon can only be shown if they come from the Product Advertising API, so until we have PA-API access this is a manual, clearly-labelled figure.
- `image` — same rule. Until PA-API, use an image you own or an API-supplied URL, not one copied off the listing.
- `verdict` — your one-line reason it won the slot. This is what makes the page worth reading.

Rebuild afterwards: `node build.mjs`.

## Setting the tracking tag

`data/site.json` → `"amazonTag"`. Put your Associates tracking ID there once you have one, rebuild, and every outbound Amazon link gets `?tag=` appended automatically. Until then links carry no tag and earn nothing.

`data/site.json` → `"baseUrl"`. Set it to the live `https://…` address once deployed. The build then writes `sitemap.xml` and a robots.txt pointing at it. All internal links are relative, so changing the domain never requires touching a page.

`data/site.json` → `"contactEmail"`. Amazon's review looks for a working contact address on the site.

## What is where

| Path | Purpose |
| --- | --- |
| `data/site.json` | brand, disclosure, tag, domain, contact |
| `data/categories.json` | your 8 areas; 2 are live, 6 show as coming soon |
| `data/articles.json` | the 4 launch guides and all 28 slots |
| `data/pages.json` | about, disclosure, privacy, contact |
| `src/styles.css` | the look |
| `dist/` | generated output — deploy this folder, don't edit it |
| `dist/pin-plan.json` | every pin target, in the order the pins should be made |

## Per-page URLs

A slot with id `adhesive-floating-shelf-pair` publishes at `/p/adhesive-floating-shelf-pair/`. Those pages are the Pinterest landing targets: one product, a Shop on Amazon button, and a "see the full list it came from" link back to the guide. Per your spec, the guides do **not** link out to those pages — they are reachable by the pin URL and by the sitemap only.

## Deploying

Pushing to `main` deploys automatically: `.github/workflows/deploy.yml` runs `build.mjs`, then `check-links.mjs` (a broken internal link fails the run, so nothing is deployed), then uploads `dist/` to the `dreamdec` Cloudflare Pages project. Live at `https://dreamdec.pages.dev/`.

One-time setup, done in GitHub because the token must never be committed — **Settings → Secrets and variables → Actions → New repository secret**, twice:

| Name | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | the same scoped Pages-edit token that is in your local `.env` |
| `CLOUDFLARE_ACCOUNT_ID` | `97b2f06225cf02f8924a9544ebf6c45e` |

The project's production branch is `main`, so those pushes update the live site directly instead of creating a preview URL.

To deploy by hand — for example to ship a rebuild without a commit — run `npx wrangler pages deploy dist --project-name dreamdec` from this folder, or trigger it from **Actions → Deploy → Run workflow**.

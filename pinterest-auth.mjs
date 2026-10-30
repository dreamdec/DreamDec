import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENV_FILE = path.join(HERE, '.env');
const PORT = 8756;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;
const SCOPES = ['user_accounts:read', 'boards:read', 'boards:write', 'pins:read', 'pins:write'].join(' ');
const TOKEN_URL = 'https://api.pinterest.com/v5/oauth/token';

function readEnv() {
  if (!fs.existsSync(ENV_FILE)) return {};
  const out = {};
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function writeEnv(updates) {
  const current = readEnv();
  const merged = { ...current, ...updates };
  const body = Object.entries(merged).map(([k, v]) => `${k}=${v}`).join('\n');
  fs.writeFileSync(ENV_FILE, `${body}\n`, 'utf8');
}

async function exchange(params, credentials) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${credentials.id}:${credentials.secret}`).toString('base64')}`,
    },
    body: new URLSearchParams(params).toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Pinterest rejected the token exchange (${res.status}): ${JSON.stringify(json)}`);
  return json;
}

// Most v5 payloads arrive wrapped in { code, data }; the OAuth body came back flat.
// Accept either rather than guessing, or the token is silently written as undefined.
const payload = (json) => (json?.data?.access_token ? json.data : json);

// The authorization-code response carries expires_in (seconds), not an absolute
// timestamp, and the expiry is what tells the publisher to warn before the token
// goes stale. Turn it into a date here so every consumer can compare it directly.
function expiresAt(t) {
  if (t.access_token_expires_at) return t.access_token_expires_at;
  const secs = Number(t.expires_in);
  return secs ? new Date(Date.now() + secs * 1000).toISOString() : '';
}

function waitForCode() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      if (url.pathname !== '/callback') return res.writeHead(404).end();
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error_description') || url.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(error
        ? `<h2>Pinterest said no</h2><p>${error}</p><p>You can close this tab.</p>`
        : '<h2>DreamDec is connected</h2><p>You can close this tab and come back to the terminal.</p>');
      server.close();
      if (error) return reject(new Error(error));
      resolve(code);
    });
    server.on('error', reject);
    server.listen(PORT, () => console.log(`\nWaiting for the callback on ${REDIRECT_URI} ...`));
  });
}

const env = readEnv();
const id = process.env.PINTEREST_CLIENT_ID || env.PINTEREST_CLIENT_ID;
const secret = process.env.PINTEREST_CLIENT_SECRET || env.PINTEREST_CLIENT_SECRET;

if (!id || !secret) {
  console.error('Missing PINTEREST_CLIENT_ID and/or PINTEREST_CLIENT_SECRET in E:\\DreamDec\\.env');
  console.error('Copy both from developers.pinterest.com > your app, save them in .env, then run this again.');
  process.exit(1);
}

const flagCode = process.argv.find((a) => a.startsWith('--code='))?.slice(7);
const isRefresh = process.argv.includes('--refresh');

let token;
if (isRefresh) {
  // Pinterest rotates the refresh token on every refresh, so this only ever runs
  // locally, where .env can hold the new pair. CI cannot write repository secrets.
  if (!env.PINTEREST_REFRESH_TOKEN) {
    console.error('No PINTEREST_REFRESH_TOKEN in .env - run `node pinterest-auth.mjs` without flags first.');
    process.exit(1);
  }
  console.log('\nRefreshing the access token with the stored refresh token ...');
  token = await exchange({ refresh_token: env.PINTEREST_REFRESH_TOKEN, grant_type: 'refresh_token' }, { id, secret });
} else {
  const authorizeUrl = `https://www.pinterest.com/oauth/?${new URLSearchParams({
    client_id: id,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
  })}`;

  console.log('\nOpen this in a browser where you are already signed in to Pinterest:\n');
  console.log(authorizeUrl);
  console.log(`\nApprove the request. If the browser shows "redirect refused", copy the full address bar URL`);
  console.log(`and re-run as:  node pinterest-auth.mjs --code=<the code= value>\n`);

  const code = flagCode || (await waitForCode());
  token = await exchange({ code, grant_type: 'authorization_code', redirect_uri: REDIRECT_URI }, { id, secret });
}

const t = payload(token);
if (!t.access_token) throw new Error(`Pinterest returned no access_token: ${JSON.stringify(token).slice(0, 300)}`);

writeEnv({
  PINTEREST_ACCESS_TOKEN: t.access_token,
  PINTEREST_REFRESH_TOKEN: t.refresh_token ?? env.PINTEREST_REFRESH_TOKEN ?? '',
  PINTEREST_TOKEN_EXPIRES_AT: expiresAt(t),
  PINTEREST_CLIENT_ID: id,
  PINTEREST_CLIENT_SECRET: secret,
});

console.log(`Connected as @${t.user?.username ?? '(unknown)'}.`);
console.log(`Scopes granted: ${t.scope ?? SCOPES}`);
console.log(`Access token expires: ${expiresAt(t) || 'unknown - Pinterest returned no expiry'}`);
console.log('Tokens were written to E:\\DreamDec\\.env (git-ignored, never sent anywhere).');

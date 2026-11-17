import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, renameSync, mkdirSync, openSync, closeSync, unlinkSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { pathToFileURL } from 'node:url';

const DEFAULT_PRIVATE = join(homedir(), '.codex', '.chatgpt-projects', 'g-p-6aabb55f14b8819192b8a0d2bee9108b');
export const BOOKMARK_SCOPES = ['tweet.read', 'users.read', 'bookmark.read', 'offline.access'];
export const CALLBACK = 'http://127.0.0.1:8765/callback';

function paths(dir) {
  return { secret: join(dir, 'x-bookmark-auth.json'), lock: join(dir, 'x-bookmark-auth.lock') };
}

function readAuth(dir) {
  try {
    return JSON.parse(readFileSync(paths(dir).secret, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error('The private bookmark credential file could not be read.');
  }
}

function saveAuth(dir, data) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = paths(dir).secret;
  const temporary = path + '.' + randomBytes(8).toString('hex') + '.tmp';
  writeFileSync(temporary, JSON.stringify(data) + '\n', { mode: 0o600, flag: 'wx' });
  renameSync(temporary, path);
}

function acquire(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const lock = paths(dir).lock;
  try {
    const fd = openSync(lock, 'wx', 0o600);
    closeSync(fd);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    // Covers the ten-minute authorization callback and bounded network requests.
    if (Date.now() - statSync(lock).mtimeMs < 15 * 60_000) throw new Error('Bookmark authorization or refresh is already in progress.');
    unlinkSync(lock);
    const fd = openSync(lock, 'wx', 0o600);
    closeSync(fd);
  }
  return () => unlinkSync(lock);
}

export async function exchangeToken(parameters, { request = fetch, env = process.env } = {}) {
  const clientId = env.X_OAUTH_CLIENT_ID?.trim();
  if (!clientId) throw new Error('Set X_OAUTH_CLIENT_ID in .env. The OAuth 2.0 Client ID is separate from the consumer key.');
  const body = new URLSearchParams(parameters);
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (env.X_OAUTH_CLIENT_SECRET) {
    headers.Authorization = 'Basic ' + Buffer.from(clientId + ':' + env.X_OAUTH_CLIENT_SECRET).toString('base64');
  } else {
    body.set('client_id', clientId);
  }
  let response;
  try {
    response = await request('https://api.x.com/2/oauth2/token', {
      method: 'POST', headers, body, redirect: 'error', signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error('X token exchange failed. No credentials were printed. Retry authorization if renewal cannot recover.');
  }
  if (!response.ok) throw new Error('X token exchange returned HTTP ' + response.status + '. Check app settings or authorize again.');
  let token;
  try { token = await response.json(); } catch { throw new Error('X returned an unreadable token response.'); }
  if (typeof token.access_token !== 'string' || !Number.isFinite(token.expires_in) || token.expires_in <= 0) {
    throw new Error('X returned an invalid token response.');
  }
  return token;
}

function credential(token, previous = {}) {
  const scopes = (token.scope ?? previous.scope ?? '').split(' ');
  if (BOOKMARK_SCOPES.some(scope => !scopes.includes(scope))) throw new Error('The token does not grant all required read and renewal scopes.');
  const refresh = token.refresh_token ?? previous.refresh_token;
  if (!refresh) throw new Error('X did not return a refresh token. Authorize with offline.access.');
  return {
    ...previous,
    access_token: token.access_token,
    refresh_token: refresh,
    scope: scopes.join(' '),
    expires_at: Date.now() + token.expires_in * 1000,
  };
}

export function bookmarkAuthStatus(dir) {
  try {
    const auth = readAuth(dir);
    return { configured: Boolean(auth?.access_token && auth?.refresh_token && /^\d{1,19}$/.test(auth?.user_id ?? '')),
      renewable: Boolean(auth?.refresh_token),
      expiresAt: Number.isFinite(auth?.expires_at) ? new Date(auth.expires_at).toISOString() : null };
  } catch {
    // A broken bookmark credential must not prevent independent public discovery.
    return { configured: false, renewable: false, error: 'Private bookmark authorization needs repair or reauthorization.' };
  }
}

export async function bookmarkCredentials(dir, { request = fetch } = {}) {
  const release = acquire(dir);
  try {
    let auth = readAuth(dir);
    if (!auth?.access_token || !auth?.refresh_token || !auth?.user_id || !/^\d{1,19}$/.test(auth.user_id)) throw new Error('Bookmark authorization is incomplete. Run x-bookmark-auth.mjs authorize.');
    if (!Number.isFinite(auth.expires_at) || auth.expires_at <= Date.now() + 60_000) {
      const token = await exchangeToken({ grant_type: 'refresh_token', refresh_token: auth.refresh_token }, { request });
      auth = credential(token, auth);
      saveAuth(dir, auth);
    }
    return { userId: auth.user_id, accessToken: auth.access_token };
  } finally {
    release();
  }
}

export function authorizationRequest(clientId) {
  if (!clientId) throw new Error('Set X_OAUTH_CLIENT_ID in .env before authorizing bookmarks.');
  const verifier = randomBytes(32).toString('base64url');
  const state = randomBytes(32).toString('base64url');
  const url = new URL('https://x.com/i/oauth2/authorize');
  url.search = new URLSearchParams({
    response_type: 'code', client_id: clientId, redirect_uri: CALLBACK,
    scope: BOOKMARK_SCOPES.join(' '), state,
    code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
  });
  return { verifier, state, url: url.href };
}

async function authorize(dir) {
  const flow = authorizationRequest(process.env.X_OAUTH_CLIENT_ID?.trim());
  const release = acquire(dir);
  const server = createServer();
  const timeout = setTimeout(() => server.close(), 10 * 60_000);
  try {
    const code = await new Promise((accept, reject) => {
      server.on('error', () => reject(new Error('Could not bind the loopback callback on port 8765.')));
      server.on('close', () => reject(new Error('Authorization timed out. Run authorize again.')));
      server.on('request', (req, res) => {
        const callback = new URL(req.url, CALLBACK);
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        if (req.method !== 'GET' || callback.pathname !== '/callback' || req.headers.host !== '127.0.0.1:8765') {
          res.writeHead(404).end('Unknown callback.'); return;
        }
        if (callback.searchParams.get('state') !== flow.state) {
          res.writeHead(400).end('Authorization state mismatch.'); return;
        }
        if (callback.searchParams.has('error') || !callback.searchParams.get('code')) {
          res.writeHead(400).end('Authorization was declined.');
          reject(new Error('Bookmark authorization was declined.')); return;
        }
        res.end('Authorization received. You can close this tab. The local command will confirm the connection.');
        accept(callback.searchParams.get('code'));
      });
      server.listen(8765, '127.0.0.1', () => {
        console.log('Open this URL and authorize read access to all bookmarks:');
        console.log(flow.url);
        console.log('Waiting up to ten minutes for the loopback callback.');
      });
    });
    const token = await exchangeToken({
      grant_type: 'authorization_code', code, redirect_uri: CALLBACK, code_verifier: flow.verifier,
    });
    const auth = credential(token);
    const me = await fetch('https://api.x.com/2/users/me', {
      headers: { Authorization: 'Bearer ' + auth.access_token }, redirect: 'error', signal: AbortSignal.timeout(15_000),
    });
    if (!me.ok) throw new Error('X account identification returned HTTP ' + me.status + '. Authorization was not saved.');
    let user;
    try { user = await me.json(); } catch { throw new Error('X returned an unreadable account response.'); }
    if (!/^\d{1,19}$/.test(user.data?.id ?? '')) throw new Error('X returned no numeric account ID.');
    saveAuth(dir, { ...auth, user_id: user.data.id, authorized_at: new Date().toISOString() });
    console.log('Bookmark read authorization saved privately. Daily renewal is ready.');
  } finally {
    clearTimeout(timeout);
    server.close();
    release();
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.umask(0o077);
  const dir = resolve(process.env.LATENT_MATINEE_PRIVATE_DIR || DEFAULT_PRIVATE);
  const repo = resolve(new URL('..', import.meta.url).pathname);
  if (dir === repo || dir.startsWith(repo + '/')) throw new Error('Bookmark credentials must stay outside the repository.');
  try {
    const command = process.argv[2] ?? 'status';
    if (command === 'status') console.log(JSON.stringify(bookmarkAuthStatus(dir), null, 2));
    else if (command === 'authorize') await authorize(dir);
    else throw new Error('Use status or authorize.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

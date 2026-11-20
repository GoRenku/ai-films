// Read-only YouTube Data API v3 helper for Latent Matinee research.
// Uses an API key only: no Google account, cookies, browser or watch history.
// The key is read from YOUTUBE_API_KEY (git-ignored .env) and sent in a header, never in a URL or output.
import { readFileSync, readdirSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const API = 'https://www.googleapis.com/youtube/v3';
const DAILY_UNITS = 8000; // Local ceiling below Google's free 10,000-unit daily quota.
const COST = { videos: 1, channels: 1, playlistItems: 1, search: 100 };
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PRIVATE = join(homedir(), '.codex', '.chatgpt-projects', 'g-p-6aabb55f14b8819192b8a0d2bee9108b');
const pacific = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' });
const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
const channelIdPattern = /^UC[A-Za-z0-9_-]{22}$/;

export function videoId(input) {
  const value = String(input ?? '').trim();
  if (videoIdPattern.test(value)) return value;
  let url;
  try { url = new URL(value); } catch { return undefined; }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  if (host === 'youtu.be') return videoIdPattern.test(url.pathname.slice(1)) ? url.pathname.slice(1) : undefined;
  if (host !== 'youtube.com' && host !== 'youtube-nocookie.com') return undefined;
  const v = url.searchParams.get('v');
  if (v && videoIdPattern.test(v)) return v;
  const match = /^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/.exec(url.pathname);
  return match?.[1];
}

export function channelRef(input) {
  const value = String(input ?? '').trim();
  if (channelIdPattern.test(value)) return { id: value };
  if (/^@[A-Za-z0-9._-]{3,30}$/.test(value)) return { handle: value };
  let url;
  try { url = new URL(value); } catch { return undefined; }
  if (url.hostname.replace(/^(www|m)\./, '') !== 'youtube.com') return undefined;
  const id = /^\/channel\/(UC[A-Za-z0-9_-]{22})/.exec(url.pathname)?.[1];
  if (id) return { id };
  const handle = /^\/(@[A-Za-z0-9._-]{3,30})/.exec(decodeURIComponent(url.pathname))?.[1];
  return handle ? { handle } : undefined;
}

export function seconds(iso) {
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso ?? '');
  if (!m) return undefined;
  const [, d, h, min, s] = m.map(part => Number(part ?? 0));
  return ((d * 24 + h) * 60 + min) * 60 + s;
}

export function clock(total) {
  if (total === undefined) return undefined;
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(s).padStart(2, '0');
}

export const uploadsPlaylist = channelId => 'UU' + channelId.slice(2);

const normalise = text => String(text).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

function privateDirectory() {
  const dir = resolve(process.env.LATENT_MATINEE_PRIVATE_DIR || DEFAULT_PRIVATE);
  const repo = resolve(SCRIPT_DIR, '..');
  if (dir === repo || dir.startsWith(repo + '/')) throw new Error('YouTube state must be outside the repository.');
  return dir;
}

function openState(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(dir, 'youtube.sqlite3'));
  db.exec(`
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS usage (day TEXT PRIMARY KEY, units INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS channels (id TEXT PRIMARY KEY, last_seen TEXT, last_sweep TEXT);
  `);
  return db;
}

function client({ db, now, request }) {
  const key = process.env.YOUTUBE_API_KEY;
  const day = pacific.format(now);
  const used = () => db.prepare('SELECT units FROM usage WHERE day = ?').get(day)?.units ?? 0;
  async function call(resource, params) {
    if (!key) throw new Error('YOUTUBE_API_KEY is not configured. Add it to the git-ignored .env.');
    const cost = COST[resource];
    if (used() + cost > DAILY_UNITS) throw new Error(`Local YouTube quota ceiling reached (${used()}/${DAILY_UNITS} units for ${day} Pacific).`);
    // Reserve before sending so a crash or timeout still counts.
    db.prepare('INSERT INTO usage (day, units) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET units = units + excluded.units').run(day, cost);
    const response = await (request ?? fetch)(`${API}/${resource}?${new URLSearchParams(params)}`, {
      headers: { 'X-Goog-Api-Key': key, Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const reason = (body.error?.errors ?? []).map(e => e.reason).join(',') || response.status;
      const error = new Error(`YouTube ${resource} failed: ${reason}`);
      error.reason = reason;
      throw error;
    }
    return body;
  }
  return { call, used, day };
}

function describe(item, full) {
  const snippet = item.snippet ?? {}, details = item.contentDetails ?? {}, status = item.status ?? {};
  const total = seconds(details.duration);
  const thumbs = snippet.thumbnails ?? {};
  const best = thumbs.maxres ?? thumbs.standard ?? thumbs.high ?? thumbs.medium ?? thumbs.default;
  const description = snippet.description ?? '';
  return {
    id: item.id, url: 'https://www.youtube.com/watch?v=' + item.id,
    title: snippet.title, channelId: snippet.channelId, channelTitle: snippet.channelTitle, publishedAt: snippet.publishedAt,
    durationSeconds: total, duration: clock(total), likelyShort: total !== undefined && total <= 60,
    embeddable: status.embeddable, privacy: status.privacyStatus, upload: status.uploadStatus, live: snippet.liveBroadcastContent,
    regionBlocked: details.regionRestriction?.blocked, thumbnail: best && { url: best.url, width: best.width, height: best.height },
    description: full ? description : description.slice(0, 500) + (description.length > 500 ? '…' : ''),
  };
}

async function videos(api, ids, full) {
  const out = [];
  for (let i = 0; i < ids.length; i += 50) {
    const body = await api.call('videos', { part: 'snippet,contentDetails,status', id: ids.slice(i, i + 50).join(','), maxResults: '50' });
    out.push(...(body.items ?? []).map(item => describe(item, full)));
  }
  const found = new Set(out.map(v => v.id));
  return { videos: out, unavailable: ids.filter(id => !found.has(id)) };
}

async function resolveChannel(api, input) {
  const ref = channelRef(input);
  if (!ref) throw new Error('Use a channel ID, @handle or youtube.com channel URL.');
  const body = await api.call('channels', { part: 'snippet', ...(ref.id ? { id: ref.id } : { forHandle: ref.handle }) });
  const item = body.items?.[0];
  if (!item) return { input, found: false };
  return { input, found: true, id: item.id, title: item.snippet?.title, handle: item.snippet?.customUrl, uploads: uploadsPlaylist(item.id) };
}

async function uploads(api, channelId, { since, pages = 1 } = {}) {
  const ids = [];
  let pageToken;
  for (let page = 0; page < pages; page++) {
    const body = await api.call('playlistItems', { part: 'contentDetails', playlistId: uploadsPlaylist(channelId), maxResults: '50', ...(pageToken ? { pageToken } : {}) });
    const items = body.items ?? [];
    const fresh = items.filter(item => !since || (item.contentDetails?.videoPublishedAt ?? '') > since);
    ids.push(...fresh.map(item => item.contentDetails.videoId));
    pageToken = body.nextPageToken;
    if (!pageToken || fresh.length < items.length) break;
  }
  return ids;
}

function registry() {
  const data = JSON.parse(readFileSync(join(SCRIPT_DIR, 'youtube-channels.json'), 'utf8'));
  const seen = new Set();
  for (const channel of data.channels) {
    if (!channelIdPattern.test(channel.id) || seen.has(channel.id)) throw new Error('Channel registry contains an invalid or repeated ID: ' + channel.id);
    seen.add(channel.id);
  }
  return data.channels;
}

const flag = (args, name) => { const i = args.indexOf(name); return i >= 0 ? args.splice(i, 2)[1] : undefined; };

// Every YouTube watch link in film frontmatter (film-level and episode-level).
export function catalogueWatchLinks(filmsDir = join(SCRIPT_DIR, '..', 'content', 'films')) {
  const links = [];
  for (const file of readdirSync(filmsDir).filter(name => name.endsWith('.md')).sort()) {
    const front = readFileSync(join(filmsDir, file), 'utf8').split(/\n---\s*\n/)[0];
    const status = /^status:\s*"?([^"\n]+)"?/m.exec(front)?.[1];
    for (const match of front.matchAll(/"?watchUrl"?:\s*"([^"]+)"/g)) {
      const id = videoId(match[1]);
      if (id) links.push({ film: file.replace(/\.md$/, ''), status, url: match[1], id });
    }
  }
  return links;
}

export async function runYouTube({ argv, dir, now = Date.now(), request, channels } = {}) {
  const args = [...(argv ?? process.argv.slice(2))];
  const command = args.shift() ?? 'status';
  const root = dir ?? privateDirectory();
  process.umask(0o077);
  const db = openState(root);
  const api = client({ db, now, request });
  try {
    if (command === 'status') {
      const list = channels ?? registry();
      const swept = db.prepare('SELECT COUNT(*) AS n, MIN(last_sweep) AS oldest FROM channels WHERE last_sweep IS NOT NULL').get();
      return { pacificDay: api.day, unitsUsedToday: api.used(), localDailyCeiling: DAILY_UNITS, keyConfigured: Boolean(process.env.YOUTUBE_API_KEY), registryChannels: list.length, sweptChannels: swept.n, oldestSweep: swept.oldest };
    }
    if (command === 'video') {
      const ids = args.map(videoId);
      if (!ids.length || ids.some(id => !id)) throw new Error('Pass one or more YouTube video IDs or URLs.');
      return await videos(api, [...new Set(ids)], true);
    }
    if (command === 'audit') {
      // Checks every catalogue YouTube watch link (about 1 unit per 50 links).
      const links = catalogueWatchLinks(flag(args, '--films'));
      const { videos: found } = await videos(api, [...new Set(links.map(link => link.id))], false);
      const byId = new Map(found.map(v => [v.id, v]));
      const problems = [];
      for (const link of links) {
        const v = byId.get(link.id);
        const issues = !v ? ['unavailable (deleted, private or wrong ID)'] : [
          v.privacy !== 'public' && v.privacy !== 'unlisted' ? 'privacy: ' + v.privacy : undefined,
          v.embeddable === false ? 'embedding disabled' : undefined,
          v.upload && v.upload !== 'processed' ? 'upload: ' + v.upload : undefined,
          v.live && v.live !== 'none' ? 'live: ' + v.live : undefined,
          v.regionBlocked?.length ? 'blocked in ' + v.regionBlocked.length + ' regions' : undefined,
        ].filter(Boolean);
        if (issues.length) problems.push({ ...link, issues, title: v?.title, channelTitle: v?.channelTitle });
      }
      return { checkedLinks: links.length, uniqueVideos: byId.size, problems, unitsUsedToday: api.used() };
    }
    if (command === 'channel') {
      if (!args.length) throw new Error('Pass one or more channel IDs, @handles or channel URLs.');
      const out = [];
      for (const input of args) out.push(await resolveChannel(api, input));
      return { channels: out };
    }
    if (command === 'uploads') {
      const since = flag(args, '--since'), pages = Number(flag(args, '--pages') ?? 1);
      const channel = await resolveChannel(api, args[0]);
      if (!channel.found) return { channel };
      return { channel, ...(await videos(api, await uploads(api, channel.id, { since, pages: Math.min(pages, 10) }), false)) };
    }
    if (command === 'find-title') {
      // Cheap title match inside one channel's uploads (1 unit per 50 uploads) before falling back to search.
      const channelInput = flag(args, '--channel'), pages = Math.min(Number(flag(args, '--pages') ?? 4), 20);
      const wanted = normalise(args.join(' '));
      if (!channelInput || !wanted) throw new Error('Use: find-title "Title" --channel CHANNEL [--pages N].');
      const channel = await resolveChannel(api, channelInput);
      if (!channel.found) return { channel };
      const ids = [];
      let pageToken, scanned = 0;
      for (let page = 0; page < pages; page++) {
        const body = await api.call('playlistItems', { part: 'snippet', playlistId: channel.uploads, maxResults: '50', ...(pageToken ? { pageToken } : {}) });
        for (const item of body.items ?? []) {
          scanned++;
          if (normalise(item.snippet?.title ?? '').includes(wanted)) ids.push(item.snippet.resourceId.videoId);
        }
        pageToken = body.nextPageToken;
        if (!pageToken) break;
      }
      return { channel, scanned, complete: !pageToken, ...(await videos(api, ids, false)) };
    }
    if (command === 'search') {
      const channelInput = flag(args, '--channel'), max = Math.min(Number(flag(args, '--max') ?? 10), 25);
      const q = args.join(' ').trim();
      if (!q) throw new Error('Use: search "title creator" [--channel CHANNEL] [--max N] (costs 100 units).');
      const channel = channelInput ? await resolveChannel(api, channelInput) : undefined;
      if (channel && !channel.found) return { channel };
      const body = await api.call('search', { part: 'id', type: 'video', q, maxResults: String(max), safeSearch: 'none', ...(channel ? { channelId: channel.id } : {}) });
      return { query: q, channel, ...(await videos(api, (body.items ?? []).map(item => item.id.videoId).filter(Boolean), false)) };
    }
    if (command === 'sweep') {
      // New uploads across the registry since each channel's last sweep (first sweep looks back --days, default 14).
      const list = channels ?? registry();
      const days = Number(flag(args, '--days') ?? 14), limit = Number(flag(args, '--limit') ?? list.length);
      const stamp = new Date(now).toISOString();
      const rows = new Map(db.prepare('SELECT id, last_seen, last_sweep FROM channels').all().map(r => [r.id, r]));
      const order = [...list].sort((a, b) => (rows.get(a.id)?.last_sweep ?? '').localeCompare(rows.get(b.id)?.last_sweep ?? ''));
      const found = [], failures = [];
      let swept = 0;
      for (const channel of order.slice(0, limit)) {
        const since = rows.get(channel.id)?.last_seen ?? new Date(now - days * 86_400_000).toISOString();
        try {
          const ids = await uploads(api, channel.id, { since, pages: 2 });
          const { videos: fresh } = ids.length ? await videos(api, ids, false) : { videos: [] };
          const latest = fresh.reduce((max, v) => (v.publishedAt > max ? v.publishedAt : max), since);
          db.prepare('INSERT INTO channels (id, last_seen, last_sweep) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET last_seen = excluded.last_seen, last_sweep = excluded.last_sweep').run(channel.id, latest, stamp);
          for (const v of fresh) found.push({ ...v, registry: { kind: channel.kind, artists: channel.artists, title: channel.title } });
          swept++;
        } catch (error) {
          if (/quota/i.test(error.message)) { failures.push({ channel: channel.id, error: error.message }); break; }
          failures.push({ channel: channel.id, title: channel.title, error: error.message });
        }
      }
      found.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      return { swept, of: list.length, newUploads: found.length, unitsUsedToday: api.used(), failures, uploads: found };
    }
    throw new Error('Commands: status, audit, video ID|URL..., channel ID|@handle|URL..., uploads CHANNEL [--since ISO] [--pages N], find-title "Title" --channel CHANNEL, search "query" [--channel CHANNEL], sweep [--days N] [--limit N].');
  } finally {
    db.close();
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    console.log(JSON.stringify(await runYouTube(), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

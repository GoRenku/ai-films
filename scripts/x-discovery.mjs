import { bookmarkCredentials, bookmarkAuthStatus } from './x-bookmark-auth.mjs';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

const DAILY_REQUESTS = 6;
const DAILY_POSTS = 100;
const CYCLE_POSTS = 2800; // $14.00 at the standard Post Read rate.
export const LIMITS = Object.freeze({ dailyRequests: DAILY_REQUESTS, dailyPosts: DAILY_POSTS, monthlyPosts: CYCLE_POSTS });
const PAGE = 20;
const DAY = 86_400_000;
const POST_FIELDS = 'created_at,author_id,conversation_id,entities,attachments,referenced_tweets,note_tweet';
const RECENT = '/2/tweets/search/recent';
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PRIVATE = join(homedir(), '.codex', '.chatgpt-projects', 'g-p-6aabb55f14b8819192b8a0d2bee9108b');
const idPattern = /^\d{1,19}$/;
const madrid = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' });

function instant(ms) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function watchGroups(config) {
  const seen = new Set();
  return [config.priority, ...config.rotation].map((handles, index) => {
    if (!Array.isArray(handles) || !handles.length) throw new Error('Watchlist groups must contain handles.');
    for (const handle of handles) {
      if (!/^[A-Za-z0-9_]{1,15}$/.test(handle) || seen.has(handle.toLowerCase())) {
        throw new Error('Watchlist contains an invalid or repeated handle.');
      }
      seen.add(handle.toLowerCase());
    }
    const query = '(' + handles.map(handle => 'from:' + handle).join(' OR ') + ') -is:retweet -is:reply';
    if (query.length > 512) throw new Error('Watchlist query exceeds 512 characters.');
    return { key: handles.map(h => h.toLowerCase()).sort().join(','), kind: index === 0 ? 'priority' : 'rotation', query, handles };
  });
}

export function searchRange(group, previous, now) {
  const earliest = now - 7 * DAY + 60_000;
  const from = previous?.range?.start ?? previous?.through ?? instant(group.kind === 'rotation' ? earliest : now - DAY);
  const gap = Date.parse(from) < earliest;
  return {
    ...group,
    start: gap ? instant(earliest) : from,
    end: !gap && previous?.range ? previous.range.end : instant(now - 30_000),
    token: gap ? undefined : previous?.range?.token,
    previousIds: gap ? undefined : previous?.range?.lastIds,
    gapFrom: previous?.range?.gapFrom ?? (gap ? from : undefined),
  };
}

function privateDirectory() {
  const dir = resolve(process.env.LATENT_MATINEE_PRIVATE_DIR || DEFAULT_PRIVATE);
  const repo = resolve(SCRIPT_DIR, '..');
  if (dir === repo || dir.startsWith(repo + '/')) throw new Error('Discovery state must be outside the repository.');
  return dir;
}

function openState(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(dir, 'x-discovery.sqlite3'));
  db.exec(`
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS requests (
      id TEXT PRIMARY KEY, day TEXT NOT NULL, allowance INTEGER NOT NULL, kind TEXT NOT NULL, outcome TEXT NOT NULL
    );
  `);
  return db;
}

function get(db, key) {
  const row = db.prepare('SELECT value FROM state WHERE key = ?').get(key);
  return row ? JSON.parse(row.value) : undefined;
}

function put(db, key, value) {
  db.prepare('INSERT OR REPLACE INTO state VALUES (?, ?)').run(key, JSON.stringify(value));
}

function remove(db, key) {
  db.prepare('DELETE FROM state WHERE key = ?').run(key);
}

function transaction(db, action) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = action();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function budget(db, day) {
  const daily = db.prepare('SELECT COUNT(*) AS requests, COALESCE(SUM(allowance), 0) AS posts FROM requests WHERE day = ?').get(day);
  const cycle = db.prepare('SELECT COALESCE(SUM(allowance), 0) AS posts FROM requests WHERE substr(day,1,7) = ?').get(day.slice(0, 7));
  return { ...daily, cyclePosts: cycle.posts };
}

function nextSearch(db, groups, day, now) {
  // A perpetually partial high-volume group must not monopolize discovery.
  const eligible = groups.filter(group => get(db, group.key)?.lastDay !== day && get(db, group.key)?.blockedDay !== day);
  eligible.sort((a, b) => (get(db, a.key)?.lastPageDay ?? '').localeCompare(get(db, b.key)?.lastPageDay ?? ''));
  const group = eligible[0];
  return group && searchRange(group, get(db, group.key), now);
}

function requestPlan(db, groups, command, value, day, now) {
  if (command === 'probe') return { kind: 'probe', key: 'probe', query: 'from:' + groups[0].handles[0] + ' -is:retweet', limit: 10, start: instant(now - DAY), end: instant(now - 30_000) };
  if (command === 'thread') {
    const match = /^https:\/\/x\.com\/([A-Za-z0-9_]{1,15})\/status\/(\d{1,19})$/.exec(value ?? '');
    if (!match) throw new Error('Use a canonical public X status URL for a thread.');
    const [, handle, id] = match;
    const key = 'thread:' + id;
    const job = get(db, key);
    if (job?.lastDay === day || job?.blockedDay === day) return;
    return { kind: 'thread', key, query: 'conversation_id:' + id + ' from:' + handle, start: job?.range?.start, end: job?.range?.end ?? instant(now - 30_000), token: job?.range?.token, previousIds: job?.range?.lastIds, limit: PAGE };
  }
  if (command === 'bookmarks' || command === 'bookmark-backfill') {
    const state = get(db, 'bookmarks') ?? {};
    const backfill = command === 'bookmark-backfill';
    if (!backfill && state.lastDay === day) return;
    if (backfill && (!state.backfillToken || state.backfillRead >= 100)) return;
    return { kind: 'bookmarks', key: 'bookmarks', mode: backfill ? 'backfill' : 'head',
      token: backfill ? state.backfillToken : undefined, limit: backfill ? Math.min(PAGE, 100 - state.backfillRead) : PAGE };
  }
  if (command === 'lookup') {
    const urls = readJson(value);
    if (!Array.isArray(urls) || !urls.length || urls.length > PAGE) throw new Error('Lookup takes up to 20 canonical public X status URLs.');
    const sourceUrls = {};
    const ids = urls.map(url => {
      const match = /^https:\/\/x\.com\/(?:[A-Za-z0-9_]{1,15}|i\/web)\/status\/(\d{1,19})$/.exec(url);
      if (!match) throw new Error('Lookup takes canonical public X status URLs without tracking parameters.');
      sourceUrls[match[1]] = url;
      return match[1];
    });
    const unique = [...new Set(ids)];
    const key = 'lookup:' + unique.join(',');
    if (get(db, key)?.lastDay === day) return;
    return { kind: 'lookup', key, path: '/2/tweets', ids: unique, sourceUrls, limit: unique.length };
  }
  if (command === 'verify-bookmarks') {
    const ids = readJson(value);
    if (!Array.isArray(ids) || !ids.length || ids.length > PAGE || ids.some(id => typeof id !== 'string' || !idPattern.test(id))) {
      throw new Error('Provide an array of up to 20 numeric post ID strings.');
    }
    const pending = get(db, 'pending');
    if (pending?.kind !== 'bookmarks' || ids.some(id => !pending.posts.some(post => post.id === id))) {
      throw new Error('Select IDs from the currently staged bookmark page.');
    }
    return { kind: 'bookmark-verification', path: '/2/tweets', ids: [...new Set(ids)], limit: ids.length };
  }
  if (command === 'collect' && value) {
    if (!['priority', 'rotation'].includes(value)) throw new Error('Use collect, collect priority or collect rotation.');
    const eligible = groups.filter(group => group.kind === value && get(db, group.key)?.lastDay !== day && get(db, group.key)?.blockedDay !== day);
    eligible.sort((a, b) => (get(db, a.key)?.lastPageDay ?? '').localeCompare(get(db, b.key)?.lastPageDay ?? ''));
    const group = eligible[0];
    return group && { ...searchRange(group, get(db, group.key), now), limit: PAGE };
  }
  const plan = nextSearch(db, groups, day, now);
  return plan && { ...plan, limit: PAGE };
}

function reserve(db, plan, day, now) {
  return transaction(db, () => {
    if ((get(db, 'lease')?.expires ?? 0) > now) throw new Error('Another discovery request is in progress.');
    if (get(db, 'halt')?.day === day || (get(db, 'halt')?.until ?? 0) > now) throw new Error('X requests are stopped for this run window. See status.');
    const pending = get(db, 'pending');
    if (plan.kind === 'bookmark-verification' ? pending?.kind !== 'bookmarks' : pending) {
      throw new Error('A staged page needs review before another request.');
    }
    if (plan.key && plan.mode !== 'backfill' && get(db, plan.key)?.lastDay === day) throw new Error('This group has already been checked today.');
    const used = budget(db, day);
    if (used.requests >= DAILY_REQUESTS || used.posts + plan.limit > DAILY_POSTS || used.cyclePosts + plan.limit > CYCLE_POSTS) {
      throw new Error('X discovery budget exhausted.');
    }
    const id = randomUUID();
    db.prepare('INSERT INTO requests VALUES (?, ?, ?, ?, ?)').run(id, day, plan.limit, plan.kind, 'reserved');
    put(db, 'lease', { id, expires: now + 120_000 });
    return id;
  });
}

async function fetchPage(plan, token, request = fetch) {
  const url = new URL(plan.path ?? RECENT, 'https://api.x.com');
  url.searchParams.set('tweet.fields', POST_FIELDS);
  if (plan.ids) {
    url.searchParams.set('ids', plan.ids.join(','));
  } else {
    url.searchParams.set('max_results', String(plan.limit));
  }
  if (plan.query) url.searchParams.set('query', plan.query);
  if (plan.start) url.searchParams.set('start_time', plan.start);
  if (plan.end) url.searchParams.set('end_time', plan.end);
  if (plan.token) url.searchParams.set(plan.path?.includes('/bookmarks') ? 'pagination_token' : 'next_token', plan.token);
  const response = await request(url, {
    headers: { Authorization: 'Bearer ' + token },
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    const explanations = { 400: 'request rejected', 401: 'credential rejected', 402: 'credits or spending limit', 403: 'access denied', 429: 'rate limited' };
    throw Object.assign(new Error('X API HTTP ' + response.status + ' (' + (explanations[response.status] ?? 'request failed') + ').'), {
      status: response.status,
      reset: Number(response.headers.get('x-rate-limit-reset')) * 1000,
    });
  }
  const page = await response.json();
  const posts = page.data ?? [];
  if (!Array.isArray(posts) || posts.length > plan.limit || posts.some(post => typeof post?.id !== 'string' || !idPattern.test(post.id))) {
    throw new Error('X returned an invalid or oversized post page.');
  }
  if (plan.ids && posts.some(post => !plan.ids.includes(post.id))) throw new Error('X returned an unrequested post.');
  if (!page.meta && !plan.ids && !page.errors?.length) throw new Error('X response is missing pagination metadata.');
  return page;
}

async function collect(db, plan, day, now, request, privateRoot) {
  let token = process.env.X_BEARER_TOKEN?.trim();
  if (plan.kind === 'bookmarks') {
    // User credentials are never staged, printed or included in receipts.
    const credentials = process.env.X_BOOKMARK_ACCESS_TOKEN && idPattern.test(process.env.X_BOOKMARK_USER_ID ?? '')
      ? { userId: process.env.X_BOOKMARK_USER_ID, accessToken: process.env.X_BOOKMARK_ACCESS_TOKEN }
      : await bookmarkCredentials(privateRoot, { request });
    token = credentials.accessToken;
    plan = { ...plan, path: '/2/users/' + credentials.userId + '/bookmarks' };
  }
  if (!token) throw new Error('X_BEARER_TOKEN is missing from the environment.');
  const id = reserve(db, plan, day, now);
  try {
    const page = await fetchPage(plan, token, request);
    if (plan.token && plan.previousIds?.length && JSON.stringify((page.data ?? []).map(p => p.id).sort()) === JSON.stringify([...plan.previousIds].sort())) {
      throw Object.assign(new Error('X pagination made no progress. Stop this group for today and preserve its partial checkpoint.'), { noProgress: true });
    }
    if (page.errors?.length && !plan.ids) throw new Error('X returned an incomplete page with API errors.');
    transaction(db, () => {
      if (get(db, 'lease')?.id !== id) throw new Error('Request ownership expired.');
      db.prepare('UPDATE requests SET outcome = ? WHERE id = ?').run('received', id);
      const posts = page.data ?? [];
      if (plan.kind === 'bookmark-verification') {
        const pending = get(db, 'pending');
        pending.publicPosts = [...(pending.publicPosts ?? []).filter(post => !plan.ids.includes(post.id)), ...posts.filter(post => plan.ids.includes(post.id))];
        pending.publicIds = [...new Set([...(pending.publicIds ?? []), ...posts.map(post => post.id).filter(id => plan.ids.includes(id))])];
        put(db, 'pending', pending);
      } else {
        const seen = plan.kind === 'bookmarks' ? new Set(get(db, 'bookmarks')?.seen ?? []) : null;
        put(db, 'pending', {
          ...plan, id, day, receivedAt: instant(now),
          unavailableIds: plan.ids?.filter(id => !posts.some(post => post.id === id)),
          nextToken: page.meta?.next_token,
          readCount: posts.length,
          bookmarkIds: seen ? posts.map(post => post.id) : undefined,
          posts: seen ? posts.filter(post => !seen.has(post.id)) : posts,
        });
      }
      remove(db, 'lease');
    });
    return { request: plan.kind, postsReturned: page.data?.length ?? 0, hasMore: Boolean(page.meta?.next_token), staged: plan.kind !== 'bookmark-verification' };
  } catch (error) {
    transaction(db, () => {
      db.prepare('UPDATE requests SET outcome = ? WHERE id = ?').run('failed', id);
      if (get(db, 'lease')?.id === id) remove(db, 'lease');
      if (error.noProgress && plan.key) put(db, plan.key, { ...get(db, plan.key), blockedDay: day });
      const retryAfter = now + 60 * 60 * 1000;
      if ([402, 429].includes(error.status) || ([400, 401, 403].includes(error.status) && plan.kind !== 'bookmarks')) {
        put(db, 'halt', { day, reason: error.message, until: Math.max(retryAfter, error.reset || 0) });
      }
    });
    if (error.status || error.message.startsWith('X ')) throw error;
    throw new Error('X request or response processing failed. The request allowance remains reserved.');
  }
}

function queueLeads(dir, leads) {
  const helper = join(dir, 'film-queue.py');
  const temporary = mkdtempSync(join(dir, 'x-handoff-'));
  try {
    const path = join(temporary, 'leads.json');
    writeFileSync(path, JSON.stringify(leads), { mode: 0o600 });
    const run = (...args) => JSON.parse(execFileSync('python3', [helper, ...args], {
      encoding: 'utf8', timeout: 25_000, maxBuffer: 8 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    }));
    run('add', path);
    const keys = new Set(run('all').map(row => row.key));
    if (leads.some(lead => !keys.has('x:' + basename(lead.url)))) throw new Error('Queue verification failed.');
  } catch {
    throw new Error('Private queue handoff failed. The staged page is available for a local retry.');
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}

function acknowledge(db, dir, path) {
  const input = readJson(path);
  return transaction(db, () => {
    const pending = get(db, 'pending');
    if (!pending || pending.id !== input.page || !Array.isArray(input.leads)) throw new Error('Provide the current staged page ID and a leads array.');
    if ((get(db, 'lease')?.expires ?? 0) > Date.now()) throw new Error('An X request is still in progress.');
    const known = new Set(pending.posts.map(post => post.id));
    const publicIds = new Set(pending.publicIds ?? []);
    const leads = input.leads.map(({ id, note }) => {
      if (!known.has(id) || (pending.kind === 'bookmarks' && !publicIds.has(id)) || typeof note !== 'string' || !note.trim() || note.length > 500) {
        throw new Error('Choose staged public post IDs and short public evidence notes. Bookmark leads require app-only verification.');
      }
      return { url: 'https://x.com/i/web/status/' + id, note: note.trim() };
    });
    queueLeads(dir, leads);
    const publicPosts = pending.kind === 'bookmarks' ? pending.publicPosts : pending.posts;
    if (leads.length) {
      const evidenceDir = join(dir, 'public-evidence');
      mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
      for (const lead of leads) {
        const id = basename(lead.url);
        const post = publicPosts?.find(post => post.id === id);
        if (!post) throw new Error('Verified public evidence is missing. Keep the page staged for local recovery.');
        const target = join(evidenceDir, id + '.json');
        const temporary = target + '.' + randomUUID() + '.tmp';
        const record = { url: pending.sourceUrls?.[id] ?? lead.url, retrievedAt: pending.receivedAt ?? pending.day,
          verification: 'app-only X API', post: Object.fromEntries(
            ['id','text','note_tweet','created_at','author_id','conversation_id','entities','attachments','referenced_tweets']
              .filter(key => post[key] !== undefined).map(key => [key, post[key]])) };
        writeFileSync(temporary, JSON.stringify(record, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
        renameSync(temporary, target);
      }
    }
    const previous = get(db, pending.key) ?? {};
    const lastDay = pending.day;
    if (pending.kind === 'priority') put(db, 'priority-page-day', lastDay);
    if (pending.kind === 'bookmarks') {
      const first = previous.backfillRead === undefined;
      const advancing = first || pending.mode === 'backfill';
      const backfillRead = advancing ? (previous.backfillRead ?? 0) + pending.readCount : previous.backfillRead;
      put(db, 'bookmarks', { lastDay: pending.mode === 'backfill' ? previous.lastDay : lastDay,
        backfillRead,
        backfillToken: advancing ? (backfillRead < 100 ? pending.nextToken : undefined) : previous.backfillToken,
        backfillComplete: advancing ? (!pending.nextToken || backfillRead >= 100) : previous.backfillComplete,
        seen: [...new Set([...pending.bookmarkIds, ...(previous.seen ?? [])])].slice(0, 2000) });
    } else if (pending.nextToken) {
      put(db, pending.key, { ...previous, range: { start: pending.start, end: pending.end, token: pending.nextToken, lastIds: pending.posts.map(post => post.id), gapFrom: pending.gapFrom } });
    } else {
      put(db, pending.key, { lastDay, through: pending.end });
      if (pending.kind === 'rotation') put(db, 'rotation-day', lastDay);
    }
    if (pending.kind === 'priority' || pending.kind === 'rotation') {
      put(db, pending.key, { ...get(db, pending.key), lastPageDay: lastDay });
    }
    remove(db, 'pending');
    const receipt = { page: pending.id, kind: pending.kind, mode: pending.mode, day: lastDay,
      status: pending.nextToken ? 'partial' : 'complete', coverageGapFrom: pending.gapFrom,
      postsReturned: pending.readCount, unavailableIds: pending.unavailableIds, evidenceSaved: leads.length, queued: leads.map(lead => lead.url) };
    const receipts = get(db, 'receipts') ?? [];
    put(db, 'receipts', [...receipts.slice(-29), receipt]);
    return receipt;
  });
}

export async function runDiscovery({ argv, dir, groups, now = Date.now(), request } = {}) {
  const [command = 'status', value] = argv ?? process.argv.slice(2);
  const watch = groups ?? watchGroups(readJson(join(SCRIPT_DIR, 'x-watchlist.json')));
  const day = madrid.format(now);
  if (command === 'plan') return { day, groups: watch.map(({ kind, handles, query }) => ({ kind, handles, query })), dailyRequests: DAILY_REQUESTS, pageSize: PAGE, maxDailyPostReadUsd: 0.50 };
  if (!['status', 'review', 'ack', 'collect', 'probe', 'thread', 'lookup', 'evidence', 'bookmarks', 'bookmark-backfill', 'verify-bookmarks'].includes(command)) {
    throw new Error('Commands: plan, status, collect, review, ack FILE, probe, thread URL, lookup FILE, evidence URL, bookmarks, bookmark-backfill, verify-bookmarks FILE.');
  }
  process.umask(0o077);
  const root = dir ?? privateDirectory();
  const db = openState(root);
  try {
    if (command === 'evidence') {
      const match = /^https:\/\/x\.com\/(?:[A-Za-z0-9_]{1,15}|i\/web)\/status\/(\d{1,19})$/.exec(value ?? '');
      if (!match) throw new Error('Use a canonical public X status URL.');
      try { return readJson(join(root, 'public-evidence', match[1] + '.json')); }
      catch { throw new Error('No preserved public evidence for this post. Request a bounded lookup from the discovery owner.'); }
    }
    if (command === 'status') {
      const pending = get(db, 'pending');
      return { day, bookmarkAuthorization: bookmarkAuthStatus(root), bookmarks: get(db, 'bookmarks') && { lastDay: get(db, 'bookmarks').lastDay, catchupRead: get(db, 'bookmarks').backfillRead, catchupComplete: get(db, 'bookmarks').backfillComplete, hasCatchupPage: Boolean(get(db, 'bookmarks').backfillToken) }, budget: budget(db, day), pending: pending && { id: pending.id, kind: pending.kind, count: pending.posts.length },
        halt: get(db, 'halt')?.day === day || (get(db, 'halt')?.until ?? 0) > now ? get(db, 'halt') : undefined, receipts: (get(db, 'receipts') ?? []).filter(receipt => receipt.day === day), groups: watch.map(({ key, kind, handles }) => {
          const group = get(db, key);
          return { kind, handles, lastCompleteThrough: group?.through, lastPageDay: group?.lastPageDay, partial: Boolean(group?.range), stoppedForNoProgressToday: group?.blockedDay === day,
            outsideRecentWindow: Boolean((group?.range?.start || group?.through) && Date.parse(group?.range?.start || group.through) < now - 7 * DAY) };
        }) };
    }
    if (command === 'review') {
      const pending = get(db, 'pending');
      if (!pending) return { pending: false };
      const { id, kind, mode, posts, publicIds, publicPosts, nextToken, gapFrom, unavailableIds } = pending;
      return { id, kind, mode, posts, publicIds, publicPosts, unavailableIds, hasMore: Boolean(nextToken), gapFrom };
    }
    if (command === 'ack') return acknowledge(db, root, value);
    const plan = requestPlan(db, watch, command, value, day, now);
    if (!plan) return { status: 'no request due' };
    return await collect(db, plan, day, now, request, root);
  } finally {
    db.close();
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    console.log(JSON.stringify(await runDiscovery(), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

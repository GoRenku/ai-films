import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runDiscovery, searchRange, watchGroups } from './x-discovery.mjs';

const groups = watchGroups({ priority: ['Director'], rotation: [['Studio']] });
const now = Date.parse('2026-11-14T11:00:00Z');
const token = 'offline-fixture-token';
process.env.X_BEARER_TOKEN = token;

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'lm-x-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = (name, data) => {
    const path = join(dir, name);
    writeFileSync(path, JSON.stringify(data));
    return path;
  };
  return { dir, file, call: (argv, request) => runDiscovery({ argv, dir, groups, now, request }) };
}

const page = (ids, next) => Response.json({
  data: ids.map(id => ({ id, text: 'Fixture' })),
  meta: { result_count: ids.length, next_token: next },
});

test('preserves an explicitly bounded partial window and reports missed ranges', () => {
  const previous = { range: { start: '2026-11-11T07:00:00Z', end: '2026-11-12T07:00:00Z', token: 'next' } };
  assert.equal(searchRange(groups[0], previous, now).token, 'next');
  assert.equal(searchRange(groups[0], previous, now).end, previous.range.end);
  const expired = searchRange(groups[0], previous, now + 7 * 86400_000);
  assert.equal(expired.gapFrom, previous.range.start);
  assert.equal(expired.token, undefined);
});

test('keeps a failed handoff staged and rotates before resuming priority pagination', async t => {
  const { dir, file, call } = fixture(t);
  writeFileSync(join(dir, 'film-queue.py'), [
    'import json, sys',
    'from pathlib import Path',
    'db=Path(__file__).with_suffix(".json")',
    'if sys.argv[1]=="add":',
    '    data=json.loads(Path(sys.argv[2]).read_text())',
    '    db.write_text(json.dumps([{"key":"x:"+r["url"].rsplit("/",1)[-1]} for r in data]))',
    '    print(json.dumps({"submitted":len(data)}))',
    'else: print(db.read_text())',
  ].join('\n'));
  await call(['collect'], async (url, options) => {
    assert.equal(url.hostname, 'api.x.com');
    assert.equal(options.headers.Authorization, 'Bearer ' + token);
    assert.equal(url.searchParams.get('max_results'), '20');
    assert.equal(url.searchParams.has('expansions'), false);
    return page(['100'], 'next');
  });
  const pending = await call(['review']);
  const handoff = file('handoff.json', { page: pending.id, leads: [{ id: '100', note: 'Creator release' }] });
  const queue = await import('node:fs/promises');
  await queue.rename(join(dir, 'film-queue.py'), join(dir, 'helper.bak'));
  await assert.rejects(call(['ack', handoff]), /handoff failed/);
  assert.equal((await call(['review'])).id, pending.id);
  assert.equal((await call(['status'])).budget.requests, 1);
  await queue.rename(join(dir, 'helper.bak'), join(dir, 'film-queue.py'));
  assert.equal((await call(['ack', handoff])).status, 'partial');

  await call(['collect'], async url => {
    assert.match(url.searchParams.get('query'), /from:Studio/);
    return page([]);
  });
  const rotation = await call(['review']);
  await call(['ack', file('rotation.json', { page: rotation.id, leads: [] })]);
  await call(['collect'], async url => {
    assert.equal(url.searchParams.get('pagination_token'), 'next');
    return page([]);
  });
  const end = await call(['review']);
  await call(['ack', file('end.json', { page: end.id, leads: [] })]);
  await assert.rejects(call(['probe']), /budget exhausted/);
});

test('reserves requests before calling X and stops after rate limiting', async t => {
  const { call } = fixture(t);
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const first = call(['probe'], async () => {
    await gate;
    return new Response(null, { status: 429 });
  });
  await assert.rejects(call(['probe']), /request is in progress/);
  release();
  await assert.rejects(first, /HTTP 429/);
  await assert.rejects(call(['probe']), /stopped/);
  assert.equal((await call(['status'])).budget.posts, 10);
});

test('requires independent public lookup before forwarding bookmarks', async t => {
  const { dir, call, file } = fixture(t);
  const vars = { X_BOOKMARK_USER_ID: '123', X_BOOKMARK_ACCESS_TOKEN: 'user-fixture' };
  Object.assign(process.env, vars);
  t.after(() => Object.keys(vars).forEach(key => delete process.env[key]));
  writeFileSync(join(dir, 'film-queue.py'), 'import json,sys\nprint(json.dumps([{"key":"x:456"}] if sys.argv[1]=="all" else {}))\n');
  await call(['bookmarks'], async (url, options) => {
    assert.equal(url.pathname, '/2/users/123/bookmarks');
    assert.equal(options.headers.Authorization, 'Bearer user-fixture');
    return page(['456', '789']);
  });
  const pending = await call(['review']);
  assert.equal(pending.posts.length, 2); // Old post IDs still qualify as newly saved items.
  const pick = file('pick.json', { page: pending.id, leads: [{ id: '456', note: 'Release evidence' }] });
  await assert.rejects(call(['ack', pick]), /require app-only verification/);
  await call(['verify-bookmarks', file('ids.json', ['456', '789'])], async (url, options) => {
    assert.equal(url.pathname, '/2/tweets');
    assert.equal(options.headers.Authorization, 'Bearer ' + token);
    return Response.json({ data: [{ id: '456', text: 'Public' }], errors: [{ resource_id: '789' }] });
  });
  assert.deepEqual((await call(['review'])).publicIds, ['456']);
  assert.equal((await call(['ack', pick])).queued.length, 1);
});

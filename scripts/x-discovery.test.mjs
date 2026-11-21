import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LIMITS, runDiscovery, searchRange, watchGroups } from './x-discovery.mjs';

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

test('keeps the X allowance within the agreed spending limit', () => {
  assert.deepEqual(LIMITS, { dailyRequests: 6, dailyPosts: 100, monthlyPosts: 2800 });
  assert.ok(LIMITS.monthlyPosts * 0.005 <= 14, 'monthly reads must stay within $14 at the standard rate');
  assert.ok(LIMITS.dailyPosts <= LIMITS.dailyRequests * 20, 'daily reads fit within full 20-post pages');
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
    assert.equal(url.searchParams.get('next_token'), 'next');
    return page([]);
  });
  const end = await call(['review']);
  await call(['ack', file('end.json', { page: end.id, leads: [] })]);
  for (let used = 3; used < LIMITS.dailyRequests; used++) {
    const id = String(900 + used);
    await call(['lookup', file('lookup-' + used + '.json', ['https://x.com/Studio/status/' + id])], async () => page([id]));
    const lookup = await call(['review']);
    await call(['ack', file('lookup-ack-' + used + '.json', { page: lookup.id, leads: [] })]);
  }
  assert.equal((await call(['status'])).budget.requests, LIMITS.dailyRequests);
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
  const fs=await import('node:fs');
  const evidence=JSON.parse(fs.readFileSync(join(dir,'public-evidence/456.json')));
  assert.equal(evidence.post.text,'Public');
  assert.equal(fs.existsSync(join(dir,'public-evidence/789.json')),false);
  assert.equal(JSON.stringify(evidence).includes('bookmarks'),false);
});

test('checks the head again next day and keeps catch-up pagination separate', async t => {
  const { dir, call, file } = fixture(t);
  Object.assign(process.env, { X_BOOKMARK_USER_ID: '123', X_BOOKMARK_ACCESS_TOKEN: 'fixture' });
  t.after(() => { delete process.env.X_BOOKMARK_USER_ID; delete process.env.X_BOOKMARK_ACCESS_TOKEN; });
  writeFileSync(join(dir, 'film-queue.py'), 'print("[]")\n');
  const ack = async invoke => {
    const pending = await invoke(['review']);
    return invoke(['ack', file('empty.json', { page: pending.id, leads: [] })]);
  };
  await call(['bookmarks'], async url => {
    assert.equal(url.searchParams.has('pagination_token'), false);
    return page(['101'], 'older-page');
  });
  await ack(call);
  assert.equal((await call(['bookmarks'])).status, 'no request due');
  const tomorrow = argv => runDiscovery({ argv, dir, groups, now: now + 86400_000,
    request: async url => {
      assert.equal(url.searchParams.has('pagination_token'), false);
      return page(['102', '101'], 'new-head-continuation');
    } });
  await tomorrow(['bookmarks']);
  assert.deepEqual((await tomorrow(['review'])).posts.map(p => p.id), ['102']);
  await ack(tomorrow);
  await call(['bookmark-backfill'], async url => {
    assert.equal(url.searchParams.get('pagination_token'), 'older-page');
    return page(['1']); // An old post newly discovered is still eligible.
  });
  assert.equal((await call(['review'])).posts[0].id, '1');
  await ack(call);
  assert.equal((await call(['status'])).bookmarks.catchupComplete, true);
  assert.equal((await call(['bookmark-backfill'])).status, 'no request due');
});

test('bounds initial catch-up at 100 returned bookmarks', async t => {
  const { dir, file } = fixture(t);
  Object.assign(process.env, { X_BOOKMARK_USER_ID: '123', X_BOOKMARK_ACCESS_TOKEN: 'fixture' });
  t.after(() => { delete process.env.X_BOOKMARK_USER_ID; delete process.env.X_BOOKMARK_ACCESS_TOKEN; });
  writeFileSync(join(dir, 'film-queue.py'), 'print("[]")\n');
  for (let i = 0; i < 5; i++) {
    const call = argv => runDiscovery({ argv, dir, groups, now: now + i * 86400_000,
      request: async () => page(Array.from({length:20}, (_, n) => String(i * 20 + n + 1)), 'more') });
    await call([i ? 'bookmark-backfill' : 'bookmarks']);
    const pending = await call(['review']);
    await call(['ack', file('ack.json', { page: pending.id, leads: [] })]);
    if (i === 4) {
      assert.equal((await call(['status'])).bookmarks.catchupRead, 100);
      assert.equal((await call(['bookmark-backfill'])).status, 'no request due');
    }
  }
});


test('can spend the sole remaining public request on overdue rotation', async t => {
  const { dir, file, call } = fixture(t);
  writeFileSync(join(dir, 'film-queue.py'), 'print("[]")\n');
  await call(['collect', 'rotation'], async url => {
    assert.match(url.searchParams.get('query'), /from:Studio/);
    assert.doesNotMatch(url.searchParams.get('query'), /from:Director/);
    return page([]);
  });
  const pending = await call(['review']);
  await call(['ack', file('rotation.json', {page:pending.id, leads:[]})]);
  assert.equal((await call(['collect', 'rotation'])).status, 'no request due');
});


test('hands off complete selected public evidence without bookmark activity or protected text', async t => {
  const {dir,call,file}=fixture(t);
  writeFileSync(join(dir,'film-queue.py'),'print(\"[]\")\n');
  const lookup=await call(['lookup',file('urls.json',['https://x.com/Director/status/123'])],async url=>{
    assert.equal(url.pathname,'/2/tweets');
    assert.equal(url.searchParams.get('ids'),'123');
    assert.equal(url.searchParams.has('start_time'),false);
    return Response.json({data:[{id:'123',text:'Full original release and credits',note_tweet:{text:'Long public production account'}}]});
  });
  assert.equal(lookup.staged,true);
  const pending=await call(['review']);
  assert.equal(pending.posts[0].note_tweet.text,'Long public production account');
  // Queue helper readback must confirm the selected public URL.
  writeFileSync(join(dir,'film-queue.py'),'import sys\nprint(\"[{\\\"key\\\":\\\"x:123\\\"}]\" if sys.argv[1]==\"all\" else \"{}\")\n');
  await call(['ack',file('ack.json',{page:pending.id,leads:[{id:'123',note:'Released film'}]})]);
  const {readFileSync,statSync}=await import('node:fs');
  const evidence=JSON.parse(readFileSync(join(dir,'public-evidence/123.json')));
  assert.equal(evidence.post.note_tweet.text,'Long public production account');
  assert.equal(evidence.url,'https://x.com/Director/status/123');
  assert.equal((await call(['evidence','https://x.com/Director/status/123'])).post.id,'123');
  assert.equal('kind' in evidence,false);
  assert.equal(statSync(join(dir,'public-evidence/123.json')).mode&0o777,0o600);
  assert.equal((await call(['lookup',file('urls.json',['https://x.com/Director/status/123'])])).status,'no request due');
});


test('a partial group does not starve never-checked creator groups', async t=>{
  const {dir,file}=fixture(t);
  writeFileSync(join(dir,'film-queue.py'),'print("[]")\n');
  const watch=watchGroups({priority:['Director'],rotation:[['Studio'],['NewMaker']]});
  for(let i=0;i<3;i++){
    const call=argv=>runDiscovery({argv,dir,groups:watch,now,request:async url=>{
      assert.match(url.searchParams.get('query'),new RegExp('from:'+['Director','Studio','NewMaker'][i]));
      return page([], 'more');
    }});
    await call(['collect']);
    const pending=await call(['review']);
    await call(['ack',file('fair.json',{page:pending.id,leads:[]})]);
  }
});


test('detects a repeated continuation page and preserves its checkpoint', async t=>{
  const {dir,file,call}=fixture(t);
  writeFileSync(join(dir,'film-queue.py'),'print("[]")\n');
  await call(['collect','priority'],async()=>page(['123'],'next'));
  const p=await call(['review']);
  await call(['ack',file('empty.json',{page:p.id,leads:[]})]);
  await assert.rejects(call(['collect','priority'],async()=>page(['123'],'next-again')),/pagination made no progress/);
  assert.equal((await call(['review'])).pending,false);
  assert.equal((await call(['status'])).groups[0].partial,true);
  assert.equal((await call(['collect','priority'])).status,'no request due');
  await call(['collect'],async url=>{assert.match(url.searchParams.get('query'),/from:Studio/);return page([]);});
});

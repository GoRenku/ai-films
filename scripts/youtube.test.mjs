import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { channelRef, clock, runYouTube, seconds, uploadsPlaylist, videoId } from './youtube.mjs';

const key = 'offline-fixture-key-0123456789';
process.env.YOUTUBE_API_KEY = key;
const now = Date.parse('2026-11-20T12:00:00Z');
const CH = 'UC' + 'a'.repeat(22);

function fixture(t, handler) {
  const dir = mkdtempSync(join(tmpdir(), 'lm-yt-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const calls = [];
  const request = async (url, init) => {
    calls.push({ url, init });
    return Response.json(await handler(new URL(url), init));
  };
  return { calls, call: (argv, extra = {}) => runYouTube({ argv, dir, now, request, ...extra }) };
}

const video = (id, published, duration = 'PT5M3S') => ({
  id, snippet: { title: 'Film ' + id, channelId: CH, channelTitle: 'Maker', publishedAt: published, description: 'x'.repeat(800), thumbnails: { high: { url: 'https://i.ytimg.com/' + id, width: 480, height: 360 } } },
  contentDetails: { duration }, status: { embeddable: true, privacyStatus: 'public', uploadStatus: 'processed' },
});

test('parses video and channel references strictly', () => {
  assert.equal(videoId('https://www.youtube.com/watch?v=Ctfffa-PacA&t=3'), 'Ctfffa-PacA');
  assert.equal(videoId('https://youtu.be/Ctfffa-PacA'), 'Ctfffa-PacA');
  assert.equal(videoId('https://www.youtube.com/shorts/Ctfffa-PacA'), 'Ctfffa-PacA');
  assert.equal(videoId('https://evil.example/watch?v=Ctfffa-PacA'), undefined);
  assert.deepEqual(channelRef('https://www.youtube.com/@LostJoker'), { handle: '@LostJoker' });
  assert.deepEqual(channelRef('https://www.youtube.com/channel/' + CH), { id: CH });
  assert.equal(uploadsPlaylist(CH), 'UU' + 'a'.repeat(22));
  assert.equal(seconds('PT1H2M3S'), 3723);
  assert.equal(clock(256), '4:16');
  assert.equal(clock(3723), '1:02:03');
});

test('sends the key only in a header and returns full descriptions for video lookups', async t => {
  const { calls, call } = fixture(t, () => ({ items: [video('Ctfffa-PacA', '2026-11-18T17:00:06Z', 'PT4M16S')] }));
  const result = await call(['video', 'https://www.youtube.com/watch?v=Ctfffa-PacA', 'MISSING0000']);
  assert.equal(result.videos[0].duration, '4:16');
  assert.equal(result.videos[0].description.length, 800);
  assert.deepEqual(result.unavailable, ['MISSING0000']);
  assert.ok(!calls[0].url.includes(key));
  assert.equal(calls[0].init.headers['X-Goog-Api-Key'], key);
  assert.ok(!JSON.stringify(result).includes(key));
});

test('enforces the local daily unit ceiling before sending a search', async t => {
  const { calls, call } = fixture(t, () => ({ items: [] }));
  for (let i = 0; i < 80; i++) await call(['search', 'title', 'maker']);
  await assert.rejects(call(['search', 'title']), /quota ceiling/);
  assert.equal(calls.length, 80);
  assert.equal((await call(['status'], { channels: [] })).unitsUsedToday, 8000);
});

test('sweep reports only uploads newer than the last sweep and records progress', async t => {
  let items = [{ contentDetails: { videoId: 'NEWVIDEO001', videoPublishedAt: '2026-11-19T10:00:00Z' } }, { contentDetails: { videoId: 'OLDVIDEO001', videoPublishedAt: '2026-10-01T10:00:00Z' } }];
  const { call } = fixture(t, url => url.pathname.endsWith('/playlistItems')
    ? { items }
    : { items: url.searchParams.get('id').split(',').map(id => video(id, id === 'NEWVIDEO001' ? '2026-11-19T10:00:00Z' : '2026-11-20T09:00:00Z')) });
  const channels = [{ id: CH, title: 'Maker', kind: 'creator', artists: ['maker'] }];
  const first = await call(['sweep'], { channels });
  assert.deepEqual(first.uploads.map(v => v.id), ['NEWVIDEO001']);
  assert.deepEqual(first.uploads[0].registry.artists, ['maker']);
  items = [{ contentDetails: { videoId: 'NEWVIDEO002', videoPublishedAt: '2026-11-20T09:00:00Z' } }, ...items];
  const second = await call(['sweep'], { channels });
  assert.deepEqual(second.uploads.map(v => v.id), ['NEWVIDEO002']);
});

test('reports API errors by reason without leaking the key', async t => {
  const dir = mkdtempSync(join(tmpdir(), 'lm-yt-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const request = async () => Response.json({ error: { code: 403, errors: [{ reason: 'keyInvalid' }], message: 'bad ' + key } }, { status: 403 });
  await assert.rejects(runYouTube({ argv: ['video', 'Ctfffa-PacA'], dir, now, request }), error => error.message === 'YouTube videos failed: keyInvalid');
});

test('batches lookups beyond 50 videos without closing state early', async t => {
  const { calls, call } = fixture(t, url => ({ items: url.searchParams.get('id').split(',').map(id => video(id, '2026-11-01T00:00:00Z')) }));
  const ids = Array.from({ length: 120 }, (_, i) => 'VID' + String(i).padStart(8, '0'));
  const result = await call(['video', ...ids]);
  assert.equal(result.videos.length, 120);
  assert.equal(calls.length, 3);
});

test('audit flags unavailable and non-embeddable catalogue watch links', async t => {
  const films = mkdtempSync(join(tmpdir(), 'lm-yt-films-'));
  t.after(() => rmSync(films, { recursive: true, force: true }));
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(films, 'a.md'), '---\ntitle: "A"\nstatus: "Watch now"\nwatchUrl: "https://www.youtube.com/watch?v=GOODVIDEO01"\nepisodes: [{"title": "Two", "watchUrl": "https://youtu.be/GONEVIDEO01"}]\n---\nBody https://www.youtube.com/watch?v=IGNOREDBODY\n');
  writeFileSync(join(films, 'b.md'), '---\ntitle: "B"\nstatus: "Watch now"\nwatchUrl: "https://www.youtube.com/watch?v=NOEMBED0001"\n---\n');
  const { call } = fixture(t, url => ({ items: url.searchParams.get('id').split(',').filter(id => id !== 'GONEVIDEO01').map(id => {
    const v = video(id, '2026-11-01T00:00:00Z'); if (id === 'NOEMBED0001') v.status.embeddable = false; return v; }) }));
  const result = await call(['audit', '--films', films]);
  assert.equal(result.checkedLinks, 3);
  assert.deepEqual(result.problems.map(p => [p.film, p.id, p.issues[0]]), [['a', 'GONEVIDEO01', 'unavailable (deleted, private or wrong ID)'], ['b', 'NOEMBED0001', 'embedding disabled']]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditArtwork, imageSize } from './artwork.mjs';

function png(width, height) {
  const b = Buffer.alloc(33);
  b.writeUInt32BE(0x89504e47, 0); b.writeUInt32BE(0x0d0a1a0a, 4); b.write('IHDR', 12, 'ascii');
  b.writeUInt32BE(width, 16); b.writeUInt32BE(height, 20);
  return b;
}

function jpeg(width, height) {
  // SOI, an APP0 segment to skip, then SOF0 with the frame size.
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]);
  const sof = Buffer.alloc(19);
  sof.set([0xff, 0xc0, 0x00, 0x11, 0x08]);
  sof.writeUInt16BE(height, 5); sof.writeUInt16BE(width, 7);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof]);
}

function webpVp8x(width, height) {
  const b = Buffer.alloc(30);
  b.write('RIFF', 0, 'ascii'); b.write('WEBP', 8, 'ascii'); b.write('VP8X', 12, 'ascii');
  b.writeUIntLE(width - 1, 24, 3); b.writeUIntLE(height - 1, 27, 3);
  return b;
}

test('reads JPEG, PNG and WebP dimensions from headers', () => {
  assert.deepEqual(imageSize(png(1280, 720)), { width: 1280, height: 720 });
  assert.deepEqual(imageSize(jpeg(480, 360)), { width: 480, height: 360 });
  assert.deepEqual(imageSize(webpVp8x(1920, 1080)), { width: 1920, height: 1080 });
  assert.equal(imageSize(Buffer.from('not an image')), undefined);
});

test('flags narrow, letterboxed and missing artwork with upgrade hints', t => {
  const root = mkdtempSync(join(tmpdir(), 'lm-art-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const films = join(root, 'content', 'films');
  const media = join(root, 'public', 'media');
  mkdirSync(films, { recursive: true }); mkdirSync(media, { recursive: true });
  writeFileSync(join(media, 'wide.png'), png(1280, 720));
  writeFileSync(join(media, 'small.jpg'), jpeg(480, 360));
  writeFileSync(join(films, 'wide.md'), '---\ntitle: "Wide"\nimage: "/media/wide.png"\nwatchUrl: "https://www.youtube.com/watch?v=GOODVIDEO01"\n---\n');
  writeFileSync(join(films, 'small.md'), '---\ntitle: "Small"\nimage: "/media/small.jpg"\nimageSource: "https://www.youtube.com/watch?v=SMALLVIDEO1"\nepisodes: [{"title": "One", "image": "/media/gone.jpg"}]\n---\n');
  const result = auditArtwork({ contentDir: join(root, 'content'), publicDir: join(root, 'public') });
  assert.equal(result.checked, 3);
  assert.deepEqual(result.problems.map(p => [p.slug, p.role, p.issues]), [
    ['small', 'cover', ['narrow: 480x360', '4:3 YouTube thumbnail (likely letterboxed)']],
    ['small', 'episode or award', ['missing file']],
  ]);
  assert.equal(result.problems[0].youtube, 'SMALLVIDEO1');
});

// Offline artwork audit: reports catalogue artwork that is missing, too small for the
// 1280 x 720 film stage, or letterboxed 4:3 YouTube thumbnails. No network access.
import { existsSync, openSync, readSync, closeSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { videoId } from './youtube.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const MIN_WIDTH = 1200;
const MAX_BYTES = 5 * 1024 * 1024;

// Reads width and height from a JPEG, PNG or WebP header.
export function imageSize(buffer) {
  if (buffer.length >= 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buffer.toString('ascii', 12, 16);
    if (chunk === 'VP8 ') return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = buffer.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === 'VP8X') return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset++; continue; }
      const marker = buffer[offset + 1];
      if (marker === 0xff) { offset++; continue; }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      offset += 2 + length;
    }
  }
  return undefined;
}

function sizeOf(path) {
  const fd = openSync(path, 'r');
  try {
    const buffer = Buffer.alloc(Math.min(statSync(path).size, 512 * 1024));
    readSync(fd, buffer, 0, buffer.length, 0);
    return imageSize(buffer);
  } finally {
    closeSync(fd);
  }
}

const field = (text, key) => new RegExp('^' + key + ':\\s*"?([^"\\n]*)"?\\s*$', 'm').exec(text)?.[1];

// Every /media/ artwork reference in film and festival frontmatter, with the film's
// watch link and image source for upgrade hints.
export function artworkReferences(contentDir = join(ROOT, 'content')) {
  const refs = [];
  for (const collection of ['films', 'festivals']) {
    const dir = join(contentDir, collection);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter(name => name.endsWith('.md')).sort()) {
      const front = readFileSync(join(dir, file), 'utf8').split(/\n---\s*\n/)[0];
      const slug = file.replace(/\.md$/, '');
      const main = field(front, 'image');
      for (const match of front.matchAll(/"?image"?:\s*"(\/media\/[^"]+)"/g)) {
        const top = match[1] === main;
        refs.push({
          collection, slug, image: match[1], role: top ? 'cover' : 'episode or award',
          watchUrl: top ? field(front, 'watchUrl') : undefined,
          imageSource: top ? field(front, 'imageSource') : undefined,
        });
      }
    }
  }
  return refs;
}

export function auditArtwork({ contentDir = join(ROOT, 'content'), publicDir = join(ROOT, 'public'), minWidth = MIN_WIDTH } = {}) {
  const problems = [];
  const refs = artworkReferences(contentDir);
  for (const ref of refs) {
    const path = join(publicDir, ref.image);
    if (!existsSync(path)) { problems.push({ ...ref, issues: ['missing file'] }); continue; }
    const size = sizeOf(path);
    const bytes = statSync(path).size;
    const issues = [];
    if (!size) issues.push('unreadable dimensions');
    else {
      if (size.width < minWidth) issues.push(`narrow: ${size.width}x${size.height}`);
      if (Math.abs(size.width / size.height - 4 / 3) < 0.02 && [ref.imageSource, ref.watchUrl].some(videoId)) {
        issues.push('4:3 YouTube thumbnail (likely letterboxed)');
      }
    }
    if (bytes > MAX_BYTES) issues.push(`over 5 MB (${(bytes / 1048576).toFixed(1)} MB)`);
    if (!issues.length) continue;
    const youtube = videoId(ref.watchUrl ?? '') ?? videoId(ref.imageSource ?? '');
    problems.push({ ...ref, ...size, issues, youtube });
  }
  return { checked: refs.length, minWidth, problems };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const min = args.indexOf('--min');
  const result = auditArtwork({ minWidth: min >= 0 ? Number(args[min + 1]) : MIN_WIDTH });
  if (args.includes('--youtube-ids')) {
    console.log([...new Set(result.problems.map(p => p.youtube).filter(Boolean))].join(' '));
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

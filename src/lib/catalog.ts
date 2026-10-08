import { getCollection, type CollectionEntry } from 'astro:content';
import { readFileSync } from 'node:fs';

export type Film = CollectionEntry<'films'>;
export type Artist = CollectionEntry<'artists'>;
export type Update = CollectionEntry<'updates'>;

// Free-text genres stay editorial; these broad groups only power browsing.
const GENRE_GROUPS: [string, RegExp][] = [
  ['Sci-fi', /science|sci-fi|cyberpunk|dystopian/i],
  ['Fantasy', /fantas|myth|fairy|folklor|supernatural|gothic/i],
  ['Horror', /horror|liminal/i],
  ['Animation', /animat/i],
  ['Comedy', /comed|satir|sitcom/i],
  ['Thriller', /thriller|mystery|crime|caper|suspense|heist/i],
  ['Drama', /drama|romance|romantic|coming-of-age|memory|family|narrative|adaptation/i],
  ['History', /historical|period/i],
  ['Adventure', /adventure|action|survival|superhero/i],
  ['Documentary & essay', /documentar|essay|docudrama|experimental|reality/i],
];
export const genreGroups = GENRE_GROUPS.map(([name]) => name);
export const genresOf = (genre: string) => {
  const found = GENRE_GROUPS.filter(([, re]) => re.test(genre)).map(([name]) => name);
  return found.length ? found : ['Drama'];
};

export const statusKey = (status: Film['data']['status']) =>
  ({ 'Watch now': 'live', 'Coming soon': 'soon', 'Festival screening': 'fest', 'In theaters': 'cinema', Released: 'released' })[status];
export const statusLabel = (status: Film['data']['status']) => (status === 'Festival screening' ? 'Festival' : status);

/** A playable embed for YouTube and Vimeo links; everything else opens at the source. */
export function embedOf(url?: string) {
  if (!url) return undefined;
  const yt = url.match(/(?:youtube\.com\/watch\?(?:[^#]*&)?v=|youtu\.be\/)([\w-]{11})/);
  if (yt) return { provider: 'YouTube', src: `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0&modestbranding=1` };
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { provider: 'Vimeo', src: `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&dnt=1&title=0&byline=0` };
  return undefined;
}
export function hostOf(url: string) {
  const host = new URL(url).hostname.replace(/^www\./, '');
  return ({ 'youtube.com': 'YouTube', 'youtu.be': 'YouTube', 'vimeo.com': 'Vimeo', 'x.com': 'X', 'primevideo.com': 'Prime Video', 'bilibili.com': 'Bilibili', 'linkedin.com': 'LinkedIn' } as Record<string, string>)[host] ?? host;
}

/** Pixel width of a JPEG, PNG or WebP in public/, read from its header; 0 when unknown.
 *  Paths resolve from the project root (Astro's working directory): bundled build chunks live elsewhere, so import.meta.url cannot be used. */
export function imageWidth(src?: string) {
  if (!src) return 0;
  let b: Uint8Array;
  try {
    b = readFileSync(`public${src}`);
  } catch {
    return 0;
  }
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to));
  if (v.getUint32(0) === 0x89504e47) return v.getUint32(16);
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    const chunk = ascii(12, 16);
    if (chunk === 'VP8 ') return v.getUint16(26, true) & 0x3fff;
    if (chunk === 'VP8L') return 1 + (((b[22] & 0x3f) << 8) | b[21]);
    if (chunk === 'VP8X') return 1 + (b[24] | (b[25] << 8) | (b[26] << 16));
    return 0;
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i < b.length - 9; ) {
      if (b[i] !== 0xff) { i++; continue; }
      const marker = b[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return v.getUint16(i + 7);
      i += 2 + v.getUint16(i + 2);
    }
  }
  return 0;
}

const DAY = 86_400_000;
const toTime = (date: string) => Date.parse(`${date}T12:00:00Z`);
export const displayDate = (date: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(new Date(toTime(date)));
export const shortDate = (date: string) => displayDate(date, { day: 'numeric', month: 'short' });
export const minutes = (n?: number) => (n ? `${Math.max(1, Math.round(n))} min` : undefined);
export const initials = (name: string) =>
  name.split(/[\s&]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const newestFirst = (a: Film, b: Film) =>
  b.data.discoveredAt.localeCompare(a.data.discoveredAt) || a.data.order - b.data.order || a.data.title.localeCompare(b.data.title);

let cached: Awaited<ReturnType<typeof build>> | undefined;
export const catalog = async () => (cached ??= await build());

async function build() {
  const [rawFilms, artists, rawUpdates] = await Promise.all([getCollection('films'), getCollection('artists'), getCollection('updates')]);
  const films = [...rawFilms].sort(newestFirst);
  const updates = [...rawUpdates].sort((a, b) => b.data.date.localeCompare(a.data.date) || a.id.localeCompare(b.id));
  const artistById = new Map(artists.map((a) => [a.id, a]));
  const filmById = new Map(films.map((f) => [f.id, f]));
  const latest = [...films.map((f) => f.data.discoveredAt), ...artists.map((a) => a.data.discoveredAt), ...updates.map((u) => u.data.date)].sort().at(-1)!;

  const artistOf = (film: Film) => {
    const artist = artistById.get(film.data.artist.id);
    if (!artist) throw new Error(`Missing artist for ${film.id}`);
    return artist;
  };
  const filmsBy = (artistId: string) => films.filter((f) => f.data.artist.id === artistId);
  const notesAbout = (artistId: string) => updates.filter((u) => u.data.artists.some((a) => a.id === artistId));
  /** Badges mark the last few days of additions; the weekly tally covers seven. */
  const isNew = (date: string) => toTime(latest) - toTime(date) < 3 * DAY;
  const thisWeek = (date: string) => toTime(latest) - toTime(date) < 7 * DAY;
  const lastActive = (artist: Artist) =>
    [artist.data.discoveredAt, ...filmsBy(artist.id).map((f) => f.data.discoveredAt), ...notesAbout(artist.id).map((u) => u.data.date)].sort().at(-1)!;
  const coverFor = (artist: Artist) => filmsBy(artist.id).find((f) => f.data.image);
  const artistsByActivity = [...artists].sort((a, b) => lastActive(b).localeCompare(lastActive(a)) || a.data.title.localeCompare(b.data.title));
  const notesFilms = (update: Update) => update.data.films.map((r) => filmById.get(r.id)).filter((f): f is Film => Boolean(f));

  return { films, artists, updates, latest, artistOf, filmsBy, notesAbout, isNew, thisWeek, lastActive, coverFor, artistsByActivity, notesFilms, filmById, artistById };
}

export type NewsItem = { title: string; description: string; date: string; kind: 'Film' | 'Artist' | 'Journal'; href: string; image?: string; fit?: string; by?: string };
export async function news(): Promise<NewsItem[]> {
  const c = await catalog();
  const rank = { Film: 0, Journal: 1, Artist: 2 };
  return [
    ...c.films.map((f) => ({ title: f.data.title, description: f.data.description, date: f.data.discoveredAt, kind: 'Film' as const, href: `/films/${f.id}/`, image: f.data.image, fit: f.data.imageFit, by: c.artistOf(f).data.title })),
    ...c.artists.map((a) => {
      const cover = c.coverFor(a);
      return { title: a.data.title, description: a.data.description, date: a.data.discoveredAt, kind: 'Artist' as const, href: `/artists/${a.id}/`, image: cover?.data.image, fit: 'cover', by: a.data.focus };
    }),
    ...c.updates.map((u) => {
      const cover = c.notesFilms(u).find((f) => f.data.image);
      return { title: u.data.title, description: u.data.description, date: u.data.date, kind: 'Journal' as const, href: `/journal/${u.id}/`, image: cover?.data.image, fit: 'cover', by: 'Field note' };
    }),
  ].sort((a, b) => b.date.localeCompare(a.date) || rank[a.kind] - rank[b.kind] || a.title.localeCompare(b.title));
}

import { getCollection, type CollectionEntry } from 'astro:content';

export type Film = CollectionEntry<'films'>;
export type Artist = CollectionEntry<'artists'>;
export type Update = CollectionEntry<'updates'>;
export type Festival = CollectionEntry<'festivals'>;
export type Edition = Festival['data']['editions'][number];
export type Award = Edition['awards'][number];
/** One festival result, resolved against the catalogue. */
export type Recognition = { festival: Festival; edition: Edition; award: Award; film?: Film; artist?: Artist; addedAt: string; decisive: boolean };

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
  ['Music video', /^music video$/i],
];
export const genreGroups = GENRE_GROUPS.map(([name]) => name);
export const genresOf = (genre: string) => {
  const found = GENRE_GROUPS.filter(([, re]) => re.test(genre)).map(([name]) => name);
  return found.length ? found : ['Drama'];
};

export const statusKey = (status: Film['data']['status']) =>
  ({ 'Watch now': 'live', 'Coming soon': 'soon', 'Festival screening': 'fest', 'In theaters': 'cinema', Released: 'released' })[status];
export const isMusicVideo = (film: Film) => film.data.format === 'Music video';
/** What to call a work in buttons and labels: a music video is not a "film". */
export const workNoun = (film: Film) => (isMusicVideo(film) ? 'video' : 'film');
/** One counting rule: shorts, features and series are films; music videos are counted separately. */
export function workTally(works: Film[]) {
  const videos = works.filter(isMusicVideo).length;
  const films = works.length - videos;
  const parts = [];
  if (films > 0 || videos === 0) parts.push(`${films} ${films === 1 ? 'film' : 'films'}`);
  if (videos > 0) parts.push(`${videos} music ${videos === 1 ? 'video' : 'videos'}`);
  return parts.join(' · ');
}
/** A page's share picture: the film's own credited artwork, used unchanged (the schema requires alt text with every image). */
export const shareImageOf = (film?: Film) => (film?.data.image && film.data.imageAlt ? { src: film.data.image, alt: film.data.imageAlt } : undefined);
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

export type Status = Film['data']['status'];
export type Episode = {
  series: Film;
  /** Stable URL segment: the number (s2e3 in later seasons), or the title slug when unnumbered. */
  key: string;
  number?: number;
  season?: number;
  /** "Episode 2", or the episode title when the maker does not number it. */
  label: string;
  /** The episode's own title, when it has one beyond its number. */
  title?: string;
  synopsis?: string;
  releasedOn?: string;
  addedAt: string;
  runtimeMinutes?: number;
  status: Status;
  watchUrl?: string;
  watchLabel?: string;
  image?: string;
  imageAlt?: string;
  imageCredit?: string;
  imageSource?: string;
  imageFit: 'cover' | 'contain';
  source?: string;
  /** A standalone film entry this episode links to (anthology stories). */
  film?: Film;
  /** Where the episode lives on this site; announced episodes have no page. */
  href?: string;
};
const slug = (text: string) => text.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** A series is as available as its most available episode. */
const STATUS_RANK: Status[] = ['Watch now', 'In theaters', 'Festival screening', 'Released', 'Coming soon'];
export const seriesStatus = (episodes: Episode[]) => STATUS_RANK.find((s) => episodes.some((e) => e.status === s))!;
/** Where a new viewer starts: the first episode that plays, else the first with any watch link. */
export const startEpisode = (episodes: Episode[]) =>
  episodes.find((e) => e.status === 'Watch now') ?? episodes.find((e) => e.watchUrl) ?? episodes.find((e) => e.href) ?? episodes[0];
/** Episodes that have come out, in order; announced ones are listed but not counted. */
export const releasedEpisodes = (episodes: Episode[]) => episodes.filter((e) => e.status !== 'Coming soon');
/** Combined running time, only when every released episode's length is known. */
export const totalMinutesOf = (episodes: Episode[]) => {
  const out = releasedEpisodes(episodes);
  return out.length && out.every((e) => e.runtimeMinutes) ? out.reduce((sum, e) => sum + e.runtimeMinutes!, 0) : undefined;
};
/** "3 episodes", "1 chapter": how a series card states its length. */
export const episodeCount = (film: Film) => {
  const n = film.data.episodes.filter((e) => e.status !== 'Coming soon').length;
  const noun = film.data.episodeNoun.toLowerCase();
  return n ? `${n} ${noun}${n === 1 ? '' : 's'}` : undefined;
};
/** The length shown beside a title: episodes for a series, minutes for everything else. */
export const lengthOf = (film: Film) => (film.data.format === 'Series' ? episodeCount(film) : minutes(film.data.runtimeMinutes));

const DAY = 86_400_000;
export const toTime = (date: string) => Date.parse(`${date}T12:00:00Z`);
export const displayDate = (date: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(new Date(toTime(date)));
export const shortDate = (date: string) => displayDate(date, { day: 'numeric', month: 'short' });
export const minutes = (n?: number) => (n ? `${Math.max(1, Math.round(n))} min` : undefined);
/** "1 hr 8 min" for a series' combined running time. */
export const longMinutes = (n?: number) => {
  if (!n) return undefined;
  const m = Math.max(1, Math.round(n));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ''}`;
};
export const initials = (name: string) =>
  name.split(/[\s&]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const newestFirst = (a: Film, b: Film) =>
  b.data.discoveredAt.localeCompare(a.data.discoveredAt) || a.data.order - b.data.order || a.data.title.localeCompare(b.data.title);

/** Results in the order a page lists them: wins before selections. */
export const RESULT_RANK: Award['result'][] = ['Winner', 'Runner-up', 'Jury selection', 'Audience choice', 'Honourable mention', 'Finalist', 'Shortlisted', 'Nominee', 'Official selection'];
export const isDecisive = (award: Award) => RESULT_RANK.indexOf(award.result) < 5;
/** When an edition's results were published; editions without them sort by their last milestone. */
export const resultsDateOf = (edition: Edition) => (edition.milestones.findLast((m) => m.kind === 'Results') ?? edition.milestones.at(-1)!).date;
/** "Winner · Grand Prix", or just "Official selection" when the category only repeats the result. */
export const awardLabel = (award: Award) => (award.category.toLowerCase() === award.result.toLowerCase() ? award.result : `${award.result} · ${award.category}`);
/** The awarded work as the organiser named it: a catalogue film, its awarded episode, or a title outside the collection. */
export const workName = (r: Recognition) => (r.film ? `${r.film.data.title}${r.award.title ? `: ${r.award.title}` : ''}` : r.award.title!);
/** "Lumara Film Festival 2026", without repeating a year already in the title. */
export const editionName = (festival: Festival, edition: Edition) => (festival.data.title.includes(edition.label) ? festival.data.title : `${festival.data.title} ${edition.label}`);

let cached: Awaited<ReturnType<typeof build>> | undefined;
export const catalog = async () => (cached ??= await build());

async function build() {
  const [rawFilms, artists, rawUpdates, rawFestivals] = await Promise.all([getCollection('films'), getCollection('artists'), getCollection('updates'), getCollection('festivals')]);
  const films = [...rawFilms].sort(newestFirst);
  const updates = [...rawUpdates].sort((a, b) => b.data.date.localeCompare(a.data.date) || a.id.localeCompare(b.id));
  const artistById = new Map(artists.map((a) => [a.id, a]));
  const filmById = new Map(films.map((f) => [f.id, f]));
  const episodeDates = films.flatMap((f) => f.data.episodes.map((e) => e.addedAt).filter((d): d is string => Boolean(d)));
  const festivals = [...rawFestivals].sort((a, b) => a.data.title.localeCompare(b.data.title));
  const awardDates = festivals.flatMap((f) => f.data.editions.flatMap((e) => e.awards.map((a) => a.addedAt ?? f.data.discoveredAt)));
  const latest = [...films.map((f) => f.data.discoveredAt), ...episodeDates, ...artists.map((a) => a.data.discoveredAt), ...updates.map((u) => u.data.date), ...festivals.map((f) => f.data.discoveredAt), ...awardDates].sort().at(-1)!;

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

  // Resolve every series' episodes once, and check what the schema cannot see across entries.
  const episodesById = new Map<string, Episode[]>();
  const membership = new Map<string, { series: Film; episode: Episode }>();
  for (const series of films.filter((f) => f.data.format === 'Series')) {
    const d = series.data;
    const seasons = new Set(d.episodes.map((e) => e.season ?? 1)).size;
    const episodes = d.episodes.map((e): Episode => {
      const numbered = e.number !== undefined ? `${d.episodeNoun} ${e.number}` : undefined;
      const label = seasons > 1 && e.number !== undefined ? `S${e.season ?? 1} · ${numbered}` : numbered;
      if (e.film) {
        const film = filmById.get(e.film.id);
        if (!film) throw new Error(`${series.id}: episode links to missing film ${e.film.id}`);
        if (film.data.format === 'Series') throw new Error(`${series.id}: episode ${film.id} is itself a series`);
        const f = film.data;
        return {
          series, key: film.id, number: e.number, season: e.season, label: label ?? f.title, title: label ? f.title : undefined,
          synopsis: f.description, addedAt: e.addedAt ?? f.discoveredAt, runtimeMinutes: f.runtimeMinutes, status: f.status,
          watchUrl: f.watchUrl, watchLabel: f.watchLabel, image: f.image, imageAlt: f.imageAlt, imageCredit: f.imageCredit,
          imageSource: f.imageSource, imageFit: f.imageFit, source: f.sources[0].url, film, href: `/films/${film.id}/`,
        };
      }
      const key = e.number !== undefined ? (seasons > 1 ? `s${e.season ?? 1}e${e.number}` : String(e.number)) : slug(e.title!);
      return {
        series, key, number: e.number, season: e.season, label: label ?? e.title!, title: label ? e.title : undefined,
        synopsis: e.synopsis, releasedOn: e.releasedOn, addedAt: e.addedAt ?? d.discoveredAt, runtimeMinutes: e.runtimeMinutes,
        status: e.status!, watchUrl: e.watchUrl, watchLabel: e.watchLabel, image: e.image, imageAlt: e.imageAlt,
        imageCredit: e.imageCredit, imageSource: e.imageSource, imageFit: e.image ? 'cover' : d.imageFit, source: e.source,
        // An episode known only from a catalogue count gets a row, not a page of its own.
        href: e.status !== 'Coming soon' && (e.watchUrl || e.synopsis || e.image) ? `/films/${series.id}/episodes/${key}/` : undefined,
      };
    });
    if (new Set(episodes.map((e) => e.key)).size !== episodes.length) throw new Error(`${series.id}: two episodes share a URL`);
    const status = seriesStatus(episodes);
    if (d.status !== status) throw new Error(`${series.id}: series status must be "${status}", the most available episode's status`);
    const start = startEpisode(episodes);
    // With no episode link (an announced pilot), the series may still point at its official page.
    if (d.watchUrl && start.watchUrl && d.watchUrl !== start.watchUrl) throw new Error(`${series.id}: series watchUrl must be where viewers start (${start.label})`);
    for (const ep of episodes.filter((e) => e.film)) {
      if (membership.has(ep.film!.id)) throw new Error(`${ep.film!.id} is an episode of two series`);
      membership.set(ep.film!.id, { series, episode: ep });
    }
    episodesById.set(series.id, episodes);
  }
  const episodesOf = (film: Film) => episodesById.get(film.id) ?? [];
  /** The series a standalone film belongs to as an episode, if any. */
  const seriesOf = (film: Film) => membership.get(film.id);
  /** When a work last gained something: a series counts its newest episode. */
  const addedOf = (film: Film) => [film.data.discoveredAt, ...episodesOf(film).map((e) => e.addedAt)].sort().at(-1)!;
  /** The badge a card shows: New for new work, New episode (or chapter, part) when an older series continues. */
  const freshOf = (film: Film) =>
    isNew(film.data.discoveredAt) ? 'New' : isNew(addedOf(film)) ? `New ${film.data.episodeNoun.toLowerCase()}` : undefined;
  /** Inline episodes that joined after their series did; each gets its own What's New item. */
  const laterEpisodes = [...episodesById.values()].flat().filter((e) => !e.film && e.href && e.addedAt > e.series.data.discoveredAt);

  // Festival results, resolved once; every reference must exist.
  const recognitions: Recognition[] = festivals.flatMap((festival) =>
    festival.data.editions.flatMap((edition) =>
      edition.awards.map((award) => {
        const film = award.film ? filmById.get(award.film.id) : undefined;
        if (award.film && !film) throw new Error(`${festival.id}: award links to missing film ${award.film.id}`);
        const artist = award.artist ? artistById.get(award.artist.id) : film ? artistOf(film) : undefined;
        if (award.artist && !artist) throw new Error(`${festival.id}: award links to missing artist ${award.artist.id}`);
        return { festival, edition, award, film, artist, addedAt: award.addedAt ?? festival.data.discoveredAt, decisive: isDecisive(award) };
      }),
    ),
  );
  const byResult = (a: Recognition, b: Recognition) => RESULT_RANK.indexOf(a.award.result) - RESULT_RANK.indexOf(b.award.result);
  /** Results for an artist's own films, and awards made to them by name. */
  const recognitionsOf = (artistId: string) =>
    recognitions
      .filter((r) => r.artist?.id === artistId || r.film?.data.artist.id === artistId)
      .sort((a, b) => Number(b.decisive) - Number(a.decisive) || resultsDateOf(b.edition).localeCompare(resultsDateOf(a.edition)) || byResult(a, b));
  const recognitionsFor = (filmId: string) => recognitions.filter((r) => r.film?.id === filmId).sort(byResult);
  const festivalById = new Map(festivals.map((f) => [f.id, f]));
  const notesOnFestival = (festivalId: string) => updates.filter((u) => u.data.festivals.some((f) => f.id === festivalId));
  /** A festival card's picture: its own credited artwork, else the newest decisive winner's. */
  const festivalCover = (festival: Festival): { src: string; alt: string; fit: string } | undefined => {
    if (festival.data.image) return { src: festival.data.image, alt: festival.data.imageAlt!, fit: 'cover' };
    const winner = [...recognitions.filter((r) => r.festival.id === festival.id && r.film?.data.image)].sort((a, b) => resultsDateOf(b.edition).localeCompare(resultsDateOf(a.edition)) || byResult(a, b))[0]?.film;
    return winner ? { src: winner.data.image!, alt: winner.data.imageAlt!, fit: winner.data.imageFit } : undefined;
  };

  return { films, artists, updates, festivals, recognitions, recognitionsOf, recognitionsFor, festivalById, notesOnFestival, festivalCover, latest, artistOf, filmsBy, notesAbout, isNew, thisWeek, lastActive, coverFor, artistsByActivity, notesFilms, filmById, artistById, episodesOf, seriesOf, addedOf, freshOf, laterEpisodes };
}

export type NewsItem = { title: string; description: string; date: string; kind: 'Film' | 'Episode' | 'Artist' | 'Journal' | 'Festival'; label: string; href: string; image?: string; fit?: string; by?: string };
export async function news(): Promise<NewsItem[]> {
  const c = await catalog();
  const rank = { Film: 0, Episode: 1, Festival: 2, Journal: 3, Artist: 4 };
  // A festival appears when it joins, and again on each later day its results were recorded.
  const festivalNews = c.festivals.flatMap((f) => {
    const cover = c.festivalCover(f);
    const joined = { title: f.data.title, description: f.data.description, date: f.data.discoveredAt, kind: 'Festival' as const, label: `New ${f.data.type.toLowerCase()}`, href: `/festivals/${f.id}/`, image: cover?.src, fit: cover?.fit, by: f.data.organiser };
    const later = f.data.editions.flatMap((e) => {
      const dates = [...new Set(c.recognitions.filter((r) => r.edition === e && r.addedAt > f.data.discoveredAt).map((r) => r.addedAt))];
      return dates.map((date) => {
        const winner = c.recognitions.find((r) => r.edition === e && r.addedAt === date && r.film?.data.image)?.film;
        return { title: `${editionName(f, e)}: results`, description: f.data.description, date, kind: 'Festival' as const, label: 'Festival results', href: `/festivals/${f.id}/`, image: winner?.data.image ?? cover?.src, fit: winner?.data.imageFit ?? cover?.fit, by: f.data.organiser };
      });
    });
    return [joined, ...later];
  });
  return [
    ...c.films.map((f) => ({ title: f.data.title, description: f.data.description, date: f.data.discoveredAt, kind: 'Film' as const, label: isMusicVideo(f) ? 'New music video' : 'New film', href: `/films/${f.id}/`, image: f.data.image, fit: f.data.imageFit, by: c.artistOf(f).data.title })),
    ...c.laterEpisodes.map((e) => ({ title: `${e.series.data.title} — ${e.label}${e.title ? `: ${e.title}` : ''}`, description: e.synopsis ?? e.series.data.description, date: e.addedAt, kind: 'Episode' as const, label: `New ${e.series.data.episodeNoun.toLowerCase()}`, href: e.href!, image: e.image ?? e.series.data.image, fit: e.image ? 'cover' : e.series.data.imageFit, by: c.artistOf(e.series).data.title })),
    ...c.artists.map((a) => {
      const cover = c.coverFor(a);
      return { title: a.data.title, description: a.data.description, date: a.data.discoveredAt, kind: 'Artist' as const, label: 'New artist', href: `/artists/${a.id}/`, image: cover?.data.image, fit: 'cover', by: a.data.focus };
    }),
    ...festivalNews,
    ...c.updates.map((u) => {
      const cover = c.notesFilms(u).find((f) => f.data.image);
      return { title: u.data.title, description: u.data.description, date: u.data.date, kind: 'Journal' as const, label: 'Journal', href: `/journal/${u.id}/`, image: cover?.data.image, fit: 'cover', by: 'Field note' };
    }),
  ].sort((a, b) => b.date.localeCompare(a.date) || rank[a.kind] - rank[b.kind] || a.title.localeCompare(b.title));
}

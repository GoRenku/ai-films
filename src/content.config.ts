import { defineCollection, reference } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";
const url = z.url().refine((v) => v.startsWith("https://"), "Use HTTPS links");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const source = z.object({ label: z.string(), url });
const common = {
  title: z.string(),
  description: z.string(),
  discoveredAt: date,
  lastVerifiedAt: date,
  sources: z.array(source).min(1),
};
const artists = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/artists" }),
  schema: z.object({
    ...common,
    alias: z.string().optional(),
    focus: z.string(),
    website: url,
    x: z
      .object({
        url: url.refine(
          (v) => /^https:\/\/x\.com\/[A-Za-z0-9_]+$/.test(v),
          "Use an X profile URL",
        ),
        label: z.string(),
        source: url,
      })
      .optional(),
    featured: z.boolean().default(false),
  }),
});
const status = z.enum(["Watch now", "Festival screening", "Coming soon", "Released", "In theaters"]);
// A series lists its episodes in release order. An episode is either described inline
// or points at a standalone film entry (anthology stories with their own page and notebook).
const episode = z
  .object({
    film: reference("films").optional(),
    // As numbered by the maker; omit when the release does not number it.
    number: z.number().int().nonnegative().optional(),
    season: z.number().int().positive().optional(),
    title: z.string().optional(),
    synopsis: z.string().optional(),
    // When the maker released it, and when it joined the collection (defaults to the series' discoveredAt).
    releasedOn: date.optional(),
    addedAt: date.optional(),
    runtimeMinutes: z.number().positive().optional(),
    // Coming soon means announced: sourced, but never playable.
    status: status.optional(),
    watchUrl: url.optional(),
    watchLabel: z.string().optional(),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    imageCredit: z.string().optional(),
    imageSource: url.optional(),
    source: url.optional(),
  })
  .refine(
    (e) =>
      !e.film ||
      [e.title, e.synopsis, e.releasedOn, e.runtimeMinutes, e.status, e.watchUrl, e.watchLabel, e.image, e.source].every((v) => v === undefined),
    "A linked episode takes its details from its film entry; give only film, number, season and addedAt",
  )
  .refine((e) => Boolean(e.film) || Boolean(e.status && e.source), "An inline episode needs a status and a source")
  .refine((e) => Boolean(e.film) || e.number !== undefined || Boolean(e.title), "An inline episode needs a number or a title")
  .refine((e) => e.status !== "Watch now" || Boolean(e.watchUrl), "Watch now needs a watch link")
  .refine((e) => e.status !== "Coming soon" || !e.watchUrl, "Announced episodes are not playable; cite the announcement as source")
  .refine((e) => !e.image || Boolean(e.imageAlt && e.imageCredit && e.imageSource), "Artwork requires alt text, credit and source");
const films = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/films" }),
  schema: z
    .object({
      ...common,
      artist: reference("artists"),
      year: z.number().int(),
      format: z.enum(["Short film", "Feature", "Series", "Music video"]),
      // The credited song artist, for music videos.
      musician: z.string().optional(),
      genre: z.string(),
      runtimeMinutes: z.number().positive().optional(),
      status,
      watchUrl: url.optional(),
      watchLabel: z.string().default("Watch film"),
      image: z.string().optional(),
      imageAlt: z.string().optional(),
      imageFit: z.enum(["cover", "contain"]).default("cover"),
      imageCredit: z.string().optional(),
      imageSource: url.optional(),
      production: z
        .array(z.object({ label: z.string(), detail: z.string(), source: url }))
        .default([]),
      featured: z.boolean().default(false),
      order: z.number().default(99),
      // Series only: Episode, Chapter or Part, as the maker names them.
      episodeNoun: z.enum(["Episode", "Chapter", "Part"]).default("Episode"),
      episodes: z.array(episode).default([]),
    })
    .refine(
      (v) => !v.image || Boolean(v.imageAlt && v.imageCredit && v.imageSource),
      "Artwork requires alt text, credit and source",
    )
    .refine(
      (v) => !v.featured || Boolean(v.image),
      "Featured films require artwork",
    )
    .refine(
      (v) => (v.format === "Music video") === (v.genre === "Music video"),
      "Music videos, and only music videos, use the genre Music video",
    )
    .refine(
      (v) => !v.musician || v.format === "Music video",
      "Only music videos credit a musician",
    )
    .refine(
      (v) => v.status !== "Watch now" || Boolean(v.watchUrl),
      "Watch now needs a watch link",
    )
    .refine(
      (v) => (v.format === "Series") === v.episodes.length > 0,
      "Series, and only series, list their episodes",
    )
    .refine(
      (v) => v.format !== "Series" || v.runtimeMinutes === undefined,
      "Series runtimes belong to their episodes",
    )
    .refine(
      (v) => {
        const keys = v.episodes.map((e) => `${e.season ?? 1}:${e.number ?? e.title ?? e.film?.id}`);
        return new Set(keys).size === keys.length;
      },
      "Episode numbers must be unique within a season",
    ),
});
// Festivals and competitions. Each edition is a dated list of what the organiser announced;
// its state (open for entries, voting, results) is worked out from those dates, never typed in.
const milestoneKinds = [
  "Entries open", "Early deadline", "Deadline", "Final deadline",
  "Shortlist", "Finalists", "Voting opens", "Voting closes",
  "Screening", "Ceremony", "Results",
] as const;
const milestone = z
  .object({
    kind: z.enum(milestoneKinds),
    date,
    // Multi-day screenings and festivals.
    endDate: date.optional(),
    note: z.string().optional(),
    source: url,
  })
  .refine((m) => !m.endDate || m.endDate >= m.date, "A milestone cannot end before it starts");
// Decisive results need the organiser's published results; selections can come from a shortlist or programme.
// When the organiser does not date the announcement, the screening or ceremony where winners were shown dates them.
const held: string[] = ["Results", "Ceremony", "Screening"];
const decisive = ["Winner", "Runner-up", "Jury selection", "Audience choice", "Honourable mention"] as const;
const selections = ["Finalist", "Shortlisted", "Nominee", "Official selection"] as const;
const award = z
  .object({
    category: z.string(),
    result: z.enum([...decisive, ...selections]),
    // A catalogue film, or the work's title when it is not in the collection.
    // With a film, title names the episode or cut the organiser awarded.
    film: reference("films").optional(),
    title: z.string().optional(),
    // Awards to a person (Best Director) or a co-credited maker; a film's own artist is implied.
    artist: reference("artists").optional(),
    // Exactly as the organiser credits it.
    credit: z.string(),
    // The official full release of a work outside the collection (a catalogue film uses its own watchUrl).
    watchUrl: url.optional(),
    // False when the uploader has disabled embedding: the card then links out instead of playing.
    embeddable: z.boolean().default(true),
    // When the result joined the collection (defaults to the festival's discoveredAt).
    addedAt: date.optional(),
    source: url,
  })
  .refine((a) => Boolean(a.film) || Boolean(a.title), "An award names a catalogue film or, for work outside the collection, its title")
  .refine((a) => !a.film || !a.watchUrl, "A catalogue film plays from its own entry; give watchUrl only for work outside the collection");
const edition = z
  .object({
    // "2026", "Season 2", "September 2026", as the organiser names it.
    label: z.string(),
    location: z.string(),
    url: url.optional(),
    submitUrl: url.optional(),
    brief: z.string().optional(),
    eligibility: z.string().optional(),
    prizes: z.string().optional(),
    jury: z.string().optional(),
    milestones: z.array(milestone).min(1),
    awards: z.array(award).default([]),
  })
  .refine((e) => e.milestones.every((m, i) => i === 0 || e.milestones[i - 1].date <= m.date), "List milestones in date order")
  .refine(
    (e) => !e.awards.some((a) => (decisive as readonly string[]).includes(a.result)) || e.milestones.some((m) => held.includes(m.kind)),
    "Winners need a dated Results, Ceremony or Screening milestone",
  )
  .refine((e) => !e.submitUrl || e.milestones.some((m) => /deadline/i.test(m.kind)), "An entry link needs a sourced deadline");
const festivals = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/festivals" }),
  schema: z
    .object({
      ...common,
      type: z.enum(["Festival", "Competition"]),
      // Who runs it: an independent AI festival, a strand of an established festival, an AI platform or brand, or a foundation.
      kind: z.enum(["Independent", "Strand of an established festival", "Brand or platform", "Foundation prize"]),
      // The established festival an AI strand belongs to.
      parent: z.string().optional(),
      organiser: z.string(),
      // Platforms, brands and backers, always disclosed.
      sponsors: z.string().optional(),
      cadence: z.enum(["Annual", "Biannual", "Seasonal", "First edition"]),
      website: url,
      x: z
        .object({
          url: url.refine((v) => /^https:\/\/x\.com\/[A-Za-z0-9_]+$/.test(v), "Use an X profile URL"),
          label: z.string(),
          source: url,
        })
        .optional(),
      image: z.string().optional(),
      imageAlt: z.string().optional(),
      imageCredit: z.string().optional(),
      imageSource: url.optional(),
      // Oldest first, like episodes.
      editions: z.array(edition).min(1),
    })
    .refine((v) => !v.image || Boolean(v.imageAlt && v.imageCredit && v.imageSource), "Artwork requires alt text, credit and source")
    .refine((v) => (v.kind === "Strand of an established festival") === Boolean(v.parent), "Strands, and only strands, name their parent festival")
    .refine(
      (v) =>
        v.editions.every(
          (e) => !e.awards.some((a) => (decisive as readonly string[]).includes(a.result)) || e.milestones.some((m) => held.includes(m.kind) && m.date <= v.lastVerifiedAt),
        ),
      "Winners must come from an event held by the time the festival was last verified",
    )
    .refine((v) => new Set(v.editions.map((e) => e.label)).size === v.editions.length, "Edition labels must be unique"),
});
const updates = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/updates" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date,
    films: z.array(reference("films")).default([]),
    artists: z.array(reference("artists")).default([]),
    festivals: z.array(reference("festivals")).default([]),
    sources: z.array(source).min(1),
  }),
});
export const collections = { artists, films, festivals, updates };

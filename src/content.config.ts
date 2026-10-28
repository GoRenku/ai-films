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
const updates = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/updates" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date,
    films: z.array(reference("films")).default([]),
    artists: z.array(reference("artists")).default([]),
    sources: z.array(source).min(1),
  }),
});
export const collections = { artists, films, updates };

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
const films = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./content/films" }),
  schema: z
    .object({
      ...common,
      artist: reference("artists"),
      year: z.number().int(),
      format: z.enum(["Short film", "Feature", "Series"]),
      genre: z.string(),
      runtimeMinutes: z.number().positive().optional(),
      status: z.enum(["Watch now", "Festival screening", "Coming soon", "Released", "In theaters"]),
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
      (v) => v.status !== "Watch now" || Boolean(v.watchUrl),
      "Watch now needs a watch link",
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

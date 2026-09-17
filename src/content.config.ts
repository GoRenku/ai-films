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
      status: z.enum(["Watch now", "Festival screening", "Coming soon"]),
      watchUrl: url.optional(),
      watchLabel: z.string().default("Watch film"),
      image: z.string(),
      imageAlt: z.string(),
      imageCredit: z.string(),
      imageSource: url,
      featured: z.boolean().default(false),
      order: z.number().default(99),
    })
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

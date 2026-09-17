# AI Film Journal

A small, static Astro site for discovering AI films and filmmakers. Content lives in Markdown; Git records all edits. No database, CMS, or runtime API is required.

## Develop

Requires Node 22.12+ or Node 24 and the pinned pnpm 11.7.0 (declared in package.json).

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check
pnpm build
```

The local preview uses port 4327. Production is static output in dist/, published through Sites using .openai/hosting.json. Dist and node_modules are not committed.

## Content

- content/artists/<slug>.md: artist biography, links, editorial context.
- content/films/<slug>.md: film details, artist reference, availability, watch links, source and image credits.
- content/updates/YYYY-MM-DD-<slug>.md: a dated note referencing films and artists.
- src/content.config.ts: frontmatter schema. Required fields and reference checks run during build.
- public/media/: credited promotional stills and thumbnails used to identify films.

Copy a relevant existing file to add an entry. Slugs are stable filenames. Record discoveredAt and lastVerifiedAt using YYYY-MM-DD strings. Runtime is approximate; series runtime is per episode. Avoid unnecessary edits to verification dates.

## Periodic refresh

A Codex scheduled follow-up reads AI Film Director Watch, verifies new discoveries against original sources, updates these Markdown files, validates the build, and publishes meaningful changes to the existing Site. See docs/content-refresh.md. It needs the local machine and Codex environment available; this is not a server-side scheduler.

## Package safety

pnpm-workspace.yaml enforces a seven-day release age, strict release metadata checks, no missing timestamps, and restrictions on exotic transitive dependencies. All direct dependencies and the package manager are pinned. The lockfile is committed. Dependency scripts are denied unless explicitly allowed; esbuild is the sole allowed build script.

Routine content refreshes must not upgrade packages. Dependency updates are separate maintenance changes: inspect the lockfile diff, retain the release-age gate, run pnpm audit, check and build, and commit only after verification. The waiting period reduces exposure to newly published attacks; it is not a guarantee of safety.

## Design and credits

Palette and typography adapted from the user's Renku website. Fraunces is provided by @fontsource-variable/fraunces. IBM Plex Sans is self-hosted from the existing website; its license is retained with the font files. Every film page links to its image source and factual sources.

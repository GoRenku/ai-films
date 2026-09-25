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

- content/artists/<slug>.md: artist biography, verified X profile and provenance, links, editorial context.
- content/films/<slug>.md: film details, artist reference, availability, watch links, source and image credits, and sourced production disclosures.
- content/updates/YYYY-MM-DD-<slug>.md: a dated note referencing films and artists.
- src/content.config.ts: frontmatter schema. Required fields and reference checks run during build.
- public/media/: credited promotional stills and thumbnails used to identify films.

Copy a relevant existing file to add an entry. Slugs are stable filenames. Record discoveredAt and lastVerifiedAt using YYYY-MM-DD strings. Runtime is approximate; series runtime is per episode. Avoid unnecessary edits to verification dates.

## Periodic refresh

Two daily Codex follow-ups work in sequence: an 11:00 Europe/Madrid X discovery review supplies a private queue; the 12:00 editorial refresh reads it alongside AI Film Director Watch, monitors verified artist accounts, verifies discoveries against original sources, updates Markdown and publishes meaningful changes. See docs/content-refresh.md. It needs the local machine and Codex environment available; this is not a server-side scheduler.

## Package safety

pnpm-workspace.yaml enforces a seven-day release age, strict release metadata checks, no missing timestamps, and restrictions on exotic transitive dependencies. All direct dependencies and the package manager are pinned. The lockfile is committed. Dependency scripts are denied unless explicitly allowed; esbuild is the sole allowed build script.

Routine content refreshes must not upgrade packages. Dependency updates are separate maintenance changes: inspect the lockfile diff, retain the release-age gate, run pnpm audit, check and build, and commit only after verification. The waiting period reduces exposure to newly published attacks; it is not a guarantee of safety.

## Design and credits

Palette and typography adapted from the existing studio website. Fraunces is provided by @fontsource-variable/fraunces. IBM Plex Sans is self-hosted from the existing website; its license is retained with the font files. Every film page links to its image source and factual sources.

## Source and publication workflow

This checkout at `/Users/keremk/Projects/aitinkerbox/ai-films` is the source of truth. Every accepted content refresh must be written here, validated, committed and pushed to GitHub (`origin`, GoRenku/ai-films) before the same commit is pushed to `sites` and published. A private research queue is only an intake mechanism, never a substitute for repository content. If hosting fails, retain the validated changes in this repository and GitHub and report publication as pending.

### September 18, 2026 content refresh

- [Charlie Driscoll](content/artists/charlie-driscoll.md) and [Tales of Grimwicke — Chapter I](content/films/tales-of-grimwicke.md): release artwork, watch link and disclosed production process.
- [Grimble & Wobbles](content/films/grimble-and-wobbles.md): Joss Monzoni’s short comedy, original imagery and sourced workflow.
- [Journal note](content/updates/2026-09-18-animal-worlds.md): links the two additions.

### September 19, 2026 content refresh

- [Backrooms Nemoris](content/films/backrooms-nemoris.md) and [Javi Lopez](content/artists/javi-lopez.md): official pilot, artwork, verified X profile and sourced sound/editing/model disclosures.
- [Odysseus: The Fall](content/films/odysseus-the-fall.md): new creator-reported cost and likeness count, with earlier credits and funding context preserved.
- [Journal note](content/updates/2026-09-19-sound-and-production.md): highlights the additions.

### September 20, 2026 content refresh

- [A Face Only a Mother Could Love](content/films/a-face-only-a-mother-could-love.md): added its verified BIAIFF official selection and September 17 cinema programme credit, distinguishing the screening from an award.
- Updated the research watchlist with public festival leads and the unresolved authorship of The Poison Taster.

- [Gabriel Olson](content/artists/gabriel-olson.md): new director profile and [journal note](content/updates/2026-09-20-gabriel-olson.md), with DuckTales concept-trailer links, Jason Pachomski’s editing credit and verified X monitoring. No completed-film entry or feature announcement inferred.

### What’s New and three additional releases

- Added The Poison Taster / Absurd, Life Lines / Christopher Fryant and NiE / Nishiyama Seigo with official imagery and full viewing links.
- Homepage What’s New and /whats-new/ automatically show dated new films, artists and editorial updates; routine verification does not count as new.
- Missing secondary production details no longer block otherwise verified, curated releases.

### September 21, 2026 content refresh

- [Er Loop](content/films/er-loop.md) and [Marco Magario](content/artists/marco-magario.md): full release, official artwork, verified X and creator-linked reference/voice/music workflow.
- [Sinuca de Bico (Cornered)](content/films/sinuca-de-bico-cornered.md) and [Odair Faléco & Davi Moori](content/artists/odair-faleco-and-davi-moori.md): full film, credited artwork, named creative roles and official BIAIFF/Cinema Shift results.
- Both additions appear automatically in What’s New. Missing models and budget details remain research questions, not publication blockers.

### September 22, 2026 content refresh

- [Backrooms Nemoris](content/films/backrooms-nemoris.md): creator-sourced narrative planning and intended clue/payoff structure, distinguished from completed episodes.
- [Verena Puhm](content/artists/verena-puhm.md): original portfolio, studio background and credited Nobody Dies on Mars trailer; official XPRIZE finalist status, not an award or full-film release.
- [Journal note](content/updates/2026-09-22-story-plans-and-a-finalist.md) makes the substantive update visible in What’s New.

### September 23, 2026 content refresh

- [An Artist](content/films/an-artist.md): full animated short, inspected official artwork, verified playback, BIAIFF third-place award and scoped Runway/Dreamina disclosures.
- [Abel Art](content/artists/abel-art.md): portfolio context and verified X profile added to daily monitoring. Both additions appear automatically in What’s New.

### September 24, 2026 content refresh

- Added [GOOD BOY](content/films/good-boy.md) and [Dair Karakeev](content/artists/dair-karakeev.md), with official artwork, multi-tool credits and earlier filmmaking context.
- Added [The First Anunnaki](content/films/the-first-anunnaki.md) and [Lucas M. Kern](content/artists/lucas-m-kern.md), with episode-specific runtime and creative credits.
- Added [Beyond the World: Book of Life](content/films/beyond-the-world-book-of-life.md) and [OVIS AI](content/artists/ovis-ai.md), distinguishing creator-reported costs and schedule from verified release facts.
- All three have original full-release links and appear in What’s New. Playback verification remains incomplete; status is Released rather than Watch now.

### September 25, 2026 content refresh

- Added [The Sorrowful Figure](content/films/the-sorrowful-figure.md) with verified full playback, official artwork and named production credits. Added [Contanimation’s directors](content/artists/contanimation.md) and verified studio X account.
- Added [Philipp Lenssen](content/artists/philipp-lenssen.md), his body of work, verified X profile and current Autonomous release links. The project’s part-by-part/in-progress status is explicit.

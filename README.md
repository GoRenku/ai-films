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

Two daily Codex follow-ups work in sequence: an 11:00 Europe/Madrid X discovery review supplies a private queue; the 13:00 editorial refresh reads it alongside AI Film Director Watch, monitors verified artist accounts, verifies discoveries against original sources, updates Markdown and publishes meaningful changes. See docs/content-refresh.md. It needs the local machine and Codex environment available; this is not a server-side scheduler.

## Package safety

pnpm-workspace.yaml enforces a seven-day release age, strict release metadata checks, no missing timestamps, and restrictions on exotic transitive dependencies. All direct dependencies and the package manager are pinned. The lockfile is committed. Dependency scripts are denied unless explicitly allowed; esbuild is the sole allowed build script.

Routine content refreshes must not upgrade packages. Dependency updates are separate maintenance changes: inspect the lockfile diff, retain the release-age gate, run pnpm audit, check and build, and commit only after verification. The waiting period reduces exposure to newly published attacks; it is not a guarantee of safety.

## Design and credits

Palette and typography adapted from the existing studio website. Fraunces is provided by @fontsource-variable/fraunces. IBM Plex Sans is self-hosted from the existing website; its license is retained with the font files. Every film page links to its image source and factual sources.

Every page is derived from the content collections; no section is hand-curated. src/lib/catalog.ts holds the shared rules:

- The homepage hero shows the five newest films with artwork (a `featured` film keeps a slot); rails for Just added, Watch now, Coming soon & festivals, Features, Series and Artists to follow sort by `discoveredAt` and skip films already shown above them. Daily additions therefore move the whole page.
- “New” badges cover the last three days of additions; the weekly tally covers seven, both measured from the newest content date rather than the build date.
- Free-text `genre` stays editorial. Ten broad genre groups are derived from it by keyword for browsing and filters; extend the patterns rather than adding a frontmatter field.
- YouTube and Vimeo watch links for Watch now films play in an embedded player (youtube-nocookie / Vimeo `dnt`) that loads only when pressed. Other links open at the source.
- Films and Artists filtering, sorting and search run client-side over the static HTML; filter state lives in the URL query.

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

### September 26, 2026 content refresh

- [Passport Rush](content/films/passport-rush.md) and [Higgsfield Studio](content/artists/higgsfield-studio.md): original full-release link, inspected official artwork, verified playback, and sourced animation, design, finishing and practical production disclosures. Named individuals, budget and exact video models remain explicit unknowns.
- Documentation now matches the authorized 13:00 Europe/Madrid refresh schedule.

### September 27, 2026 content refresh

- [Passport Rush](content/films/passport-rush.md): verified studio disclosure adds Seedance 2.5, Claude Opus 5.5 and Photoshop with their distinct roles, replacing previously unresolved model details.
- [Dated journal note](content/updates/2026-09-27-passport-rush-models.md) surfaces the substantive update in What’s New.

### September 28, 2026 content refresh

- Updated [Verena Puhm](content/artists/verena-puhm.md) with verified Future Vision XPRIZE second place.
- [Results journal note](content/updates/2026-09-28-future-vision-results.md) distinguishes awards and future production support from completed-feature releases.

### September 29, 2026 content refresh

- [Life Lines](content/films/life-lines.md): added Cate Bligh’s credited editing/finishing contribution and sourced model, sound, planning and continuity disclosures from the maker’s September 28 article.
- [Gods Don’t Give Gifts](content/films/gods-dont-give-gifts.md): linked the first official teaser without changing forthcoming status.
- [Journal note](content/updates/2026-09-29-life-lines-making-of-and-gossip-goblin-teaser.md): surfaces both updates in What’s New.

### September 30, 2026 content refresh

- [Morgue Cat production note](content/updates/2026-09-30-morgue-cat-production.md): sourced continuity and collaboration disclosures; forthcoming status preserved.
- [Absurd](content/artists/absurd.md): linked the new production account.

### October 1, 2026 content refresh

- [Gods Don’t Give Gifts](content/films/gods-dont-give-gifts.md) and Zack London: replaced current October 30 claims with the studio’s September 30 winter window; retained the older announcement with a correction.
- [Timing note](content/updates/2026-10-01-gossip-goblin-winter-window.md) surfaces the change in What’s New.

### October 1 — weekly director-watch findings incorporated

- Added Zahid Iqbal and The Mother’s Monster, with original full-film link, artwork and scoped studio cost/schedule disclosures.
- Added Vikki Bardot and A Woman Asleep, with credited artwork, reported production roles and attributed exhibition plans.
- Added Yue Ming and Sanxingdui: Future Past, with release artwork, reported creative credits and October 23 announcement.
- New journal note surfaces all three in What’s New. Contanimation’s weekly mention reconciles to existing entries.

### October 2, 2026 content refresh

- SPARE / 汗青 HQ: original full release, verified playback, credited artwork and Kling 4.0/Omni Reference disclosure with beta-access context.
- Morgue Cat — Episode 1 / Absurd: released first episode, official image and scoped collaboration/continuity facts; earlier forthcoming note reconciled.
- Dated journal note adds Alex Patrascu’s documentary performance and continuity disclosures as craft coverage, with attribution and factual-review limits.

### October 3, 2026 content refresh

- [Crownless & Bound](content/films/crownless-and-bound.md) and [Taylor Matter](content/artists/taylor-matter.md): official artwork, festival evidence, named poster credits and disclosed set-construction workflow.
- [Cracked Chimes](content/films/cracked-chimes.md) and [Anthony Jegu](content/artists/anthony-jegu.md): original production credits, official project X, artwork and trailer, with festival-summary discrepancies resolved in favor of production sources.
- [Maki Death Games — Nexus Episode 5](content/films/maki-death-games.md): playable original release, image, model disclosures and public 3D planning techniques.
- [What's New note](content/updates/2026-10-03-built-spaces-and-collaboration.md): three additions and attributed Paul Schrader announcement coverage, without treating planned work as released.

### October 4, 2026 content refresh

- [BOSS](content/films/boss.md) and [Jenny Krakovsky](content/artists/jenny-krakovsky.md): creator-made poster, verified X, original biography and production diary; completion is distinguished from forthcoming audience access, and no first-ever claims are adopted.
- [HAYDON](content/films/haydon.md): official BAIFF October 13 afternoon screening listing in Venice, with the programme-update notice retained.
- [Journal note](content/updates/2026-10-04-features-and-festival-screening.md): highlights the feature and exhibition updates. Packages and lockfile unchanged.

### October 5, 2026 — memory, performance and final credits

- [Candela](content/films/candela.md) and [Magnific Studios](content/artists/magnific-studios.md): full-film access, inspected official artwork, verified X profile and original shot/music breakdowns.
- [BOSS](content/films/boss.md): final poster, named associate producers and original-score credit; access status remains qualified.
- [Journal note](content/updates/2026-10-05-memory-and-film-credits.md) highlights these changes in What’s New. Packages and lockfile unchanged.

### October 6, 2026 — serial mysteries and a release date

- [Daniił Vołkaŭ](content/artists/daniil-volkau.md), [HOLED](content/films/holed.md) and [The Wrong Planet](content/films/the-wrong-planet.md): verified creator identity, original artwork, public episode access and qualified feature-release evidence; production claims remain work-specific.
- [Henry Daubrez](content/artists/henry-daubrez.md): JUNKYARD KING Chapter 3’s October 7 noon ET announcement and scoped team disclosure.
- [What’s New note](content/updates/2026-10-06-serial-mysteries-and-a-release-date.md) links the additions and announcement. Packages and lockfile unchanged.

### October 7, 2026 — staging, ensembles and editing

- [Billy Woodward](content/artists/billy-woodward.md) and [Afahria — The Wicked Worm](content/films/afahria-the-wicked-worm.md): complete first episode, inspected artwork, verified X, Showrunner / Fable partnership and preparation/blocking disclosures.
- [Bunny Patrol](content/films/bunny-patrol.md): original four-story release by Daniił Vołkaŭ, full playback and artwork; optional production unknowns explicit.
- [The Chronicles of Bone](content/films/chronicles-of-bone.md): Chapter Six full release and platform disclosure, separated from older models.
- [Gods Don’t Give Gifts](content/films/gods-dont-give-gifts.md): official trailer’s December 4 date and scoped team/duration disclosure; venues unverified.
- [What’s New note](content/updates/2026-10-07-staging-ensembles-and-editing.md): additions and Alex Patrascu’s Bruce McLaren documentary craft account, distinguishing archive, illustration, synthetic narration and human corrections. Packages and lockfile unchanged.

### October 8, 2026 — new worlds and festival winners

- Added [JUNKYARD KING — The Other Side](content/films/junkyard-king-the-other-side.md): complete Chapter 3 playback, original artwork, series authorship and scoped collaboration/support disclosures; Henry Daubrez’s announcement reconciled.
- Added [Asiri Ilu Awon Osu](content/films/asiri-ilu-awon-osu.md) and Mysterious Tech Studio / Tanwa Hameed: two official rental listings, inspected artwork, director/producer/cast credits, attributed hybrid-production account and qualified paid availability.
- Added The First Honest Day / Nikolay Shestak, SITARA / Abhik Banerjee and Looking For Perseida / Ernest Desumbila: official AAIFF results, original creator evidence, artwork, editorial context and scoped production disclosures; no complete-stream claims.
- Updated Pomegranate’s Best Concept recognition and Gods Don’t Give Gifts’ reported runtime / awards-plan context.
- [What’s New note](content/updates/2026-10-08-new-worlds-and-festival-winners.md) surfaces the additions and substantive updates. Packages, lockfile and release-age policy unchanged.

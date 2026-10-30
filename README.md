# Latent Matinee

A small, static Astro site for discovering AI films and filmmakers. Content lives in Markdown; Git records all edits. No database, CMS, or runtime API is required.

## Develop

Requires Node 22.23.4 or newer in the 22.x line, or 24.22.1 or newer in the 24.x line, and the pinned pnpm 11.7.0 (declared in package.json).

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check
pnpm build
```

The local preview uses port 4327. Production is static output in dist/, published to https://latentmatinee.com on Cloudflare Pages (project `latent-matinee`, configured in wrangler.jsonc). Dist and node_modules are not committed.

## Deploy

```sh
pnpm deploy:cloudflare
```

This runs `pnpm check` and `pnpm build` (including the generated-page link and asset check), then uploads dist/ with the pinned wrangler. It reads `CLOUDFLARE_TOKEN` (a token with Cloudflare Pages: Edit) and `CLOUDFLARE_ACCOUNT_ID` from the git-ignored `.env`. Deploy only committed work that has already been pushed to GitHub. public/_headers sets security headers and caching.

Cloudflare setup (already in place; do not recreate): `latent-matinee` is a classic Pages project with custom domains latentmatinee.com and www.latentmatinee.com (proxied CNAMEs to latent-matinee.pages.dev). A zone Single Redirect rule sends www to the apex with a 301, excluding `/.well-known/` so certificate validation keeps working. Recent wrangler versions try to move new Pages projects to Workers; deploying to this existing project is unaffected.

## Content

- content/artists/<slug>.md: artist biography, verified X profile and provenance, links, editorial context.
- content/films/<slug>.md: film details, artist reference, availability, watch links, source and image credits, and sourced production disclosures.
- content/updates/YYYY-MM-DD-<slug>.md: a dated note referencing films and artists.
- src/content.config.ts: frontmatter schema. Required fields and reference checks run during build.
- public/media/: credited promotional stills and thumbnails used to identify films.

Copy a relevant existing file to add an entry. Slugs are stable filenames. Record discoveredAt and lastVerifiedAt using YYYY-MM-DD strings. Format is Short film, Feature, Series or Music video; music videos use the genre Music video, credit the song artist in `musician` and get their own home-page rail and films filter. Runtime is approximate. A series has no runtime of its own: it lists its `episodes` in release order (see docs/content-refresh.md), and each episode carries its own runtime, status and watch link. Avoid unnecessary edits to verification dates.

## Periodic refresh

Two daily Codex follow-ups work in sequence: an 11:00 Europe/Madrid X discovery review supplies a private queue; the 13:00 editorial refresh reads it alongside AI Film Director Watch, monitors verified artist accounts, verifies discoveries against original sources, updates Markdown and publishes meaningful changes. See docs/content-refresh.md. It needs the local machine and Codex environment available; this is not a server-side scheduler.

Scheduled editorial refreshes are content-only: Markdown entries, credited media, refresh summaries and editorial research notes. They must not change CSS, templates, layouts, application code, deployment configuration or dependencies. Layout issues require a separate explicitly requested task. Publication uses the existing `pnpm deploy:cloudflare` command; the former Sites target is retired.

## Package safety

pnpm-workspace.yaml enforces a seven-day release age, strict release metadata checks, no missing timestamps, and restrictions on exotic transitive dependencies. All direct dependencies and the package manager are pinned. The lockfile is committed. Dependency scripts are denied unless explicitly allowed; esbuild is the sole allowed build script.

Routine content refreshes must not upgrade packages. Dependency updates are separate maintenance changes: inspect the lockfile diff, retain the release-age gate, run pnpm audit, check and build, and commit only after verification. The waiting period reduces exposure to newly published attacks; it is not a guarantee of safety.

## Design and credits

Palette and typography adapted from the existing studio website. Fraunces is provided by @fontsource-variable/fraunces. IBM Plex Sans is self-hosted from the existing website; its license is retained with the font files. Every film page links to its image source and factual sources.

Every page is derived from the content collections; no section is hand-curated. src/lib/catalog.ts holds the shared rules:

- The homepage hero shows the five newest films whose artwork is at least 1200px wide (read from the image header at build time), so full-bleed slides stay sharp; a `featured` film keeps a slot. Lower-resolution artwork such as 480px video thumbnails still leads the Just added rail. Posters (`imageFit: contain`) are cropped full-bleed like stills in the hero only; cards and film pages still show the whole poster. Sourcing larger official artwork gets a film into the hero; rails for Just added, Watch now, Coming soon & festivals, Features, Series and Artists to follow sort by `discoveredAt` and skip films already shown above them. Daily additions therefore move the whole page.
- “New” badges cover the last three days of additions; the weekly tally covers seven, both measured from the newest content date rather than the build date.
- Free-text `genre` stays editorial. Ten broad genre groups are derived from it by keyword for browsing and filters; extend the patterns rather than adding a frontmatter field.
- YouTube and Vimeo watch links for Watch now films play in an embedded player (youtube-nocookie / Vimeo `dnt`) that loads only when pressed. Other links open at the source.
- Films and Artists filtering, sorting and search run client-side over the static HTML; filter state lives in the URL query.
- The hero is a full-bleed, fixed-height carousel with text anchored bottom-left. Fix layout problems inside that structure (for example the poster size caps in global.css) rather than converting slides to boxed or column layouts.
- “Films” means shorts, features and series; music videos are counted separately (`workTally`). Every count on the site uses that rule; the mixed Films list says “titles”.
- Film and artist pages use their existing credited artwork, unchanged, as the share picture (`og:image`); an artist uses the same cover their page shows. Nothing is cropped, resized or generated.
- `/journal/rss.xml` and `/sitemap.xml` are generated from the content at build time, and `public/robots.txt` names the sitemap. `scripts/validate-build.mjs` fails the build if the sitemap misses a page, robots.txt loses its Sitemap line, a feed item has no page, or a share picture is missing.
- Outbound links to gorenku.com, with their link tags, live in `src/lib/external-links.ts`. The footer line and the About section are the only places that mention Renku.

## Analytics and privacy

The site asks visitors before storing an analytics identifier. PostHog (EU) loads only after a Yes or No answer: Yes visitors send page views and page-leave times; No visitors are counted by page views and page-leave times only, with nothing stored in the browser except the choice. The footer's Analytics choice reopens the banner, and /privacy/ is the visitor-facing notice. The event list, consent states, UTM convention and PostHog configuration are documented in [Web analytics and attribution](https://github.com/GoRenku/studio/blob/main/docs/operations/web-analytics-and-attribution.md).

## Source and publication workflow

This checkout at `/Users/keremk/Projects/aitinkerbox/ai-films` is the source of truth. Every accepted content refresh must be written here, validated, committed and pushed to GitHub (`origin`, GoRenku/ai-films) before that same commit is deployed to Cloudflare Pages with `pnpm deploy:cloudflare`. A private research queue is only an intake mechanism, never a substitute for repository content. If hosting fails, retain the validated changes in this repository and GitHub and report publication as pending.

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
- Added The First Honest Day / Nikolay Shestak, SITARA / Abhik Banerjee and Looking For Perseida / Ernest Desumbila: official AAIFF results, original creator evidence, artwork, editorial context and scoped production disclosures; no complete-stream claims.
- Updated Pomegranate’s Best Concept recognition and Gods Don’t Give Gifts’ reported runtime / awards-plan context.
- [What’s New note](content/updates/2026-10-08-new-worlds-and-festival-winners.md) surfaces the additions and substantive updates. Packages, lockfile and release-age policy unchanged.
- Editorial removal: Asiri Ilu Awon Osu and its Mysterious Tech Studio / Tanwa Hameed profile were withdrawn at the editor’s direction the same day and recorded as an exclusion in docs/research-watchlist.md.

### October 8, 2026 hero layout correction

- Fixed a shared poster rule that overrode the homepage hero positioning. Poster artwork now fills the hero full-bleed like a still, with a darker scrim behind the title.
- Long titles use a smaller display size. The hero keeps its full-bleed, fixed-height cinematic layout rather than a two-column grid.

### October 9, 2026 — continuing worlds

- Added [Wendy’s Wonderful Dreamworld](content/films/wendys-wonderful-dreamworld.md) and [Christopher Gwinn / Grindhouse Glitch](content/artists/christopher-gwinn.md): three-episode context, verified full Episode 3 playback, inspected official artwork, verified X identity and episode-specific tool disclosures.
- Updated [Morgue Cat](content/films/morgue-cat.md) and Absurd’s profile with the October 8 Episode 2 release; earlier production evidence stays scoped to the project.
- [What’s New note](content/updates/2026-10-09-dreamworld-and-morgue-cat.md) surfaces the additions and release update. Application files, layout and dependencies unchanged.
- Also added [Apocalypses, Connections and Delays](content/films/apocalypses-connections-and-delays.md) and [Foka’s Planet](content/films/fokas-planet.md), with original full releases, inspected artwork and work-specific production unknowns; expanded Daniił Vołkaŭ’s profile.
- Clarified @juliewdesign_’s second-visual-artist role on JUNKYARD KING Chapter 3 against the maker’s direct episode-thread credit.

### October 10, 2026 — choices and compositions

- Added [KARMA](content/films/karma.md), Joss Monzoni’s October 10 horror short, with verified full playback and original artwork.
- Added [What is Real?](content/films/what-is-real.md) and [Kennex Ma](content/artists/kennex-ma.md): official festival release, category-specific Grand Prix and direct interview production disclosures. An older release newly discovered, not a new premiere.
- Updated Henry Daubrez with his exact Seedance 2.5 poster-composition technique and Jenny Krakovsky with the complete new Slop and Glory interview.
- [Dated note](content/updates/2026-10-10-choices-and-compositions.md) surfaces the additions. No layout, application, deployment or dependency changes.

### October 11, 2026 — planning shots and carrying proof

- Added [Witchcraft](content/films/witchcraft.md) and [Crop Confidential](content/films/crop-confidential.md), with full original releases (3:18 / 5:33), inspected artwork and September dates distinguished from October X excerpts.
- Updated Henry Daubrez’s artist profile with his direct Claude Code / Opus / Three.js previs disclosure; no assumed episode credit or savings.
- Expanded Backrooms Nemoris and Javi Lopez with direct interview evidence on manual prompts, continuous handheld sequences and layered sound editing.
- [Dated note](content/updates/2026-10-11-planning-shots-and-carrying-proof.md) also covers the official Higgsfield shortlist and voting deadline. No layout, application, deployment or dependency changes.

### October 12, 2026 — mecha, money and musical choices

- Added [Iron Orchids](content/films/iron-orchids.md): creator-linked 74:30 feature, original artwork, September release date and scoped Seedance / Dreamina disclosures.
- Added [An Honest Day’s Work](content/films/an-honest-days-work.md): Gossip Goblin’s October 11 complete short, sampled narrative/captions, credited timestamped release frame and explicit production unknowns.
- Added [Javier Fan / javiexmachina](content/artists/javiexmachina.md): authored music-video practice, original complete release and public Suno / Claude / Midjourney process, distinguishing development edits and conflicting counts from final production facts.
- Updated Cracked Chimes with Anthony Jegu’s exact official September monthly-competition award; expanded the Vołkaŭ and London profiles.
- [Dated note](content/updates/2026-10-12-mecha-money-and-musical-choices.md) surfaces the additions. No layout, application, deployment or dependency changes.

### October 13, 2026 — music videos as a format

- Added `Music video` as a fourth film format with an optional `musician` credit, a home-page Music videos rail, a films-page filter, a separate home stat and "New music video" labels in Latest. Music-video selection criteria are in docs/content-refresh.md.
- Added [I’M YOUR SLOP](content/films/im-your-slop.md) by javiexmachina as the first entry, after rechecking the original release, creator credits and release artwork; linked it from the artist profile.
- Application change (schema, catalogue helpers, home, films and Latest pages); no dependency or deployment changes.

### October 13, 2026 — songs, characters and directed worlds

- Added nine music videos: Chromatique, C’est de l’IA, Airplane Mode, Escape Velocity, Clodyssey, Bliss, P DOOM, The Seventh Reset and Stellorado. Original full releases, credited artwork, musician/project identities and work-specific disclosures are recorded; no human performer or undisclosed director is invented.
- Added six creator/project profiles: Extraltodeus, anabology / Claudia, Astra Blue AI, VØXELLE, schmede and Skye Freeman / Skyebrows, with verified original X links.
- Added the complete credited Malfoid — I Wasn’t Joking adaptation; updated Cornered’s exact Torino award and Henry Daubrez’s separate game announcement.
- The dated journal connects production lessons and distinguishes film releases from excerpts, interviews and live-stage production. Application, CSS, deployment configuration, packages and lockfile unchanged.

### October 14, 2026 — stakes, staging and synthetic singers

- Added The Offsite, Malfoid — Expecto Patronum and Mother Was A Fighter; a 29:14 Gavin Purcell / Fig documentary; Exile Protocol Episode 8 and Beurre Noir — Rum Baba; and three music videos: Sur mesure, Le ciel sous la peau and WAIST CØNTRØL.
- Added Eliott Mogenet, Aiden Guo, Gavin Purcell and S.A.V profiles with verified X links. Preserved creator-specific explanations, exact original production disclosures, unknown credits and upload-versus-discovery dates.
- Added nine inspected real release images/frames and a dated journal note. Expanded existing artist records, including anabology’s teaser/interface announcement without treating it as a full song release.
- Content-only refresh: no design, schema, package, lockfile or deployment-configuration changes.
- Updated schmede’s reported subtitle availability and the separately scoped moonlightbro adaptation credit.

### October 14, 2026 — homepage selection correction

Removed The Patchwright’s featured flag so it no longer replaces the fifth newest eligible artwork in the homepage carousel. The film remains in the collection. No CSS, template, layout or dependency changes.


### October 15, 2026 — worlds, performances and reference work

- Added eight catalogue entries: The Arc, INFERNO — The Series, Volta — Villain Era, Luccia, Houdini: Back from the Dead, Space Nation, Kira and Vanish Thread, each with inspected real official artwork or a credited release frame.
- Added six creator/studio profiles: Darin Stewart, Niccolò Savinelli / Realista, Lita Bosch & Pablo Maestres, Red Rock Films, Martin Weisz, and Damien Steck & Julien Petit. Expanded Extraltodeus, Absurd, Contanimation and anabology; updated the older Kira / Space Nation journal references.
- Preserved detailed production disclosures and unknowns: generation credits versus full budgets, human performance under Houdini’s generated appearances, composed INFERNO sound, music-video tool roles, and pilot delivery versus public episodes. New dated journal includes Finn McKenty’s reference-preparation practice without inventing a film credit or measured savings.
- Content-only refresh. No CSS, templates, application code, dependency, lockfile, deployment or audience changes. Patchwright remains unpinned.

### October 16, 2026 content refresh

- Three music videos: [Between Me and You](content/films/between-me-and-you.md), [in Humilitate](content/films/in-humilitate.md) and [KILL SWITCH](content/films/kill-switch.md), with original artwork, song/project credits and work-specific production disclosures.
- Series discoveries: [The Sage](content/films/the-sage.md), including its official seven-episode catalogue and complete Episode 7, and [Bone China](content/films/bone-china.md), with upload/share dates distinguished. [Morgue Cat](content/films/morgue-cat.md) adds Episode 3.
- Complete shorts: [Pursue Your Passions](content/films/pursue-your-passions.md), [MIND THE GAP](content/films/mind-the-gap.md) and [Malfoid — Draconia Malfoy](content/films/malfoid-draconia-malfoy.md), the combined anime cut with separate writer credit and ten caption variants.
- Three new profiles: [Kelly Boesch](content/artists/kelly-boesch.md), [Nightway Fantasy](content/artists/nightway-fantasy.md) and [Mike J Mitch](content/artists/mike-j-mitch.md). Existing Astra Blue, Vołkaŭ, Zack London and schmede profiles extended. [Dated journal](content/updates/2026-10-16-personas-rescues-and-inner-worlds.md) connects the additions. Content and credited media only; no design, application, dependency, configuration or audience changes.

### October 17, 2026 content refresh

- Four music videos: [Cutting Room Floor](content/films/cutting-room-floor.md), [NOW SERVING](content/films/now-serving.md), [Come a Little Closer](content/films/come-a-little-closer.md) and [Baby, You Flew](content/films/baby-you-flew.md). Original release links, musician/project identities, production support, human repair and tool roles are scoped to each work.
- [AMBIANCE](content/films/ambiance.md) and [Zorgon Explains Everything](content/films/zorgon-explains-everything.md) add complete narrative work; [HOLED](content/films/holed.md) adds verified Episode 4 playback and a direct Dreamina disclosure. September upload dates remain distinct from October shares.
- New profiles for [antic](content/artists/antic.md) and [Antonio Sabatella](content/artists/antonio-sabatella.md); existing creator profiles extended. [Candy](content/films/candy.md) adds the official Lumara finalist announcement, with the October 26 result still forthcoming.
- [Dated journal](content/updates/2026-10-17-selection-repair-and-the-finished-film.md) connects six new works and substantive existing-entry news. Five original thumbnails and one inspected, timestamped original frame. Content-only update; no layout, CSS, package, deployment or access changes.

### October 18, 2026 content refresh

- Three complete music videos: [Don’t Let Me Scroll](content/films/dont-let-me-scroll.md), [DOWNFORCE](content/films/downforce.md) and [Volta — Coming Home on Fire](content/films/coming-home-on-fire.md), with original playback, inspected real imagery, artist identities and work-specific production disclosures. Claudia’s separate audio-tool announcement is not retroactively assigned to film credits.
- Two narrative shorts: [Wrong House](content/films/wrong-house.md) and [Dominio](content/films/dominio.md). The latter adds [Jun Pabon](content/artists/jun-pabon.md), with September premiere and October discovery distinguished; missing optional crew/model details remain explicit.
- Expanded anabology, Extraltodeus, Vołkaŭ and schmede profiles; [dated journal](content/updates/2026-10-18-the-cut-and-the-world.md) covers the releases, human revision, audio-analysis claims, Freeman’s craft disclosure and soundtrack access. Four original thumbnails plus one credited finished-cut gallery frame.
- Content-only refresh. No CSS, layout, application, schema, dependency, lockfile, deployment-configuration or audience changes; no installations or upgrades.

### October 19, 2026 content refresh

- Added [Space Pirates — The Auction](content/films/space-pirates.md), anchored to the complete 5:39 Episode 6 with its scoped Pika plugin disclosure, and [La musique ne s’arrête pas](content/films/la-musique-ne-sarrete-pas.md), an October 8 full music video with exact maker-disclosed tools.
- Added [Pelagos](content/films/pelagos.md) and filmmaker [Zack Murray](content/artists/zack-murray.md) from the original Artlist release and linked creator portfolio. All three entries have inspected original release artwork.
- Updated C’est de l’IA with its English-subtitled version; documented Malfoid’s new continuation, continuity constraints, caption scope and soundtrack-download limit. Expanded three existing profiles and added a [dated journal](content/updates/2026-10-19-translations-and-continuing-worlds.md).
- Content-only refresh; no layout, CSS, application, schema, dependency, lockfile, deployment or audience changes. No installations or upgrades.

## October 20, 2026 refresh

Added five verified works: ClaudiaGI’s Demande à l’IA! and VØXELLE’s GOLDEN LIFE (S.I.) music videos; Gossip Goblin’s Escaping the Onion and 汗青 HQ’s StoryWeave shorts; and the older Lyrian Chronicles RIFT pilot with a profile preserving its six credited collaborators. Original complete releases, current playback, expanded descriptions, available captions and sampled scenes checked. Five real credited images inspected; Golden Life uses its released song cover and Demande uses a clean original frame near 3:40.

Expanded Cutting Room Floor’s planning/editing account from antic’s production essay; retained both scoped Pika and later Dreamina statements for Space Pirates without inventing their division of work; linked Malfoid’s complete Don’t Wait for Me Part 2 and WRATH soundtrack; distinguished The Sage’s forthcoming episode from the current complete release. Added a dated journal note. All 46 verified X profiles checked, including the two requested music-video discovery accounts. No CSS, layout, application, package, lockfile or deployment changes; no installs or Sites actions.

## October 21, 2026 refresh

Added Last Fly with Janky Mess’s directing/editing/sound profile and five named people filling multiple production roles, plus Magnific Studios’ Roots with verified complete 4:41 playback distinct from its 32-second preview. Updated The Sage to its complete 22:27 Episode 8, original October 20 upload, eight-episode studio catalogue and current artwork, retaining Episode 7’s scoped history. Added Malfoid’s complete Part 3, French-caption and pacing disclosures; anabology’s Euclid voice/animation workflow; and Gwinn’s October 24 premiere announcement as forthcoming. Dated journal and three inspected original release images added.

All 47 verified artist X profiles checked, including Extraltodeus and anabology. Original full descriptions, relevant maker replies, official studio catalogues, current players and sampled scenes checked; unknown optional production facts remain explicit. No complete critical-viewing claims. No accepted content left in a research-only state. Content/media/summary changes only; no source, CSS, layout, package, lockfile, deployment or audience changes, installations or upgrades.

## October 22, 2026 refresh

- Added five complete music videos: [PsychoPsypher](content/films/psychopsypher.md), [ANY DAY NOW — The Robots in 1959](content/films/any-day-now-1959.md), [Somewhere Along the Way](content/films/somewhere-along-the-way.md), [Universal High Income](content/films/universal-high-income.md) and [WAIT TILL YOU SEE IT](content/films/wait-till-you-see-it.md). Original release credits, real artwork, current playback and disclosure boundaries checked.
- Added [Blurred Horizon](content/films/blurred-horizon.md), its six original episodes and director-specific credits, and [The Toaster Rebellion](content/films/the-toaster-rebellion.md). New profiles: [Jeff Synthesized](content/artists/jeff-synthesized.md) and [Eddie Jacobson / Evil Eddie](content/artists/eddie-jacobson.md). Austin awards verified at the original festival.
- [Steelay](content/films/steelay.md) now has a confirmed October 21 theatrical opening. Afahria Episode 2, Malfoid Part 4, Nexus staging/cost disclosures and BOSS’s BBC production interview extend existing entries. Sky Beneath the Skin links from the existing Le ciel sous la peau entry, avoiding duplication.
- [Dated journal](content/updates/2026-10-22-worlds-built-to-a-song.md) connects the update. Refresh edits are content, credited media and summaries only; no CSS, rendering, package, lockfile, deployment or audience changes, installations or upgrades. The separately committed Node requirement change is retained as the base commit.

### October 23, 2026 content refresh

- Added [CHUMBO](content/films/chumbo.md) with full release, named credits, maker-reported scale and continuity/compositing techniques.
- Added [Luke Mazey / Slophouse](content/artists/luke-mazey.md), [The Reformation Room](content/films/the-reformation-room.md) and BIA’s [Solo Reign](content/films/solo-reign.md): original released series/music video, direction, artwork and scoped disclosures.
- Added [COLD OUT THERE](content/films/cold-out-there.md) from the original complete horror-short release.
- Updated [WHITEPILL — Universal High Income](content/films/universal-high-income.md) at its existing URL with the new full production record; final tools, discarded tests, human revisions and scoped costs are distinguished.
- Confirmed [Sanxingdui’s Chinese cinema opening](content/films/sanxingdui-future-past.md); added [Gods Don’t Give Gifts’ announced AGC partnership](content/films/gods-dont-give-gifts.md) and Kelly Boesch’s work-specific storytelling experiment.
- [Dated journal](content/updates/2026-10-23-drops-dancers-and-a-final-cut.md) connects the substantive changes. All accepted content is canonical; application, styles, packages and deployment setup are unchanged.

## October 24, 2026 content refresh

- Added five complete music videos: [Accélère!](content/films/accelere.md), [Nobody’s Watching](content/films/nobodys-watching.md), [AFTERIMAGE](content/films/afterimage.md), [Space Between Us](content/films/space-between-us.md) and [I Choose You](content/films/i-choose-you.md). New profiles establish [Teally / Teallyz](content/artists/teallyz.md) and [LadyWasabi / LouieVerse](content/artists/lady-wasabi.md). Original full descriptions, current playback, credits and six real release images checked; older upload dates remain explicit.
- Updated [RIFT](content/films/lyrian-chronicles-rift.md) to complete 36:48 Episode 2 while preserving the pilot; added Malfoid’s complete Part 5 and its writing/caption account. Alternate Chromatique, C’est de l’IA and La musique access links remain attached to existing entries.
- Added Nexus’s project-specific Theo Dudley credit and spatial-storyboard method, plus Vołkaŭ’s original published interview; Gwinn’s 18:00 CEST premiere remains forthcoming at the refresh. Exact versions, human vocal credits, full crews and costs stay unknown where undisclosed.
- [Dated journal](content/updates/2026-10-24-songs-and-returning-worlds.md) connects the substantive additions. All 49 existing verified X profiles, including Extraltodeus and anabology, loaded and recent posts reviewed; the two newly verified creator profiles were checked as well. Content/media/summary changes only: no CSS, layout, application, package, lockfile, deployment setup or audience changes, and no installations.

## October 25, 2026 content refresh

- Added Astra Blue AI's [What Am I To You](content/films/what-am-i-to-you.md), DotPockett's [Seal The World](content/films/seal-the-world.md) and the [DotPocket / DotPockett profile](content/artists/dotpockett.md). Full releases, creator identities, available captions, current playback and disclosure limits checked; a separate musician is not invented where uncredited.
- Added the older complete [WRATH: Adventus](content/films/wrath-adventus.md) narrative and its new Italian-caption version. Maker-reported finalist status remains distinct from a festival-confirmed result.
- Updated [Malfoid](content/films/malfoid-i-wasnt-joking.md) to its complete 9:50 combined cut, preserving scoped writing credits and individual-part history. Updated [Foka's Planet](content/films/fokas-planet.md) to complete 5:14 Episode 2, retaining Episode 1.
- Expanded Gwinn's artist page with Treasure of the Himalayas' actual opening teaser, Peter Hyoguchi's named roles, Midjourney images and Seedance 2.5 / Dreamina video. Future longer episodes and feature remain plans.
- Five original release images inspected; [dated journal](content/updates/2026-10-25-requests-resistance-and-returning-casts.md) connects the substantive changes. All 51 existing verified X profiles checked, explicitly including Extraltodeus and anabology; the newly verified DotPockett profile was also checked. Content/media/summary changes only, with no CSS, layout, application, package, lockfile, deployment setup or audience changes and no installations.

## October 26, 2026 content refresh

- Added ClaudiaGI’s [Make Love, Not Prompts!](content/films/faites-lamour-pas-des-prompts.md), with complete original release, Claude/H3 disclosures and carefully scoped electricity estimate, and Gossip Goblin’s [AI Psychosis](content/films/ai-psychosis.md), with original full X release and unknown production details explicit.
- Updated [Bone China](content/films/bone-china.md) to complete 9:28 Episode 2, retaining Episode 1 history; added Malfoid’s complete 2:39 Daphne Greengrass continuation without changing the combined cut’s main link.
- Confirmed [The Fall’s OPUS nomination](content/films/the-fall.md), distinguished from an award result, and added the maker-reported [I Choose You](content/films/i-choose-you.md) song-streaming announcement. Magnific’s artist notebook adds Patricia Camuñas’ work-specific Seedance 2.5 / ElevenLabs Music v2 production method with separate poster-reference scope.
- Three original release images inspected; [dated journal](content/updates/2026-10-26-companions-and-controlled-images.md) connects the updates. All 52 verified X profiles checked, including Extraltodeus and anabology. The advertised Recon Six full work could not be identified from its channel-only link and focused searches, so no invented film entry was added. Content, media and editorial summaries only; no layout, CSS, application, dependency, deployment or audience changes or installations.

## October 27, 2026 content refresh

- Added three complete music videos: [FREE MONDAY](content/films/free-monday.md), [One Foot Out](content/films/one-foot-out.md) and [Human Opinion…Irrelevant / Resistance Is Futile](content/films/resistance-is-futile.md). Original descriptions, complete playback, caption text and work-specific tools checked; scopes, costs and affiliate promotion remain distinct.
- Added [Ato de — Later](content/films/ato-de.md) and [The Tool](content/films/the-tool.md), with older upload dates and essay form explicit. Official Lumara news updates [Candy](content/films/candy.md) and the Slophouse profile.
- Added accurately scoped profiles for [HydeSynister](content/artists/hyde-synister.md), [Funny Story Musicals](content/artists/funny-story-musicals.md) and [Odair Faléco](content/artists/odair-faleco.md). Faléco’s individual work remains separate from his existing Moori collaboration.
- Updated [Space Pirates](content/films/space-pirates.md) to complete Episode 7 with new real artwork and retained Episode 6 history; Henry Daubrez’s Episode 4 production note records a continuity problem without claiming release.
- Six original artworks inspected; [dated journal](content/updates/2026-10-27-what-we-keep-and-what-we-postpone.md) connects the substantive update. All 52 existing verified X profiles checked, explicitly including Extraltodeus and anabology. Content/media/summary changes only; no layout, CSS, application, dependency, deployment or audience changes or installations.


## October 28, 2026 content refresh

- Added four complete authored music videos: [Volta — Omnia](content/films/omnia.md), [Who Gets Tomorrow](content/films/who-gets-tomorrow.md), [Imagine More](content/films/imagine-more.md) and [Without You](content/films/without-you.md). Original releases and work-specific model/lyric/cameo scopes checked; exact undisclosed roles remain unknown.
- Added [SMOKE](content/films/smoke.md), with its full named team, role-specific models and practical continuity record, and [Odyssey — The Oath](content/films/odyssey-the-oath.md), with complete Episode 1, measured runtime and attributed director/studio production account. Added [Dev Walker / GLUMLOT](content/artists/dev-walker.md).
- Added [Jacopo Zanetti / Jaiostudios](content/artists/jacopo-zanetti.md), [What’s the Job?](content/films/whats-the-job.md) and the older 2025 [The Twin Earth](content/films/the-twin-earth.md). AAIFF's original results verify Best Visual; the two films retain separate tool inventories and publication dates.
- Added Malfoid's complete 3:21 Better Taste continuation to its episode guide, preserving first-episode entry. Gwinn's Part Two remains announced; Woodward's new professional role is attributed to his own announcement. Seven existing artist profiles extended. [Dated journal](content/updates/2026-10-28-the-roles-we-choose.md) connects the substantive changes.
- All 53 unique existing verified artist X profiles checked, including Extraltodeus and anabology; newly credited Dev Walker and Jaiostudios profiles checked separately. Eight real release images inspected. Today's refresh changes content/media/editorial summaries only and preserves the separately committed series implementation; no application, CSS, layout, package, lockfile, deployment setup or audience edits or installations.


## October 29, 2026 content refresh

- Added Sho AI Studio’s [ATLAS](content/films/atlas.md), [ATLAS — NEXT](content/films/atlas-next.md) and [RAIDEN](content/films/raiden.md), with 16 verified full original parts and first-part starting links. Added A. Cole / Urban Novel Studios’ [The Way It Is](content/films/the-way-it-is.md), with nine complete originals and the creator/writer credit recovered from the opening descriptions.
- Added the older complete [The Sea Breeze Between Us](content/films/the-sea-breeze-between-us.md) romance and three authored music videos: [We Fight On!](content/films/we-fight-on.md), [Claudia × a16z](content/films/claudia-a16z.md), and [JeffTriesThings’ untitled music video](content/films/jeff-untitled-music-video.md). Added three accurately scoped creator/studio profiles. Eight original release images downloaded and inspected.
- Added Fryant’s brief Halloween episode to the existing anthology guide, English-captioned Tailored access to Sur mesure, an attributed frame-anchor process note and a dated exhibition-source note. [Dated journal](content/updates/2026-10-29-worlds-that-continue.md) connects the substantive changes.
- All 55 existing verified X profiles checked, including Extraltodeus and anabology; newly verified JeffTriesThings checked separately. Original full descriptions and players verified for all 25 newly catalogued series episodes. Lyric/visualizer releases excluded on form, not missing optional credits. Content/media/editorial changes only; no layout, CSS, application, package, lockfile, deployment setup or audience changes or installations.

### October 30, 2026 — dreams, candy and impossible studios

- Added the complete [Mirror9: The Hollowing](content/films/mirror9-the-hollowing.md), a [Higginswerx profile](content/artists/higginswerx.md), and named original creation/screenplay credits; kept the maker’s model and “around 3k” account attributed with unknown currency and scope.
- Added [The Feeling Farm](content/films/the-feeling-farm.md), [The Knitting](content/films/the-knitting.md) and [Boo Hag](content/films/boo-hag.md), with current original playback and inspected real artwork. Kept Knitting’s 57-second narrative distinct from its quoted vendor demo and Boo Hag’s June release distinct from the October reshare.
- Added VØXELLE’s [I REMEMBER TOMORROW](content/films/i-remember-tomorrow.md) and [LØSE YOUR MANNERS](content/films/lose-your-manners.md); distinguished the published video cuts from longer Suno songs and scoped V6 to music.
- Updated KARMA’s CapCut campaign disclosure, Cracked Chimes’ maker-reported CSFCCA selection and DOWNFORCE’s song-platform announcement, with the [dated journal](content/updates/2026-10-30-dreams-candy-and-impossible-studios.md). No design or application files changed.

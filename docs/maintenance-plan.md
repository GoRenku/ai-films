# Latent Matinee maintenance plan

Schedule reviewed November 20, 2026, when the scheduled refreshes moved from Codex to two local Claude scheduled tasks. Times use Europe/Madrid. The saved Claude schedules are the authority for run times and activation; the [scheduled refresh runbook](refresh-runbook.md) is the operating procedure.

## Schedule and ownership

| Time | Task | Responsibility |
| --- | --- | --- |
| Daily, 11:00 | Daily refresh | X API intake (bounded bookmark head read and public creator search), YouTube channel sweep and watch-link audit, private queue and inboxes, light web discovery, catalogue additions, journal note, featured review and publication. |
| Monday and Thursday, 15:00 | Deep watch | Festivals and competitions, a wide discovery survey of new creators (replacing the retired ChatGPT AI Film Director Watch), YouTube playback upgrades, back-catalogue featured candidates, registry and watchlist upkeep, publication. |
| On submission | Direct leads | A public URL and brief evidence from the user, held in the private queue until a run gives it a disposition. |

The Codex automations `discover-ai-films-from-x`, `refresh-ai-film-journal` and `refresh-ai-film-festivals` are paused, with their configuration backed up beside each automation file. Folding X intake into the daily refresh removes the 11:00 → 13:00 handoff; a lock file and the clean-tree preflight keep the two tasks from publishing at once.

## Source coverage

| Source | Cadence | How to check |
| --- | --- | --- |
| Private queue, submitted links, preserved X evidence | Every daily run | `film-queue.py open`, inboxes and `x-discovery.mjs evidence`. Deduplicate URLs and aliases and verify the original sources. |
| YouTube creator, publisher and platform channels | Every daily run | `scripts/youtube.mjs sweep` over [the channel registry](../scripts/youtube-channels.json) (155 channels on November 20, about 200 units). `audit` re-checks every catalogue YouTube watch link (about 7 units). |
| Public X creator posts and making-of replies | Every daily run | Official API only, least recently paged group first. X-only creators sit in small groups that usually page completely; creators already covered by the YouTube sweep sit in two larger groups. |
| Personal X bookmarks | Every daily run | Bounded head page and public verification, as in the [X discovery runbook](x-discovery.md). |
| Creator and studio sites, distributors, newsletters, platform showcases | Daily light pass; deep pass Monday and Thursday | Web search and fetch; the in-app browser only for JavaScript-heavy pages. |
| Festival organisers, programmes, results, FilmFreeway | Monday and Thursday | Organiser pages first; reconcile awards with the catalogue. |
| Broader creator discovery, credits, interviews and festival crossovers | Monday and Thursday | Deep watch survey: follow promising filmmakers through their body of work. |

YouTube is read only through the Data API (API key, no account, no browser) and X only through the official API. See the runbook's safety rules.

## X API pilot

### Public pilot status

The public discovery script and watchlist are implemented. On November 14 a single 10-post request authenticated successfully with the configured app bearer token. Two relevant public leads were verified in the private queue. The page had further results, so the probe records partial coverage. It was a smoke test and did not advance any production watch-group checkpoint. Its post-read estimate is $0.05 at the published rate. The user confirmed billing before scheduled public discovery was enabled.

The first unattended public handoff still needs verification. Account-wide bookmark consent is recorded. The OAuth PKCE helper, unattended token renewal, daily head-page read, bounded catch-up and independent public-verification commands are implemented; live authorization and the first real bookmark handoff remain unverified. The existing consumer key and secret do not authorize bookmark access. See the [X discovery runbook](x-discovery.md) for commands and the schedule and handoff instructions.

### Scripts and private handoff

- Use `scripts/x-discovery.mjs` on the existing Node runtime. Use built-in `fetch`, validate configuration, and provide an offline dry run that prints the planned requests and maximum cost. Keep request limits in code so a prompt or rerun cannot exceed them.
- Use `scripts/x-watchlist.json` for public priority handles and rotation settings. Treat the verified artist records as the eligible public pool. Keep last checked times and independent checkpoints per stable query group in private state. Use oldest successful coverage when selecting a rotating group. Rebuild queries within X's documented search limits. Report the oldest unchecked group and any gap beyond Recent Search's seven-day window.
- Use app-only OAuth for public search. Use the separate local bookmark authorisation helper `scripts/x-bookmark-auth.mjs` using OAuth 2.0 PKCE, the bookmark read scope and its required read scopes. Request offline access only for unattended renewal. Store user and refresh tokens in a local secret store, separate from the public search credential. Begin with explicit consent and verify the authorisation can be revoked.
- For bookmarks, use a small page of up to 20 items and track previously seen saved-post IDs rather than filtering by original post date. Stop at a known boundary or mark coverage partial when the page budget runs out. Verify account-wide endpoint access in a live smoke test. Restart the first page daily; use separate initial catch-up pagination capped at 100 returned entries. Bookmark-save timestamps are unavailable, so do not claim an exact five-day catch-up. Keep the full feed and saved-activity provenance private. The first pass is a recent sample. Likes stay outside this pilot.
- Stage results privately before advancing any checkpoint. Pass relevant public URLs and short public evidence notes to the existing `film-queue.py add` interface, then read back the records. Replay staged results locally after a failed handoff. Track festival referrals and outstanding X-only thread requests in private intake. Expire raw response data after handoff. Receipts retain enough detail to distinguish complete, partial, blocked and empty checks.

Sources for implementation. [App-only authentication](https://docs.x.com/fundamentals/authentication/oauth-2-0/application-only) · [Get Bookmarks](https://docs.x.com/x-api/users/get-bookmarks) · [OAuth 2.0 PKCE and refresh tokens](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code) · [Recent Search](https://docs.x.com/x-api/posts/search-recent-posts)

### Request and cost limits

Use six data requests per Europe/Madrid day across all runs (three until November 21, 2026) and at most 20 returned posts per request. Persist the allowance across crashes, concurrent runs and retries. After bookmark authorisation, reserve one for the head page and, when candidates merit handoff, one for their app-only public verification. Allocate remaining capacity between priority search, overdue rotation, a high-value thread and the bounded initial catch-up; alternate priority and overdue rotation when only one request remains. A typical day is the bookmark head page, its verification, three public creator pages and one thread or lookup; never promise all these reads every day within the six-request cap. Before bookmark authorisation the spare request can be used for public coverage. A token refresh is a separate authentication operation. Keep expansions and extra resource lookups outside this pilot.

At X's published price of $0.005 per public post, the 2,800-read monthly cap costs at most $14.00. A typical day (a 20-post bookmark page, about five verifications and three full creator pages) is about 85 reads, roughly $13 over 31 days at the ordinary rate, or less if the bookmark page qualifies for Owned Reads at $0.001. Confirm eligibility and actual charges in the Developer Console. Apply a separate $15 billing-cycle limit and keep auto-recharge off. If X reports a limit or payment failure, stop X requests and preserve the unfinished range. Authentication or queue failure is reported as a failure. Independent non-X research continues. [X pricing, Owned Reads and spending limits](https://docs.x.com/x-api/getting-started/pricing)

## Editorial decisions and publication

- **Catalogue.** Select authored films, complete episodes, and music videos with a sustained visual concept. Verify authorship, the original release or documented screening, and credited artwork. Explain why the work matters. Attribute costs, schedules, team size, exact models and techniques to the people who disclosed them. Missing optional details can remain unknown. Resolve duplicates and distinguish release, announcement, award and availability changes.
- **Journal.** Write for substantive new discoveries and changes, including newly catalogued films/artists with an editorial finding or production account. What’s New does not replace authored journal coverage. Reconcile the refresh diff against the journal before publication; explain intentional omissions privately. Link all discussed catalogue works and their credited artist or studio records in frontmatter. Verify the rendered cards, artist links, images, headings and sources before commit and after deployment.
- **Featured.** Make a provisional pick after intake and revisit it before publishing. Compare recent additions and worthwhile back-catalogue works using the finished cut or substantial sequence-level evidence. Judge the specific contribution of staging, editing, performance, sound or visual form and check credited artwork at desktop and mobile crops. Keep exactly five works, one per creator and recurring persona or closely related formula, and at most two music videos. Preserve each retained work's original start date, rotate within seven days, and allow at least a week off before returning. Record the near-miss or the reason for retaining the slate privately. Use comparable PostHog watch or detail clicks per impression as supporting evidence. Under 50 comparable impressions is directional. Latest remains independent.
- **Publishing.** The journal and festival jobs own their respective editorial changes. Only one publishes from the canonical checkout at a time. If another job is writing, wait for a clean checkout, then recheck whether the evidence is already covered. Review the changed files, run the pinned `pnpm check` and `pnpm build`, push the verified commit to GitHub, deploy the identical commit to the existing Cloudflare Pages project, and verify the public destination before marking a lead published. If Cloudflare fails after GitHub succeeds, retain the verified commit and report it as awaiting publication.

The [content refresh procedure](content-refresh.md) contains detailed inclusion, journal, homepage verification and publishing steps.

## Rollout and acceptance

1. Implement the scripts and watchlist in a dedicated engineering change. Test fixtures for pagination, old posts newly saved as bookmarks, repeat runs, concurrent budget reservations, rate limits and failed queue handoffs. Keep new dependencies out of the first version.
2. Public smoke test completed with one 10-post request and two verified queue entries. Billing was confirmed before activation.
3. Account-wide bookmark consent received November 17. Complete OAuth setup, then test one bounded read, private deduplication, public verification, queue readback and unattended token renewal. Check observed charges. A bookmark failure should leave public discovery functional.
4. Public schedule cutover completed. The 11:00 task owns X API requests, and journal and festival tasks use their shared handoff. The weekly editorial watch remains in place.
5. Verify the first unattended daily handoff from X intake to disposition. An empty receipt proves only the empty path. A non-empty handoff is verified from public lead to disposition and, when selected, live page. After one week review cost, oldest unchecked group, delayed items and outcomes before changing the budget or cadence.


## November 18 audit and repair

The November 17 music-video production record and November 18 filmmaker discovery shipped without journal notes because the new-entry/What’s New rule was applied too narrowly. The page renderer was healthy; no source notes were created. Substantive discoveries now explicitly require authored journal coverage.

The API cutover also dropped primary source detail: a short queue note survived while the full selected public post was discarded. The journal then required another non-X source, turning accessible X releases into blocked leads. Discovery now preserves only the selected verified public source evidence privately, with no bookmark provenance or unrelated feed content. The journal can evaluate that primary evidence locally. Known missing posts use a bounded batch lookup, including posts outside Recent Search’s seven-day window.

Default creator selection now uses the least recently paged group rather than repeatedly favoring a partial group with no completed checkpoint. The request ceiling is six data requests / 100 reserved reads per day and 2,800 per month (raised from three / 60 / 1,860 on November 21, 2026). This is sampled coverage, not a daily check of every artist. Report groups actually sampled, oldest coverage and lost ranges. Bookmark verification and targeted recovery use the same allowance; do not increase it silently or claim exhaustive coverage.

Full original descriptions revealed HOLED Episode 6’s title The Last Good Copy and Space Pirates Episode 8’s title Family Sharing behind promotional headlines. The latter was already released November 3. The daily refresh must inspect creator release lists and full descriptions before treating a failed exact-title search as lack of evidence.

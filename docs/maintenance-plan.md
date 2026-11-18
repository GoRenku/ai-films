# Latent Matinee maintenance plan

Schedule inventory reviewed November 17, 2026. Times use Europe/Madrid, including daylight-saving changes. The saved schedules are the authority for run times and activation. Public discovery has been enabled. Account-wide bounded bookmark intake is authorized; activation awaits OAuth setup and a verified live read.

## Schedule and ownership

| Time | Task | Current operation | Target responsibility and handoff |
| --- | --- | --- | --- |
| Daily, 11:00 | X discovery | Active with capped, public X API discovery | Run one bounded X API intake job. Review public creator posts and, once OAuth setup is complete, a bounded account-wide page of personal bookmarks. Send qualifying public leads to the private film queue and report coverage. |
| Thursday, 11:00 | AI Film Director Watch | Existing weekly ChatGPT watch. The November 12 report is confirmed in its pinned conversation. | Keep the deep editorial survey. Follow promising filmmakers beyond the catalogue, examine several works where available, and report how authorship, production practice and exhibition have developed. Deliver a source-linked report for the journal, without editing the site. |
| Monday and Thursday, 11:30 | Festival watch | Active. Uses organiser and other non-X sources. | Check known calls, deadlines, screenings and results, plus a rotating set of prospective events. Reconcile official selections and awards against the catalogue. Own festival records and the film and artist updates supported by festival evidence. Route X-only source requests to the API job. |
| Daily, 13:00 | Journal and homepage | Active. Uses private intake and non-X discovery. | Process intake, verify releases and production claims, review Featured, and publish a validated update. Pick up late festival or director-watch handoffs on the next run. |
| On submission | Direct leads | Existing private intake | Accept a public URL and brief evidence from the user or a discovery task. Retain the public source and eventual disposition. |

The X discovery, journal and festival schedules are local Codex tasks. The weekly watch runs in its existing ChatGPT conversation. Keep separate jobs where the work has a different purpose. The daily journal reads each new completed weekly report in full, reconciles every finding with the catalogue and records the report ID and evidence-based dispositions. A weekly report that finishes after the journal cutoff is picked up at the next daily run.

## Source coverage

| Source | Cadence | How to check |
| --- | --- | --- |
| Private queue, submitted links, completed director-watch reports | Start of each 13:00 run | Read unresolved leads, deduplicate URLs and aliases, check previous dispositions, and verify the original sources. |
| Creator and studio release pages, distributor listings, newsletters and feeds | Daily for known releases and recent updates. Rotate the remaining sources weekly. | Prefer public feeds or official listings. Use Computer Use to read interactive release pages where needed. Prioritise creators with a scheduled release or a substantive follow-up. |
| Public X creator posts and making-of replies | Daily at 11:00 | Rotate the least recently checked creator group, including the priority group, so a busy partial group cannot consume every public slot. Use named targeted checks when a release warrants them. Use official API search. Fetch selected creator replies for credits, production methods and cost disclosures within the shared cap. |
| Personal X bookmarks | Daily at 11:00 after OAuth setup | Account-wide scope authorized November 17. Read the first page of up to 20 bookmarks; the initial catch-up sample is capped at 100 returned entries across bounded requests. Find newly saved items even when the original post is old. Hand off only relevant, independently public sources. |
| Festival organisers, programmes, results, and discovery directories such as FilmFreeway | Monday and Thursday, with time-sensitive events first | Confirm dates and results at the organiser. Use Computer Use for interactive catalogues and screening rooms where needed. Dedupe notices. Maintain the next event date so routine checks concentrate on what can change. |
| Broader creator discovery, credits, interviews and festival crossovers | Weekly Director Watch, with targeted daily follow-up | Compare bodies of work and look for missed or underrepresented creators. Use original releases, creator portfolios, interviews and production notes. A headline or festival award alone establishes no artistic assessment. |

Use direct document or feed reads when sufficient. For YouTube, use the verified signed-out Chrome Incognito procedure in the [refresh runbook](content-refresh.md). Record any access limit. Follow the same runbook to track and close task-owned tabs and windows. Automated X access goes through the API job.

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

Use three data requests per Europe/Madrid day across all runs and at most 20 returned posts per request. Persist the allowance across crashes, concurrent runs and retries. After bookmark authorisation, reserve one for the head page and, when candidates merit handoff, one for their app-only public verification. Allocate remaining capacity between priority search, overdue rotation, a high-value thread and the bounded initial catch-up; alternate priority and overdue rotation when only one request remains. Never promise all these reads every day within a three-request cap. Before bookmark authorisation the spare request can be used for public coverage. A token refresh is a separate authentication operation. Keep expansions and extra resource lookups outside this pilot.

At X's published price of $0.005 per public post, three full public pages cost up to $9.30 over 31 days. With two full public pages and one full eligible Owned Reads bookmark page per day, the estimate is $6.82 over 31 days. Confirm eligibility and actual charges in the Developer Console. If bookmarks are charged at the ordinary post-read rate, all three full pages would cost $9.30 under the same assumptions. Apply a separate $10 billing-cycle limit and keep auto-recharge off. If X reports a limit or payment failure, stop X requests and preserve the unfinished range. Authentication or queue failure is reported as a failure. Independent non-X research continues. [X pricing, Owned Reads and spending limits](https://docs.x.com/x-api/getting-started/pricing)

## Editorial decisions and publication

- **Catalogue.** Select authored films, complete episodes, and music videos with a sustained visual concept. Verify authorship, the original release or documented screening, and credited artwork. Explain why the work matters. Attribute costs, schedules, team size, exact models and techniques to the people who disclosed them. Missing optional details can remain unknown. Resolve duplicates and distinguish release, announcement, award and availability changes.
- **Journal.** Write for substantive new discoveries and changes, including newly catalogued films/artists with an editorial finding or production account. What’s New does not replace authored journal coverage. Reconcile the refresh diff against the journal before publication; explain intentional omissions privately. Link all discussed catalogue works and their credited artist or studio records in frontmatter. Verify the rendered cards, artist links, images, headings and sources before commit and after deployment.
- **Featured.** Make a provisional pick after intake and revisit it before publishing. Compare recent additions and worthwhile back-catalogue works using the finished cut or substantial sequence-level evidence. Judge the specific contribution of staging, editing, performance, sound or visual form and check credited artwork at desktop and mobile crops. Keep three to five works, one per creator and recurring persona or closely related formula, and at most two music videos. Preserve each retained work's original start date, rotate within seven days, and allow at least a week off before returning. Record the near-miss or the reason for retaining the slate privately. Use comparable PostHog watch or detail clicks per impression as supporting evidence. Under 50 comparable impressions is directional. Latest remains independent.
- **Publishing.** The journal and festival jobs own their respective editorial changes. Only one publishes from the canonical checkout at a time. If another job is writing, wait for a clean checkout, then recheck whether the evidence is already covered. Review the changed files, run the pinned `pnpm check` and `pnpm build`, push the verified commit to GitHub, deploy the identical commit to the existing Cloudflare Pages project, and verify the public destination before marking a lead published. If Cloudflare fails after GitHub succeeds, retain the verified commit and report it as awaiting publication.

The [content refresh procedure](content-refresh.md) contains detailed inclusion, journal, homepage verification and publishing steps.

## Rollout and acceptance

1. Implement the scripts and watchlist in a dedicated engineering change. Test fixtures for pagination, old posts newly saved as bookmarks, repeat runs, concurrent budget reservations, rate limits and failed queue handoffs. Keep new dependencies out of the first version.
2. Public smoke test completed with one 10-post request and two verified queue entries. Billing was confirmed before activation.
3. Account-wide bookmark consent received November 17. Complete OAuth setup, then test one bounded read, private deduplication, public verification, queue readback and unattended token renewal. Check observed charges. A bookmark failure should leave public discovery functional.
4. Public schedule cutover completed. The 11:00 task owns X API requests, and journal and festival tasks use their shared handoff. The weekly editorial watch remains in place.
5. Verify the first unattended 11:00 to 13:00 handoff. An empty receipt proves only the empty path. A non-empty handoff is verified from public lead to disposition and, when selected, live page. After one week review cost, oldest unchecked group, delayed items and outcomes before changing the budget or cadence.


## November 18 audit and repair

The November 17 music-video production record and November 18 filmmaker discovery shipped without journal notes because the new-entry/What’s New rule was applied too narrowly. The page renderer was healthy; no source notes were created. Substantive discoveries now explicitly require authored journal coverage.

The API cutover also dropped primary source detail: a short queue note survived while the full selected public post was discarded. The journal then required another non-X source, turning accessible X releases into blocked leads. Discovery now preserves only the selected verified public source evidence privately, with no bookmark provenance or unrelated feed content. The journal can evaluate that primary evidence locally. Known missing posts use a bounded batch lookup, including posts outside Recent Search’s seven-day window.

Default creator selection now uses the least recently paged group rather than repeatedly favoring a partial group with no completed checkpoint. The request ceiling remains three data requests / 60 reserved reads per day and 1,860 per month. This is sampled coverage, not a daily check of every artist. Report groups actually sampled, oldest coverage and lost ranges. Bookmark verification and targeted recovery use the same allowance; do not increase it silently or claim exhaustive coverage.

The recovery also established an independent signed-out private browser context for YouTube, avoiding the native active-window failure. Full original descriptions revealed HOLED Episode 6’s title The Last Good Copy and Space Pirates Episode 8’s title Family Sharing behind promotional headlines. The latter was already released November 3. The daily journal must inspect creator release lists and full descriptions before treating a failed exact-title search as lack of evidence. Revalidate context ownership after reconnects; never navigate a user/default YouTube tab.

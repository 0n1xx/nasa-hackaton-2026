# Code review, wave 3 (community-hub)

**Scope:** `git diff c6e4497 -- server shared src`, plus `server/place.ts`, `server/directory.ts` and
`server/ranked.ts` in full. This is a read-only review: no source file was changed, no server was started and no
browser was used. The probes call the sim-mode functions directly with `tsx`, and `npm test` passes (88/88).

**Baseline:** commit `22d5a1f`, which now holds the three files that were uncommitted when the review started, plus
the working tree at about 00:25 on 15 Nov. Another session was editing 19 files at the same time (sim pinned to
14 July, `MAP_AREA` widened, wording changes). Every file:line was re-read in the working tree at that time, and
every probe was re-run against it. Expect small shifts if those edits continue.

**Labels:**

- **CONFIRMED:** traced in the code and, where noted, reproduced with a sim-mode probe.
- **PLAUSIBLE:** the code path is traced, but the outcome depends on something outside the code (upstream limits,
  network, assistive technology).

The findings are ordered by severity, with wrong facts and demo-visible problems first. There are 10 CONFIRMED and
5 PLAUSIBLE.

---

## 1. Switching to Live shows the example data as real, and the assistant states it as real (CONFIRMED, trace)

- `src/api.ts:20` keeps the previous `data` and `sources` while a new mode loads (`{ ...s, loading: true }`).
- `src/pages/Community.tsx:58` keeps that report on screen for the same id, and `:60` sets
  `example = mode === 'sim'`. These all read `mode`, not the data:
  - the banner (`src/App.tsx:26`);
  - the "Example fire." tag (`FireAndSmoke.tsx:21`, passed from `Community.tsx:79`);
  - HeroMap's `sim` flag and fire titles (`HeroMap.tsx:197,316`).
- `src/components/Assistant.tsx:54-56` answers instantly from the stale `report` with the new `mode`, so `say()`
  (`shared/assistant.ts:144`) drops "In this example scenario".

**Scenario:** the presenter opens Whitesand in the example and clicks "Live data". Until the live weather, fire and
air requests come back (not measured), several things happen at once:

- the banner is gone;
- the simulated fires are titled "Wildfire reported by fire crews";
- "Why is the risk high?" answers "Fire risk is very high today (75 out of 100)…" with no example lead-in;
- the ranked list and the map discs also stay on the example values.

`AskForHelp.tsx:98` already guards against this by also checking `sources` for `kind === 'simulated'`.

**Fix:** in `useApi`, store the mode and horizon each result was fetched for, and return `data: null` while they
differ from the current ones (every page already renders a skeleton for null). The smaller fix: derive `example`
from `sources.some((s) => s.kind === 'simulated')` in Community, HeroMap and Assistant, as AskForHelp does.

## 2. The letter to the agencies says "very high **from** Thursday" for a single very high day (CONFIRMED, probe)

- `shared/letter.ts:122-128` always writes "expected to be <level> from <first higher day>".
- The page checks whether that level holds (`src/components/community/words.ts:76-77`). When it does not, the
  page says "reach … on" instead.

**Scenario (sim, Fort William, default 3-day look-ahead):** the levels are High on 14–15 July, Very high on 16 July
and High on 17 July.

- The letter says: "Fire risk near Fort William First Nation is high today, Tuesday 14 July … and expected to be
  very high from Thursday 16 July."
- The page says: "It is expected to reach very high on Thursday."
- With the 2-week look-ahead, 17 to 26 July are all High.

The home row has the same rule (`src/components/RiskPanel.tsx:46,54` with `peakLevelFrom`,
`server/ranked.ts:70,74`), but in sim no top-20 row was affected at 1, 3, 7 or 14 days, so that part is
PLAUSIBLE.

**Fix:** build this phrase in one shared function using the `holds` rule from `words.ts`. Use it in the letter,
in `rankRow` (add a `peakHolds` flag) and in the assistant's `outlookClause`.

## 3. The same smoke reading is described three different ways (CONFIRMED, probe)

| Surface | Source | Scale |
|---|---|---|
| Page | `words.ts:257` | Team scale: 51–100 "light", 101–200 "moderate" |
| Letter | `shared/letter.ts:149-151` | US EPA band label |
| Assistant | `shared/assistant.ts:420-424` | Its own EPA-like words and advice |

**Scenario (sim, Fort William, AQI 183; Wabaseemoong 184):**

- **Page:** "Smoke in the air: moderate today", with advice that only sensitive people "may want to cut back".
- **Letter:** "unhealthy".
- **Assistant:** "the smoke is unhealthy for everyone", with advice for everyone.

**Fix:** one `smokeLevel()` in `shared/` on the EPA breakpoints, in plain words, with one advice table, used by
all three.

## 4. Live `/api/places/ranked|levels` is a quota and latency trap (PLAUSIBLE: the structure is traced, the limits are not)

**Structure (traced):**

- `server/ranked.ts:61` caches per `(mode, days)`, and `server/sources/openMeteo.ts:25` caches per chunk per `days`.
  Every look-ahead (and any 1–14 the API accepts) is therefore a fresh fetch.
- In the working tree it covers all 641 communities (`ranked.ts:17`), so `services.ts:38` fetches 17 chunks of 40
  points one after another.
- One failed chunk fails the whole list with a 502. Failures are not cached, so every request tries again.
- It is requested from home, from every community page (`HeroMap.tsx:202`, plus the 79-cell `risk-grid` at `:203`,
  which the community view does not draw), and from "Use my location" (`FindCommunity.tsx:93`), which only needs
  coordinates.

**Limits (from memory of Open-Meteo's published terms, not checked here):** each location in a request is billed,
with extra weight beyond 14 days, against roughly 600 calls a minute and 5,000 an hour. On those terms one cold
computation is 640 to 1,000 calls, so a visitor clicking through the four look-ahead buttons could exhaust the
server's shared quota. `/api/place` would then fail as well ("We couldn't load this community right now").

**Fix:**

- Fetch each point once at `MAX_HORIZON` and slice it for every horizon, so the cache key has no `days`.
- Use a TTL of 30–60 minutes and serve stale data while refreshing.
- Fetch 2 or 3 chunks at a time and return partial results.
- On the community page, colour the focus disc from the place report and skip `places/levels` and `risk-grid`.
- For "Use my location", ship the coordinates of all communities to the browser and choose there. That needs no
  weather, and the position never leaves the device, as About promises.

Do not test this against the API before the demo.

## 5. "Strong wind" counts days up to two weeks ahead, so the number of warning signs changes with the look-ahead (CONFIRMED, probe)

`shared/signals.ts:101` builds its window from `[today, ...ahead]`, where `ahead` is every forecast day fetched. The
rule text and About (`src/pages/About.tsx:41`) say "today or in the next 3 days".

**Scenario (sim):** 38 of 641 communities show a different "N warning signs right now" at 3 days than at 2 weeks.
For example, Pimicikamak goes from 2 to 3 because of a 30 km/h peak on 25 July, 11 days out.

**Fix:** limit the window to `ahead.slice(0, 3)` in all three places that compute the peak, so they keep quoting
the same day:

- `signals.ts:101`
- `shared/letter.ts:79-83` (`windPeak`)
- `shared/assistant.ts:185-188` (`signPhrases`)

The outlook sign (`signals.ts:134`, whose rule says "72-hour") needs the same change.

## 6. The assistant names days a week or more away by weekday alone (CONFIRMED, probe)

`shared/assistant.ts:132` `weekday()` is used for three phrases:

- the peak day (`:375`);
- "plans in place by" (`:378`);
- "ease to … by" (`:166`).

The page and the letter switch to the full date from 7 days out.

**Scenario (sim, 2-week look-ahead, today Tuesday 14 July):**

- **Collins:** "The highest day in the next 14 days is expected to be Monday". That is Monday 27 July, but it reads
  as Monday 20 July.
- **Gull Bay:** "Friday" means Friday 24 July, but it reads as 17 July.

**Fix:** move `dayWord()` (`words.ts:31`) into `shared/` and use it in the assistant.

## 7. Common evacuation questions miss the evacuation answer (CONFIRMED, probe of `classifyIntent`)

All 5 suggested questions classify correctly. The failures come from `shared/assistant.ts:102-107`:

| Question | Classified as | Effect |
|---|---|---|
| "Do we need to leave?" | `unknown` | Generic suggestions, no 911 line (no Claude key) |
| "Do we have to leave?" | `unknown` | Same |
| "Is it time to leave?" | `unknown` | Same |
| "Does this mean we should leave?" | `meaning_of_level` | Explains the risk levels |
| "What should we do to make sure we are ready?" | `how_sure` | Bare `/\bsure\b/` at `:106` |

**Fix:**

- Add these patterns to `evacuation`: `/\b(need|have|got) to (leave|go|get out)\b/`, `/\btime to (leave|go)\b/` and
  `/\b(we|i) (should|must) (leave|go)\b/`.
- Drop the bare `sure`, or exclude "make sure".

## 8. When the satellite feed is down, the page says no heat was spotted (CONFIRMED, trace; live only)

`server/place.ts:76` passes `hotspots100km: p.hotspots100km ?? 0` into `warningSigns`. `shared/signals.ts:112-115`
then emits an inactive fire sign, which `words.ts:186` renders as "No heat spotted by satellites within 100 km in the
last day." It appears under "See what else we check" (`WhySigns.tsx:30`), while `FireAndSmoke.tsx:28` on the same
screen says "Satellite heat readings are not available right now."

**Fix:** pass `null` through, make `RegionRisk.hotspots100km` nullable, and skip the fire sign when it is null.

## 9. On the phone question page, a failed load gets the answer "Choose your community first" (CONFIRMED, trace)

`src/pages/AssistantPage.tsx:22` mounts `<Assistant>` even when the community's data failed. Community mounts it only
once data exists (`Community.tsx:104,120`). The chain is:

1. `Assistant.tsx:56` sends the question to the server because `report` is null.
2. `server/assistant.ts:111` turns the `placeReport` failure into `report = null`.
3. `shared/assistant.ts:342` returns `NO_PLACE`.

**Scenario (live, Open-Meteo down, `/c/whitesand/ask`):** "Why is the risk high?" answers "Choose your community
first…" with a "Find your community" link.

**Fix:** carry "community chosen, but its data is unavailable" through the context. Answer "We can't load the fire
risk for <name> right now", followed by the 911 line and the official rating link.

## 10. Opening a community can wait 8 s for NASA POWER before anything shows (PLAUSIBLE, depends on the network)

`server/place.ts:25,144`. `placeReport` waits up to `HISTORY_WAIT_MS` (8 s) for a first-time POWER download (about
1 MB per cell) before it answers, so the whole panel stays a skeleton, in the example too. The disk cache has its
own guard against duplicate downloads (`powerDaily.ts`). But `server/.cache` is gitignored and holds 5 files
locally, so the planned fresh-clone smoke test, or a demo on venue Wi-Fi, starts cold for every new cell.

**Fix:** wait about 1.5 s, since the page already polls while `historyStatus` is `'loading'`. Also warm the cache
for the demo communities at start-up, or ship their cache files.

## 11. Public endpoints allow unbounded upstream fan-out and cache growth (PLAUSIBLE, security and availability)

**Problem:**

- `server/index.ts:49` (`/api/place/:id`) and `:54` (`/api/assistant`) accept 641 ids × `days` 1–14 × 2 modes, with
  no rate limit on the built-in path.
- Each new combination is a fresh Open-Meteo weather and air fetch, plus a POWER download per cell.
- `server/util.ts:4` never evicts entries.
- `{"messages":[null]}` throws a TypeError at `server/assistant.ts:108`, which returns a 500 with the internal
  message.
- Without `trust proxy`, `req.ip` is the proxy's address, so the per-visitor Claude cap becomes site-wide.

**Fix:**

- Accept only the `HORIZONS` values on the server.
- Add a per-IP limiter (like `allowClaudeCall`) to `/api/place`, `/api/places/*` and `/api/assistant`.
- Cap the cache with LRU eviction.
- Keep only `messages` that are objects with a string `content`.
- Set `trust proxy` when deployed behind a proxy.

## 12. Typing one or two letters in search matches internal ids, not names (CONFIRMED, probe)

`server/directory.ts:82` adds `c.id` (such as `isc-441`) to every entry's search terms.

- "i" and "is" return **Paul, Blood, Dokis**, then Iskut and Siska: names that do not start with what was typed.
- "1" returns Albany, Bilijk and Saugeen.
- Accents and apostrophes are fine: "Kahnawà:ke", "lilwat", "God’s Lake" and "premiere nation" all match.

**Fix:** drop `c.id` from the terms of ISC entries. The slugs of the hand-checked list can stay.

## 13. On the phone, "Show me on the page" lands at the top of the community page (CONFIRMED, trace)

From `/c/:id/ask`, `Assistant.tsx:79-89` finds no `#why`, `#status` or `#look-ahead` element on that page and
navigates to `/c/id#why`. Nothing on Community reads the hash, and `App.tsx` scrolls `<main>` to the top. Almost
every answer carries this link, so on the phone it never takes the person where it says.

**Fix:** in Community, once the data has rendered, read `location.hash` and scroll that element into view (with the
same outline flash as `goTo`).

## 14. Screen readers may not hear the assistant's answers, and focus is lost (PLAUSIBLE, accessibility)

- `Assistant.tsx:130`: each answer is a new `<article aria-live="polite">` that arrives already filled. Answers are
  usually instant, and screen readers often do not announce a live region inserted with its content.
- `Assistant.tsx:128`: the suggestion button that was pressed unmounts, so focus falls to `<body>`.

**Fix:** add one persistent `role="status"` region that receives the latest answer text. Move focus to the new
answer (`tabIndex={-1}`).

## 15. The phone full-screen map is a dialog without dialog behaviour (PLAUSIBLE, accessibility)

`src/pages/Home.tsx:26-35`: "Open the map" replaces itself with a fixed full-screen layer. Focus is not moved into
it, and the header and panel behind it stay in the tab order and the accessibility tree.

**Fix:**

- Give the layer `role="dialog"`, `aria-modal` and `aria-label`.
- Focus "Close map" when it opens, and return focus when it closes.
- Make the rest of the page `inert` while it is open.

---

### Fixed in the working tree while this review ran (keep these edits)

- **"Use my location" opened the wrong community (CONFIRMED in `4d33b31`/`22d5a1f`).** Only the 48–62° N band was
  ranked, so of the raw ISC list, 89 Nations were sent to another community up to 300 km away (Atikameksheng
  Anishnawbek went to Matachewan, 190 km) and 112 were told they were not listed. The working tree widens
  `MAP_AREA` (`ranked.ts:17`, 0 outside now), sets `NEAR_KM` to 100 and names the nearest community before
  opening it. Its dependence on the weather computation remains (#4).
- **The example's "today" came from the server's clock.** It is now pinned by `SIM_NOW_MS` in `server/sim.ts`.

### Below the cut (low, not counted)

- **The history poll stops on a community-to-community hop.** `Community.tsx:50` never resets `tries` when
  `id` changes. Community stays mounted when the map popup's "Open …" is used (`HeroMap.tsx:325`), so after six polls
  in total the 42-year line stops loading. CONFIRMED, trace.
- **An emoji can blank the help page.** The mailto cut (`shared/letter.ts:255-263`) can split a surrogate pair, for
  example an emoji typed into the letter. `encodeURIComponent` then throws `URIError` during render
  (`AskForHelp.tsx:132`), and with no error boundary (`src/main.tsx`) the page goes blank. PLAUSIBLE, rare.
- **The map can be one day off after midnight Eastern.** In live mode, between 00:00 and 03:00 Eastern,
  `HeroMap.tsx:238-241` takes `levels.days` from fort-william (Eastern) and `grid.days` from the cell at 49, −125
  (Pacific). Western cells then show the next day, and a day picked on a BC page maps one day off. PLAUSIBLE
  (traced, not observed).
- **A Claude answer can be dropped silently.** `server/assistant.ts:95`: `max_tokens: 1024` with thinking that is
  always on can end in `max_tokens`, which falls back to the built-in answer without notice. PLAUSIBLE.

### Checked, no finding

- **Crash sweep:** all 641 communities at 1 and 14 days, run through `placeCore`, every `words.ts` builder,
  `buildLetter`, `mailtoHref` and every intent of `answer()`, gave 0 throws. This includes the 141 entries with
  `regionId: null`.
- **Dates:** they are read at `T12:00` or with UTC weekday maths, and `riskOutlook`/`actByDate` agree with the page.
- **Search:** accents and apostrophes are handled.
- **mailto:** the CRLF conversion, the encoding and the 1,900-character cap work, the example keeps its bottom mark,
  and To is empty in the example (`AskForHelp.tsx:131`).
- **Contacts:** every one traces to `docs/research/contacts.md`, including all ISC emails used in To.
- **XSS:** there is no `dangerouslySetInnerHTML`, and Leaflet's `divIcon` HTML is static.
- **Claude request:** the model id, the server-side fallback beta, `fallbacks: 'default'` and `effort: 'low'` match
  the current API.

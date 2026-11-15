# Before the Smoke

**See it coming. Ask for help before anyone has to leave.**

A NASA Space Apps Challenge 2026 prototype: a hub where a member of a First Nation in Canada can find their community, see the expected fire risk for the coming days in plain English, understand why, know what to do, and write a request for firefighters and equipment to the province and Indigenous Services Canada, before a fire starts.

It brings together NASA satellite fire detections and imagery, weather forecasts, 42 years of NASA daily weather records, Canada's wildfire information system, and Indigenous Services Canada's open list of First Nations locations.

> Prototype. Not an emergency alerting service, not an official fire danger rating, and it does not speak for any First Nation. In an emergency, call 911.

## Run it

Needs Node.js 20.6 or newer (built with 22).

```bash
npm install
cp .env.example .env      # optional; the app runs with no keys
npm run dev               # API on :8787, site on http://localhost:5173
```

Production-style, one port: `npm run build && npm start`, then open http://localhost:8787.

Other commands: `npm test` (risk model, warning signs, statistics, horizon, letter, assistant, ranking, province lookup and scenario tests), `npm run typecheck`.

## What a visitor can do

| Screen | Address | What it does |
|---|---|---|
| Find your community | `/` | Search all First Nations by name (accents and apostrophes optional), use your location, or pick from "Highest fire risk" for the chosen look-ahead. The map shows communities coloured by their fire risk and reported wildfires. |
| Community | `/c/:id` | One sentence first ("Fire risk is very high today…"), a 4-step meter, how sure we are and why, what you can do now, the look-ahead (1 day to 2 weeks), the warning signs, the nearest wildfire and the smoke, and a 911 line when it matters. A built-in assistant answers questions from the same data. |
| Ask for help | `/c/:id/help` | 911 and the province's report-a-fire number first, then what you need, who to send it to (official contacts only, each with its source and the date it was checked) and a ready-to-send letter. Nothing is sent by the site. |
| Ask a question | `/c/:id/ask` | The assistant as a full page on phones. |
| About the data | `/about` | How the estimate works, why it matters (with sources), where the data comes from (live status), and "Details for experts": the formula, the warning-sign rules, the trend tests and the 42-year NASA record. |

The look-ahead and the data mode are shared by every screen. One number per place: the community page, the map, the ranked list, the assistant and the letter all use the same score, computed at the community's own location.

## Two data modes

The switch is in the top bar.

- **Live data** calls the real providers. If one is unreachable the page says so in words; live mode never substitutes invented numbers. Agency fire reports that no one has updated in 14 days, and that no satellite still sees heat at, are left off (`server/fires.ts`): the CWFIS list keeps fires until an agency declares them out, and many never are (on 15 November 2026 it still held 105 fires, including Quebec fires from 2020 and 2023; 13 were current).
- **Example scenario** is a seeded, invented summer day, Tuesday 14 July 2026, the week of the real evacuations near Thunder Bay. A banner on every screen says so, example fires are labelled, and an example letter is marked "EXAMPLE ONLY" with an empty To line. The NASA satellite photo of 14 July 2026 is real.

Set `DEFAULT_MODE=sim` in `.env` to start in the example scenario.

## The assistant

The suggested questions ("Why is the risk high?", "What can we do this week?", "Who can send firefighters?", "Is the smoke safe to breathe?", "How sure are you?") and common phrasings are answered by built-in rules from the community's own data and the verified contacts. They work offline and give the same answer every time.

Optional: with `ANTHROPIC_API_KEY` set, other free-form questions about an open community are answered by Claude (`claude-opus-5-5`, server-side refusal fallback enabled), given only that community's page data and the site's voice rules. Only the latest question is sent, calls are rate-limited (6 a minute per visitor, 300 an hour in total), and any failure falls back to the built-in answer. **This path has not been run against the live API**: the build machine had no credentials.

## Optional keys

1. NASA FIRMS MAP_KEY (free, https://firms.modaps.eosdis.nasa.gov/api/map_key/): `FIRMS_MAP_KEY=...` for satellite detections from any date.
2. Anthropic API key: `ANTHROPIC_API_KEY=...` for the free-form assistant answers above.

Keys are read only in `server/` and never reach the browser; `.env` is git-ignored. Full API report: [docs/API_REQUIREMENTS.md](docs/API_REQUIREMENTS.md).

## Architecture

```
shared/     Types, risk model, warning signs, statistics, letter, assistant rules, contacts, province lookup
server/     Express API (TypeScript, run with tsx)
  sources/  One module per provider: cwfis, cwfisStations (official Fire Weather Index), firms, openMeteo, power, powerDaily (NASA POWER since 1984)
  fires.ts  Which agency fire reports count as current (stale reports left off)
  data/     Regions, hand-checked community list, ISC First Nations locations (communities-isc.json)
  place.ts  One community's full report (/api/place/:id)
  ranked.ts Every community scored the same way, for the ranked list and the map
  sim.ts    The example scenario, isolated in one file
src/        React 18 + Vite + Tailwind 4
  pages/    Home, Community, AskForHelp, AssistantPage, About (+ older screens, not linked)
  components/HeroMap.tsx, community/*, Assistant.tsx, FindCommunity.tsx
docs/       Plan and voice guide, design critique and reviews, research (contacts, preparedness,
            community locations), presentation script and guide
scripts/    build-communities.ts (rebuilds the community list from the ISC open data)
```

## Risk model

`shared/risk.ts`. Score = 100 × Σ(weight × sub-score), with nine inputs mapped linearly to 0–1: Canada's official Fire Weather Index at the nearest CWFIS station still reporting, within 200 km, for today and the next two days (25%, left out without lowering confidence when absent); minimum humidity (13.5%), 7-day rain (12%), wind (10.5%), maximum temperature (9%), satellite detections within 100 km (9%), vapour pressure deficit (7.5%), soil moisture (7.5%), and a hand-set regional history baseline (6%). Wind, rain and the baseline are multiplied by a drying power (0 at a vapour pressure deficit of 0.2 kPa, 1 at 1.0 kPa), so cold, damp, windy days are not scored as fire days. `server/risk-calibration.test.ts` checks the weather-only score against the official index on real data from 15 November 2026 (66 of 71 official-low places Low; 23 before drying power); the weather alone misses the dry prairies (3 of 5 official-high places Low), which is why the index is also an input. After the stations' last day (+2), the last reading is held. Snow cover or sub-zero maxima scale the result to 20%. Levels shown as Low, Medium, High, Very high (under 25, 25–49, 50–74, 75 and over).

It is a relative estimate. The weights were chosen for readability and have not been fitted to or validated against fire records, so it is never shown as a probability, and the site says "our estimate, not an official fire danger rating" next to every level, with a link to the province's official rating.

## Data ethics

Community locations come from Indigenous Services Canada's open data (Open Government Licence – Canada), using the published band-office point, plus a small hand-checked list. No cultural, land-use or personal data is used or collected, and nothing about visitors is stored on the server. The site was built without community involvement; a real deployment should be co-designed with, and governed by, the communities it describes, following the First Nations principles of OCAP® and Métis and Inuit data governance.

## What has and has not been tested

| | Status |
|---|---|
| Home, community, ask for help, assistant, about: desktop 1440×900 and phone 390 px, example scenario | Clicked through in a browser |
| Unit tests (risk, signs, statistics, horizon, outlook, letter, assistant, ranking, province, scenario dates, stale fire reports, Fire Weather Index lookup) | `npm test` passes |
| Weather-only risk score against Canada's official Fire Weather Index, real data from 15 November 2026 (80 communities) | `server/risk-calibration.test.ts` passes: 66 of 71 official-low places Low. One day, not a test against real fires |
| Live calls to Open-Meteo, CWFIS (fires, hotspots, fire weather stations), NASA POWER (daily and climatology) and NASA GIBS | Called successfully on 14–15 November 2026 |
| NASA FIRMS (VIIRS NOAA-20, with a key in `.env`) | Called successfully on 15 November 2026: 150 detections over Canada in the last day. If FIRMS fails or rejects the key, today's heat falls back to CWFIS |
| The Claude assistant path (needs a key) | Not tested |
| Live-mode ranked list | Works; the first load for 641 communities takes several seconds, then it is cached for an hour (one refresh costs roughly 1,000 to 1,300 of Open-Meteo’s 10,000 free daily calls) |

## Known gaps

- Province for the ISC locations comes from simplified border lines (`shared/province.ts`, tested on border towns); a point within a few kilometres of a border can land on the wrong side.
- Some provinces publish no confirmed phone or email for the agencies we list; the site links the official page instead of guessing.
- Canada's official Fire Weather Index is an input for today and the next two days only (that is all the station feed covers). No AQHI yet; the official provincial danger ratings are linked, not shown.
- Open-Meteo rate-limits repeated cold loads of all 641 communities (HTTP 429). Restarting the API clears the cache, so restart sparingly before a live demo.

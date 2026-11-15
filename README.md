# BorealWatch

**Track wildfires. Understand smoke. Protect communities.**

A NASA Space Apps Challenge prototype that brings satellite fire detections, agency fire reports, weather, air quality and a transparent risk index into one view of Canada, built around the question of how First Nations and Métis communities and the agencies that work with them can see risk earlier and prepare on their own terms.

> Prototype. Not an emergency alerting service, and it does not speak for any Indigenous community.

## Run it

Needs Node.js 20.6 or newer (built with 22).

```bash
npm install
cp .env.example .env      # optional; the app runs with no keys
npm run dev               # API on :8787, site on http://localhost:5173
```

Production-style, one port: `npm run build && npm start`, then open http://localhost:8787.

Other commands: `npm test` (risk model and AQI unit tests), `npm run typecheck`.

## Two data modes

The switch is in the top bar.

- **Live data** calls the real providers. If one is unreachable you get an error panel naming it; live mode never substitutes invented numbers.
- **Simulated scenario** is a seeded, invented mid-summer outbreak in Northwestern Ontario. A yellow banner and "Simulated" badges mark everything. Use it outside fire season, offline, or as a safety net on stage.

Set `DEFAULT_MODE=sim` in `.env` to start in the scenario.

## What has and has not been tested

| | Status |
|---|---|
| All eight pages, both modes, desktop and 390 px mobile | Rendered and checked, no console errors |
| Region selector, table row selection, map filters, date control, case-study link, level preview, year comparison | Exercised in a browser |
| Risk model and AQI maths | Unit tests pass |
| Error and empty states | Verified with providers unreachable |
| **Live calls to CWFIS, Open-Meteo, NASA POWER, NASA FIRMS, and NASA GIBS map tiles** | **Not tested.** The build sandbox could not reach them. Written from documentation. Check **Data & methods → Data sources** on first run |

If a provider's response differs from its documentation, the fix is confined to one file in `server/sources/`.

## Connecting APIs

No key is required. One is optional:

1. Request a free MAP_KEY at https://firms.modaps.eosdis.nasa.gov/api/map_key/
2. Put it in `.env` as `FIRMS_MAP_KEY=...` and restart.
3. **Data & methods** should show NASA FIRMS as "configured". The map then offers 1–5 day detection windows and detections for past dates.

Full report: [docs/API_REQUIREMENTS.md](docs/API_REQUIREMENTS.md). Keys are read only in `server/` and never reach the browser; `.env` is git-ignored.

## Using the site

| Page | What it does |
|---|---|
| Overview | Answers three questions (where are fires, which communities, where is risk rising), with a map, region ranking and auto-generated developments |
| Wildfire map | Toggle eight layers; filter by date, detection window, fire status and size; select any marker. The **14 Jul 2026** button loads NASA imagery for the Northwestern Ontario evacuations |
| Air quality | US AQI, PM2.5, PM10, aerosol depth; hourly history and forecast; regional comparison; where air is deteriorating; health guidance |
| Risk assessment | Index, level, uncertainty and confidence; factor-by-factor contributions; 72-hour outlook; comparison with climate normals; actions |
| Community impact | Cited national evidence, principles, exposure table, regional patterns, Thunder Bay case study |
| Trends | Annual area and fire counts, year comparison, season shape, climate normals, three months of smoke |
| Preparedness | Actions tied to the current level, plus standing recommendations for communities and for governments |
| Data & methods | Live integration status, the full risk formula, limits |

Choosing a region anywhere (top bar, ranking table, chart bar, map ring) updates every page.

## Architecture

```
shared/     Types, risk model, AQI maths — imported by both sides
server/     Express API (TypeScript, run with tsx)
  sources/  One module per provider: cwfis, firms, openMeteo, power
  data/     Regions, demonstration community list, reference history
  sim.ts    The simulated scenario, isolated in one file
  services.ts  Combines sources into views; attaches provenance to every response
  util.ts   Cache, timeouts, CSV parsing, integration status
src/        React 18 + Vite + Tailwind 4
  components/MapView.tsx   Leaflet map (canvas-rendered markers, NASA GIBS WMS layers)
  pages/    One file per section
  api.ts    useApi hook: loading, error, reload, mode-aware
  state.tsx Selected region and data mode
docs/       API report, presentation script and guide
```

Every API response is `{ data, sources }`. Each source carries a kind — observed, historical, forecast, model, simulated or reference — which the UI prints as a badge with the retrieval time.

## Risk model

`shared/risk.ts`, about 90 lines. Index = 100 × Σ(weight × sub-score), with eight inputs each mapped linearly to 0–1: minimum humidity (18%), 7-day rain (16%), wind (14%), maximum temperature (12%), satellite detections within 100 km (12%), vapour pressure deficit (10%), soil moisture (10%), and a hand-set regional history baseline (8%). Snow cover or sub-zero maxima scale the result to 20%. Levels: Low < 25, Moderate < 50, High < 75, Critical.

It is a relative index. The weights were chosen for readability and have not been fitted to or validated against fire records, so it must not be described as a probability. The intended next step is to show it beside the official Canadian Fire Weather Index and then test it against the National Fire Database.

## Data ethics

The community list in `server/data/communities.ts` is a small demonstration set with rounded, already-public locations, assembled without community involvement. It contains no cultural or land-use information and none should be added without consent. A real deployment should be co-designed with communities and follow the First Nations principles of OCAP® and Métis and Inuit data governance.

## Known gaps

- Live integrations untested (see above).
- Annual statistics for 2016–2022, historic fire sizes and the season-shape chart are approximate or illustrative and labelled as such.
- No AQHI, no official FWI, no NDVI input yet.
- No automated browser tests are included in the repository.

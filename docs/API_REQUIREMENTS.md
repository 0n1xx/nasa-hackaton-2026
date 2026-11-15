# API requirements report

Status as of 15 November 2026. "Called successfully" means a real response was received and parsed during development. The live status of every source is also shown on the site, under About the data, "Where each fact comes from".

## Summary by category

| Category | APIs |
| --- | --- |
| 1. Required API keys | **None.** The app runs with no keys at all. |
| 2. Optional API keys | NASA FIRMS (`FIRMS_MAP_KEY`); Anthropic (`ANTHROPIC_API_KEY`, for free-form assistant answers only) |
| 3. Free, no authentication | CWFIS (fires, hotspots, fire weather stations), Open-Meteo Weather, Open-Meteo Air Quality, NASA POWER, NASA GIBS, Esri basemap tiles, Indigenous Services Canada open data (bundled) |
| 4. Registration required, free | NASA FIRMS (same as 2); NASA Earthdata Login (not used) |
| 5. Paid services avoided | Mapbox / Google Maps (replaced by Leaflet + Esri + GIBS); commercial weather and AQI APIs such as OpenWeather, IQAir, Tomorrow.io (replaced by Open-Meteo) |

**The only key worth requesting is a NASA FIRMS MAP_KEY.** It takes a minute and arrives by email.

## Integrated

| API name | Purpose | Authentication | Pricing | Environment variable | Documentation | Status and limitations |
| --- | --- | --- | --- | --- | --- | --- |
| NASA FIRMS (VIIRS NOAA-20 near real time) | Satellite fire detections with fire radiative power; one of the inputs to the fire risk (detections within 100 km) | Free MAP_KEY, from https://firms.modaps.eosdis.nasa.gov/api/map_key/ | Free | `FIRMS_MAP_KEY` (optional `FIRMS_SOURCE`) | https://firms.modaps.eosdis.nasa.gov/api/area/ | Called successfully on 15 November 2026. 5,000 transactions per 10 minutes. If FIRMS fails or rejects the key, today's heat falls back to CWFIS hotspots. Not every detection is a wildfire. |
| CWFIS active fires (Natural Resources Canada) | Agency-reported wildfires: location, size, stage of control, last update | None | Free | none | https://cwfis.cfs.nrcan.gc.ca/datamart | Called successfully. The feed keeps fires until an agency declares them out, so reports nobody has updated in 14 days are left off unless satellites still see heat there (`server/fires.ts`). |
| CWFIS hotspots, last 24 hours | Satellite heat detections without a key; the FIRMS fallback | None | Free | none | https://cwfis.cfs.nrcan.gc.ca/datamart | Called successfully. 24 hours only, capped at 8,000 features. |
| CWFIS fire weather stations (`public:firewx_scribe`) | Canada's official Fire Weather Index at about 800 stations, today and the next two days; 25% of the fire risk | None | Free | none | https://cwfis.cfs.nrcan.gc.ca/maps/fw?type=fwi | Called successfully. Nearest station still reporting, within 200 km. Stations stop for the winter (reported as -101); the site then says so. Cached for an hour. |
| Open-Meteo Weather | Temperature, humidity, wind, rain, vapour pressure deficit, soil moisture, snow depth; 7 days back and up to 14 days ahead | None | Free for non-commercial use | none | https://open-meteo.com/en/docs | Called successfully. Gridded model output, not station observations. Free tier: 10,000 calls a day, 5,000 an hour, 600 a minute; one refresh of all 641 communities costs roughly 1,000 to 1,300, so the ranked list is cached for an hour. Commercial use needs a paid plan. |
| Open-Meteo Air Quality (CAMS) | Modelled PM2.5, PM10 and US AQI, up to 6 days ahead; the smoke line and health advice | None | Free for non-commercial use | none | https://open-meteo.com/en/docs/air-quality-api | Worked in development; on 15 November 2026 the deployed site's status check timed out, so check the live status on About the data. Roughly 40 km global model; under-reads near fires. Not ground monitors. US AQI only; Canada's AQHI is not provided. |
| NASA POWER daily | Daily weather for each place since 1984: compares today with the same weeks in past years, and tests for trends | None | Free | none | https://power.larc.nasa.gov/docs/services/api/temporal/daily/ | Called successfully. About 0.5° grid. Cached in memory and on disk (`server/.cache`, 7 days) so restarts do not re-download 40 years. |
| NASA POWER climatology | Long-term monthly normals for the expert notes | None | Free | none | https://power.larc.nasa.gov/docs/services/api/temporal/climatology/ | Called successfully. Slow at times; the page says so if it fails. |
| NASA GIBS | The "Satellite photo" view: MODIS Terra true colour and VIIRS NOAA-20 thermal anomalies | None | Free | none | https://nasa-gibs.github.io/gibs-api-docs/ | Called successfully. Loaded directly by the browser as WMS tiles. |
| Esri World Light Gray Canvas | Background map | None | Public basemap service; see Esri's terms | none | https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer | Attribution is shown on the map. Check Esri's terms of use before a production service. |
| Indigenous Services Canada "First Nation Location" | Where each First Nation's main community is (band office point) | None | Free (Open Government Licence – Canada) | none | https://open.canada.ca/data/en/dataset/b6567c5c-8339-4055-99fa-63f92114d9e4 | Bundled in `server/data/communities-isc.json`; rebuilt with `scripts/build-communities.ts`. Any use beyond public locations needs community consent. |
| Anthropic Messages API (optional) | Free-form assistant answers about an open community | `ANTHROPIC_API_KEY` | Paid per use | `ANTHROPIC_API_KEY` | https://docs.anthropic.com/ | **Not tested**: the build machine had no credentials. Rate-limited, and any failure falls back to the built-in answers. |

## Investigated, not integrated

| API name | Purpose | Authentication | Pricing | Documentation | Why not yet |
| --- | --- | --- | --- | --- | --- |
| NASA Earthdata Login | Raw MODIS/VIIRS granules, SMAP soil moisture, NDVI products | Account + token | Free | https://www.earthdata.nasa.gov/ | Raw granules need heavy processing. FIRMS and GIBS already expose the fire and imagery products. Needed later for real NDVI and soil moisture inputs. |
| api.nasa.gov (`NASA_API_KEY`) | APOD, EPIC and similar | Key | Free | https://api.nasa.gov/ | Offers nothing this project needs. |
| ECCC MSC GeoMet / Datamart | Official AQHI observations and forecasts, weather stations, FireWork smoke forecast | None | Free | https://eccc-msc.github.io/open-data/ | The right source for Canada's own AQHI and station data. The next integration to build. |
| CWFIS Fire Weather Index grids | Official fire danger as a raster, beyond the stations' two days | None | Free | https://cwfis.cfs.nrcan.gc.ca/datamart | Raster (WCS) data needing server-side sampling. The station feed covers today to +2 days. |
| National Fire Database / NBAC | Historical fire points and perimeters | None | Free | https://cwfis.cfs.nrcan.gc.ca/datamart | Large downloads. Would replace the hand-set regional history baseline (6% of the score). |
| OpenAQ, PurpleAir | Ground PM2.5 sensors | Key | Free tier / paid | https://docs.openaq.org | Sparse in the North. Worth adding where sensors exist. |

## Reference statistics checked during development

| Claim | Status | Source |
| --- | --- | --- |
| Indigenous people are about 5% of the population; about 42% of wildfire evacuation **events** occur in majority-Indigenous communities | Verified as a quoted research finding. It counts events, not evacuees. | Dr. Amy Cardinal Christianson, via Global News (Aug 2023) and Associated Press (Jul 2023); Canadian Wildland Fire Evacuation Database, 1980–2021. Also cited by the Public Health Agency of Canada. |
| 16 communities evacuated five or more times, 1980–2021; all but two were First Nations reserves | Verified | Associated Press, Jul 2023 |
| 2025: 6,125 fires, about 8.9 Mha | Verified | CWFIS National Situation Report, Nov 2025 |
| 2023: about 17.2 Mha (agency reports) | Verified | CIFFC, via The Narwhal |
| 2024: about 5.3 Mha; 2015: 3.9 Mha | Verified | The Weather Network; NRCan "Forest fires in Canada 2015" |
| July 2026 evacuations of Whitesand, Collins, Gull Bay, Lac des Mille Lacs and Lac La Croix First Nations; evacuees in Thunder Bay | Verified | The Canadian Press / CP24 / CTV, Jul 2026 |
| Other annual totals, fire counts, historic fire sizes and older evacuation dates | **Not verified.** Marked approximate in the app | to check against NFDB and local sources |

# API requirements report

Status as of 14 November 2026. "Tested" means a real response was received and parsed during development.

**Nothing in this table has been tested against the live service yet.** The build environment had no access to these hosts, so every integration was written from the provider's documentation and exercised only through the simulated scenario and error paths. Run `npm run dev`, open **Data & methods**, and check the "Last result" column on your own network before relying on any of them.

## Summary by category

| Category | APIs |
|---|---|
| 1. Required API keys | **None.** The app runs with no keys at all. |
| 2. Optional API keys | NASA FIRMS (`FIRMS_MAP_KEY`) |
| 3. Free, no authentication | CWFIS, Open-Meteo Weather, Open-Meteo Air Quality, NASA POWER, NASA GIBS, OpenStreetMap tiles |
| 4. Registration required, free | NASA FIRMS (same as 2); NASA Earthdata Login (not used) |
| 5. Paid services avoided | Mapbox / Google Maps (replaced by Leaflet + OpenStreetMap + GIBS); commercial weather and AQI APIs such as OpenWeather, IQAir, Tomorrow.io (replaced by Open-Meteo) |

**The only key worth requesting is a NASA FIRMS MAP_KEY.** It takes a minute and arrives by email.

## Integrated

| API name | Purpose | Authentication | Pricing | Registration | Environment variable | Documentation | Limitations |
|---|---|---|---|---|---|---|---|
| NASA FIRMS (VIIRS / MODIS active fire) | Vector satellite fire detections with fire radiative power, for the last 1–5 days or from any past date | Free MAP_KEY | Free | https://firms.modaps.eosdis.nasa.gov/api/map_key/ | `FIRMS_MAP_KEY` (optional `FIRMS_SOURCE`) | https://firms.modaps.eosdis.nasa.gov/api/area/ | 5,000 transactions per 10 minutes; multi-day requests count as several. Max 5 days per request in this app. Near-real-time products keep roughly two months; older dates use the standard-processing archive, which lags by months. Not every detection is a wildfire. |
| CWFIS, Natural Resources Canada | Agency-reported active fires (WFS GeoJSON); satellite hotspots for the last 24 h (WFS GeoJSON). Fallback for detections when no FIRMS key is set | None | Free | none | none | https://cwfis.cfs.nrcan.gc.ca/datamart | Active fires updated daily, current season only (empty in winter). Hotspot fallback covers 24 h only, capped at 8,000 features here. |
| Open-Meteo Weather | Temperature, humidity, wind, rain, vapour pressure deficit, soil moisture, snow depth; 7 days back, 3 days ahead | None | Free for non-commercial use | none | none | https://open-meteo.com/en/docs | Gridded model output, not station observations. Fair-use limit of about 10,000 calls a day; the server caches for 10 minutes. Commercial use needs a paid plan. |
| Open-Meteo Air Quality (CAMS) | Modelled PM2.5, PM10, US AQI, aerosol optical depth; up to 92 days back, 3 days ahead | None | Free for non-commercial use | none | none | https://open-meteo.com/en/docs/air-quality-api | Roughly 40 km global model; under-reads near fires. Not ground monitors. US AQI only; AQHI is not provided. |
| NASA POWER | Long-term monthly climate normals (max temperature, rain, humidity) for historical comparison | None | Free | none | none | https://power.larc.nasa.gov/docs/services/api/temporal/climatology/ | About 0.5° grid. Slow at times (20 s timeout); the app shows a notice if it fails. |
| NASA GIBS | Daily imagery on the map: MODIS Terra true colour, VIIRS NOAA-20 thermal anomalies, MODIS aerosol optical depth | None | Free | none | none | https://nasa-gibs.github.io/gibs-api-docs/ | Loaded directly by the browser as WMS tiles. Today's imagery is incomplete until the afternoon pass, so "latest" means yesterday. Layer identifiers were taken from documentation and need confirming on first run. |
| OpenStreetMap tiles (darkened in CSS) | Background map | None | Free with attribution, non-commercial volume | none | none | https://operations.osmfoundation.org/policies/tiles/ | Attribution is shown on the map. For a production service, self-host or license tiles. |

## Investigated, not integrated

| API name | Purpose | Authentication | Pricing | Registration | Environment variable | Documentation | Why not yet |
|---|---|---|---|---|---|---|---|
| NASA Earthdata Login | Download of raw MODIS/VIIRS granules, SMAP soil moisture, NDVI products | Account + token | Free | https://urs.earthdata.nasa.gov/users/new | would be `EARTHDATA_TOKEN` | https://www.earthdata.nasa.gov/ | Raw granules need heavy processing. FIRMS and GIBS already expose the fire and imagery products. Needed later for real NDVI and soil moisture inputs. |
| api.nasa.gov (`NASA_API_KEY`) | APOD, EPIC and similar | Key | Free | https://api.nasa.gov/ | n/a | https://api.nasa.gov/ | Offers nothing this project needs. Not required. |
| ECCC MSC GeoMet / Datamart | Official AQHI observations and forecasts, weather stations, FireWork smoke forecast | None | Free | none | none | https://eccc-msc.github.io/open-data/ | The right source for Canada's own AQHI and station data. Next integration to build; left out rather than shipped untested alongside a second index. |
| CWFIS Fire Weather Index grids | Official Canadian fire danger (FWI, drought code) | None | Free | none | none | https://cwfis.cfs.nrcan.gc.ca/datamart | Raster (WCS) data needing server-side sampling. Should replace or sit beside the prototype index. |
| National Fire Database / NBAC | Historical fire points and perimeters, monthly statistics | None | Free | none | none | https://cwfis.cfs.nrcan.gc.ca/datamart | Large downloads. Would replace the bundled, partly approximate history table. |
| Indigenous Services Canada "First Nations Location" | Public community point locations | None | Free (Open Government Licence – Canada) | none | none | https://open.canada.ca/data/en/dataset/b6567c5c-8339-4055-99fa-63f92114d9e4 | Would replace the hand-built demonstration list. Any use beyond public locations needs community consent. |
| OpenAQ, PurpleAir | Ground PM2.5 sensors | Key | Free tier / paid | https://openaq.org , https://www2.purpleair.com | would be `OPENAQ_API_KEY` | https://docs.openaq.org | Sparse in the North. Worth adding where sensors exist. |

## Reference statistics checked during development

| Claim | Status | Source |
|---|---|---|
| Indigenous people are about 5% of the population; about 42% of wildfire evacuation **events** occur in majority-Indigenous communities | Verified as a quoted research finding. It counts events, not evacuees. | Dr. Amy Cardinal Christianson, via Global News (Aug 2023) and Associated Press (Jul 2023); Canadian Wildland Fire Evacuation Database, 1980–2021. Also cited by the Public Health Agency of Canada. |
| 16 communities evacuated five or more times, 1980–2021; all but two were First Nations reserves | Verified | Associated Press, Jul 2023 |
| 2025: 6,125 fires, about 8.9 Mha | Verified | CWFIS National Situation Report, Nov 2025 |
| 2023: about 17.2 Mha (agency reports) | Verified | CIFFC, via The Narwhal |
| 2024: about 5.3 Mha; 2015: 3.9 Mha | Verified | The Weather Network; NRCan "Forest fires in Canada 2015" |
| July 2026 evacuations of Whitesand, Collins, Gull Bay, Lac des Mille Lacs and Lac La Croix First Nations; evacuees in Thunder Bay | Verified | The Canadian Press / CP24 / CTV, Jul 2026 |
| Other annual totals, fire counts, historic fire sizes, community coordinates and older evacuation dates | **Not verified.** Marked approximate in the app | to check against NFDB, ISC and local sources |

// One dictionary for every "what is this?" on screen. Each entry: what we show, where it comes from, how to read it.
// Texts follow the code: shared/risk.ts, shared/signals.ts, shared/stats.ts, shared/aqi.ts, shared/horizon.ts,
// server/services.ts, server/grid.ts and server/data/*. Change the code, change the text here.

export interface Explain { title: string; what: string; source: string; read: string }

export const EXPLAIN: Record<string, Explain> = {
  // Risk index
  riskIndex: {
    title: 'Risk index',
    what: 'A 0–100 score of how dry, hot, windy and fire-active conditions are.',
    source: 'Our formula: 100 × weighted sub-scores (humidity 18%, 7-day rain 16%, wind 14%, heat 12%, detections within 100 km 12%, vapour pressure deficit 10%, soil moisture 10%, regional history 8%); × 0.2 under snow or frost.',
    read: 'Higher means more fire-prone. A relative index, not a probability; not yet validated against fire records.',
  },
  'level.Low': { title: 'Low', what: 'Risk index below 25.', source: 'Level bands of our risk index.', read: 'Conditions do not favour fire.' },
  'level.Moderate': { title: 'Moderate', what: 'Risk index 25 to 49.', source: 'Level bands of our risk index.', read: 'Some dryness or heat; worth watching.' },
  'level.High': { title: 'High', what: 'Risk index 50 to 74.', source: 'Level bands of our risk index.', read: 'Several conditions line up for fire.' },
  'level.Critical': { title: 'Critical', what: 'Risk index 75 or more.', source: 'Level bands of our risk index.', read: 'Most conditions line up for fire.' },
  riskZone: {
    title: 'Risk zone',
    what: 'The risk index for one map grid cell on the selected day.',
    source: 'Same formula as the risk index, per cell, from Open-Meteo weather and satellite detections.',
    read: 'Colour is the level: green Low, yellow Moderate, orange High, red Critical.',
  },
  regionScore: {
    title: 'Region score',
    what: 'The risk index at the region’s centre for the selected day.',
    source: 'Taken from the nearest risk-zone cell; the region’s own score when zones are unavailable.',
    read: '0–100. Click to open that region.',
  },
  predictedDay: {
    title: 'Predicted day',
    what: 'A day ahead of today, scored from forecast weather.',
    source: 'Open-Meteo weather forecast fed into our risk index.',
    read: 'Forecasts are less certain the further ahead; confidence is Medium at best.',
  },
  todayDay: {
    title: 'Today',
    what: 'Today’s risk index.',
    source: 'Open-Meteo current model analysis plus satellite detections from the last 24 hours.',
    read: 'The reference point for past and predicted days.',
  },
  pastDay: {
    title: 'Past day',
    what: 'The risk index on an earlier day, from that day’s weather.',
    source: 'Open-Meteo model analysis for that day.',
    read: 'Shows how conditions built up to today.',
  },
  horizon: {
    title: 'Forecast horizon',
    what: 'How many days ahead of today the risk and air views look: 1, 3, 7 or 14.',
    source: 'Open-Meteo forecasts: up to 14 days for weather, 6 days for air quality.',
    read: 'Longer horizons see further but are less certain.',
  },
  confidence: {
    title: 'Confidence',
    what: 'How much to trust the score, from the quality of its inputs.',
    source: 'Low when inputs are simulated or 3+ of 8 are missing; Medium when forecast or any are missing; High otherwise.',
    read: 'A rule of thumb, not a statistical measure. The model itself is unvalidated.',
  },
  crewsAction: {
    title: 'Pre-position crews',
    what: 'The day to have crews in place, ahead of the first forecast day that reaches a higher level than today.',
    source: 'Our rule on the forecast risk index: the day before that rise.',
    read: 'A suggested lead time, not an operational order.',
  },

  // Fires and detections
  activeFire: {
    title: 'Active fire',
    what: 'A wildfire a fire agency reports as active.',
    source: 'CWFIS national active fires, updated daily by provincial, territorial and Parks Canada agencies.',
    read: 'One dot per reported fire. Size, stage and date are from the agency’s latest report.',
  },
  'fireStage.OC': { title: 'Out of control', what: 'Stage of control OC.', source: 'Reported by the fire agency (CWFIS).', read: 'The fire is still spreading or not contained.' },
  'fireStage.BH': { title: 'Being held', what: 'Stage of control BH.', source: 'Reported by the fire agency (CWFIS).', read: 'Not expected to spread past its edges under current conditions.' },
  'fireStage.UC': { title: 'Under control', what: 'Stage of control UC.', source: 'Reported by the fire agency (CWFIS).', read: 'Contained; no further spread expected.' },
  'fireStage.EX': { title: 'Out', what: 'Stage of control EX.', source: 'Reported by the fire agency (CWFIS).', read: 'The fire is extinguished.' },
  hotspot: {
    title: 'Satellite detection',
    what: 'A satellite pixel hot enough to indicate fire.',
    source: 'NASA FIRMS (VIIRS); CWFIS 24-hour hotspots when no FIRMS key is set.',
    read: 'Not every detection is a wildfire. Larger, redder dots mean more radiative power (red above 60 MW).',
  },
  frp: {
    title: 'Fire radiative power',
    what: 'Heat given off by the detected fire, in megawatts (MW).',
    source: 'Measured by the satellite sensor, reported with each detection.',
    read: 'A proxy for intensity: higher means a hotter, more active fire.',
  },
  historicFire: {
    title: 'Historic large fire',
    what: 'A well-known large fire from past seasons, for context.',
    source: 'Hand-picked list; locations and sizes are approximate.',
    read: 'Dashed circle, larger for bigger burned area. Not a current fire.',
  },

  // Communities
  community: {
    title: 'Community',
    what: 'The general location of a First Nation or Métis Settlement.',
    source: 'A small demonstration list of publicly known, rounded locations (typically within 10–20 km).',
    read: 'Distances to fires are proximity only, not an assessment of danger.',
  },
  'community.firstNation': {
    title: 'First Nation',
    what: 'The general location of a First Nation’s main community.',
    source: 'A small demonstration list of publicly known, rounded locations (typically within 10–20 km).',
    read: 'Distances to fires are proximity only, not an assessment of danger.',
  },
  'community.metis': {
    title: 'Métis Settlement',
    what: 'The general location of a Métis Settlement.',
    source: 'A small demonstration list of publicly known, rounded locations (typically within 10–20 km).',
    read: 'Distances to fires are proximity only, not an assessment of danger.',
  },

  // NASA imagery
  nasaTrueColour: {
    title: 'True colour',
    what: 'A satellite photo of the ground as the eye would see it.',
    source: 'NASA GIBS, MODIS Terra corrected reflectance.',
    read: 'Smoke is grey or brown haze; cloud is bright white.',
  },
  nasaThermal: {
    title: 'Thermal anomalies',
    what: 'Pixels hot enough to indicate fire on the chosen date.',
    source: 'NASA GIBS, VIIRS NOAA-20 thermal anomalies at 375 m.',
    read: 'Each coloured speck is a heat detection; clusters show active fire fronts.',
  },
  nasaAerosol: {
    title: 'Aerosol (smoke)',
    what: 'Aerosol optical depth: how much smoke or haze is in the air column.',
    source: 'NASA GIBS, MODIS combined value-added AOD.',
    read: 'Stronger colour means more smoke or haze overhead, not necessarily at ground level.',
  },

  // Early warning signs (shared/signals.ts). Thresholds are team assumptions, not validated.
  'sign.heat': { title: 'Heat building', what: 'Today’s high against a week ago.', source: 'Open-Meteo daily maximum temperature.', read: 'Active when the daily maximum is 5 °C or more above where it was a week ago.' },
  'sign.humidity': { title: 'Air drying out', what: 'Today’s lowest relative humidity.', source: 'Open-Meteo daily minimum humidity.', read: 'Active when the day’s lowest humidity is 35% or below.' },
  'sign.dry': { title: 'No soaking rain', what: 'Days in a row without wetting rain.', source: 'Open-Meteo daily rain.', read: 'Active after 3 or more days in a row without 2.5 mm or more of rain in a day.' },
  'sign.wind': { title: 'Strong wind ahead', what: 'The peak daily wind today and in the next 3 days.', source: 'Open-Meteo daily maximum wind.', read: 'Active when the daily maximum wind reaches 30 km/h.' },
  'sign.fire': { title: 'Fire detected nearby', what: 'Satellite heat detections within 100 km.', source: 'NASA FIRMS or CWFIS hotspots, last 24 hours.', read: 'Active when there is any detection within 100 km.' },
  'sign.smoke': { title: 'Smoke thickening', what: 'Fine-particle (PM2.5) level over the last 24 hours against the 24 before.', source: 'Open-Meteo air quality (CAMS model).', read: 'Active when 24-hour PM2.5 is at least 15 µg/m³ and 20% or more above the previous 24 hours.' },
  'sign.outlook': { title: 'Risk outlook', what: 'Where the risk index is heading in the forecast.', source: 'Our risk index on forecast weather.', read: 'Active when the 72-hour forecast reaches Critical (75+) or climbs 10 points or more above today.' },

  // Trend statistics (shared/stats.ts)
  mannKendall: {
    title: 'Mann–Kendall test',
    what: 'A check for a steady rise or fall in the risk index over the days shown.',
    source: 'Non-parametric trend test on the risk timeline (past, today and forecast).',
    read: 'Says rising or falling only when p < 0.05; otherwise no clear trend. Few days means low power.',
  },
  linearTrend: {
    title: 'Linear trend',
    what: 'A straight best-fit line through past and today’s risk scores.',
    source: 'Least-squares fit with a two-sided t-test on the slope.',
    read: 'Slope is points per day; the p-value says how likely it is to be chance.',
  },
  trendBand: {
    title: '95% band',
    what: 'The range the fitted trend line could plausibly take, extended into the forecast days.',
    source: '95% confidence band for the fitted mean of the linear trend.',
    read: 'Uncertainty in the line, not in single days. It widens away from the data.',
  },
  tempAnomaly: {
    title: 'Temperature anomaly',
    what: 'Today’s high minus the long-term average high for this month.',
    source: 'Open-Meteo daily maximum against NASA POWER monthly climatology.',
    read: 'Positive is hotter than normal; 3 °C or more is highlighted.',
  },
  humidityTrend: {
    title: 'Humidity trend',
    what: 'The straight-line trend in daily lowest humidity over the days shown.',
    source: 'Least-squares fit on Open-Meteo daily minimum humidity.',
    read: 'Falling means the air is drying out.',
  },

  // Air quality (shared/aqi.ts)
  aqi: {
    title: 'US AQI',
    what: 'The US EPA Air Quality Index, 0–500.',
    source: 'Open-Meteo air quality (CAMS global model), about 40 km resolution; not ground monitors.',
    read: 'Good ≤50, Moderate ≤100, Unhealthy for sensitive groups ≤150, Unhealthy ≤200, Very unhealthy ≤300, Hazardous above. Not Canada’s AQHI.',
  },
  pm25: {
    title: 'PM2.5',
    what: 'Fine particles 2.5 µm or smaller, in µg/m³; the main harm in wildfire smoke.',
    source: 'Open-Meteo air quality (CAMS global model), modelled not measured.',
    read: 'US EPA 24-hour scale: 9 or less is Good, up to 35.4 Moderate, above 55.4 Unhealthy.',
  },
  pm10: {
    title: 'PM10',
    what: 'Particles 10 µm or smaller, in µg/m³, including dust and coarse smoke.',
    source: 'Open-Meteo air quality (CAMS global model), modelled not measured.',
    read: 'Higher means more particles in the air.',
  },
  aod: {
    title: 'Aerosol optical depth',
    what: 'How much smoke or haze is in the whole air column (no units).',
    source: 'Open-Meteo air quality (CAMS global model).',
    read: 'Higher means more smoke or haze overhead, not necessarily at ground level.',
  },

  // Data kinds (KIND in src/components/ui.tsx)
  'kind.observed': { title: 'Observed', what: 'Measured by satellites or reported by fire agencies.', source: 'NASA FIRMS, CWFIS and NASA GIBS.', read: 'Real data about what has happened.' },
  'kind.historical': { title: 'Historical', what: 'Past records and long-term averages.', source: 'NASA POWER climatology and past records.', read: 'Context for comparing today with normal.' },
  'kind.forecast': { title: 'Forecast', what: 'Predicted by weather or air quality models.', source: 'Open-Meteo forecasts.', read: 'Expected, not yet happened; less certain further ahead.' },
  'kind.model': { title: 'Model estimate', what: 'Calculated by a model, including our risk index.', source: 'Open-Meteo models and our risk formula.', read: 'An estimate, not a measurement.' },
  'kind.simulated': { title: 'Simulated', what: 'Invented for demonstration; not real.', source: 'Generated by our server for the demo scenario.', read: 'Do not use for decisions.' },
  'kind.reference': { title: 'Reference', what: 'Static reference information.', source: 'Fixed lists kept in the app, such as regions and communities.', read: 'Background, not live data.' },
  simulatedScenario: {
    title: 'Simulated scenario',
    what: 'An invented fire-season situation used to demonstrate the app.',
    source: 'Generated by our server; no real observations.',
    read: 'Every fire, detection, weather and air value in this mode is made up.',
  },
}

/** Look up an entry, or null when the key is unknown. */
export const explain = (k: string): Explain | null => EXPLAIN[k] ?? null

/** Fire stage code spelled out, e.g. "OC" -> "Out of control". Unknown codes are passed through. */
export const stageLabel = (code: string | null | undefined): string => (code && EXPLAIN[`fireStage.${code}`]?.title) || code || 'Not reported'

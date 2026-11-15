// One dictionary for every "what is this?" on screen, written in the voice guide (docs/plans/2026-11-14-community-hub.md).
// Each entry: a title, a body of one or two short everyday sentences (what it is and how to read it), and an optional
// one-line detail for experts (thresholds, method, source names).
// Texts follow the code: shared/risk.ts, shared/signals.ts, shared/stats.ts, shared/aqi.ts, shared/horizon.ts,
// server/services.ts, server/grid.ts and server/data/*. Change the code, change the text here.

export interface Explain { title: string; body: string; detail?: string }

const NOT_OFFICIAL = 'Not an official fire danger rating.'
const PLACES = 'A small demonstration list of publicly known, rounded locations (typically within 10–20 km).'

export const EXPLAIN: Record<string, Explain> = {
  // Fire risk (shared/risk.ts)
  riskIndex: {
    title: 'Fire risk',
    body: 'Our estimate of how easily a fire could start and spread here, from 0 to 100. It weighs how dry, hot and windy it is, recent rain, and fire already nearby.',
    detail: 'Weighted score: humidity 18%, 7-day rain 16%, wind 14%, heat 12%, satellite heat within 100 km 12%, plant dryness (vapour pressure deficit) 10%, ground dryness 10%, regional history 8%; cut to a fifth under snow or frost. Not a chance of fire and not yet validated. ' + NOT_OFFICIAL,
  },
  'level.Low': {
    title: 'Low fire risk',
    body: 'Conditions are not helping fires start or spread much right now.',
    detail: `Our estimate, score below 25 out of 100. ${NOT_OFFICIAL}`,
  },
  'level.Moderate': {
    title: 'Medium fire risk',
    body: 'Some things that help fires start, like dry air or heat, are showing up. It is worth keeping an eye on.',
    detail: `Our estimate, score 25–49 out of 100. ${NOT_OFFICIAL}`,
  },
  'level.High': {
    title: 'High fire risk',
    body: 'Several things that help fires start and spread are happening at once. Stay alert and get ready.',
    detail: `Our estimate, score 50–74 out of 100. ${NOT_OFFICIAL}`,
  },
  'level.Critical': {
    title: 'Very high fire risk',
    body: 'Most things that help fires start and spread are happening at once. This is our most serious level, so check your province’s official fire danger rating too.',
    detail: `Our estimate, score 75 or more out of 100. ${NOT_OFFICIAL}`,
  },
  riskZone: {
    title: 'Fire risk on the map',
    body: 'Each coloured square is our fire risk estimate for that patch of land on the day you picked. Green is low, yellow medium, orange high and red very high.',
    detail: 'One grid cell, same formula as the fire risk score, from Open-Meteo weather and satellite heat detections.',
  },
  regionScore: {
    title: 'Fire risk for this area',
    body: 'The number is our fire risk estimate, out of 100, at the centre of this area on the day you picked. Tap it to open that area.',
    detail: 'Taken from the nearest map square; the area’s own score when the squares are not available.',
  },
  predictedDay: {
    title: 'Days ahead',
    body: 'Fire risk expected on a day still to come, worked out from the weather forecast. The further ahead, the less sure we can be.',
    detail: 'Open-Meteo forecast weather fed into our fire risk formula; confidence is Medium at best.',
  },
  todayDay: {
    title: 'Today',
    body: 'Fire risk today, from today’s weather and any heat satellites spotted in the last day. Past and expected days are compared with this one.',
    detail: 'Open-Meteo current model analysis plus satellite heat detections from the last 24 hours.',
  },
  pastDay: {
    title: 'Past days',
    body: 'Fire risk on earlier days, worked out from each day’s weather. It shows how conditions built up to today.',
    detail: 'Open-Meteo model analysis for each day.',
  },
  horizon: {
    title: 'Look ahead',
    body: 'Choose how far ahead to look: 1 day, 3 days, 1 week or 2 weeks. Looking further shows more, but we are less sure about it.',
    detail: 'Open-Meteo forecasts: up to 14 days for weather, 6 days for smoke in the air.',
  },
  confidence: {
    title: 'How sure we are',
    body: 'How much you can trust an estimate, based on how complete and how fresh the data behind it is. Days ahead are less sure than today.',
    detail: 'Low when inputs are simulated or 3 or more of 8 are missing; Medium with forecast inputs or any missing; High otherwise. A rule of thumb; the model itself is not validated.',
  },
  crewsAction: {
    title: 'Ask for help early',
    body: 'The day to ask for firefighters and equipment, so they can be in place before the first day fire risk is expected to get worse. It is a suggestion; your community decides.',
    detail: 'Our rule: the day before the first forecast day at a higher level than today. A suggested lead time, not an operational order.',
  },

  // Fires and heat spotted by satellites
  activeFire: {
    title: 'Wildfire reported by fire crews',
    body: 'A wildfire that a provincial, territorial or Parks Canada fire agency says is burning now. Its size, status and date come from their latest report.',
    detail: 'Canadian Wildland Fire Information System (CWFIS) national active fires, updated daily.',
  },
  // Titles here are the bare status words: stageLabel() below returns them.
  'fireStage.OC': { title: 'Out of control', body: 'The fire is still spreading and is not contained.', detail: 'Stage of control OC, reported by the fire agency through CWFIS.' },
  'fireStage.BH': { title: 'Being held', body: 'The fire is not expected to spread past its edges in the current weather.', detail: 'Stage of control BH, reported by the fire agency through CWFIS.' },
  'fireStage.UC': { title: 'Under control', body: 'The fire is contained and is not expected to spread any further.', detail: 'Stage of control UC, reported by the fire agency through CWFIS.' },
  'fireStage.EX': { title: 'Out', body: 'The fire is out.', detail: 'Stage of control EX, reported by the fire agency through CWFIS.' },
  hotspot: {
    title: 'Heat spotted by satellites',
    body: 'A spot on the ground hot enough that it may be a fire, seen from space. Not every spot is a wildfire; bigger, redder dots give off more heat.',
    detail: 'NASA FIRMS (VIIRS), or CWFIS 24-hour hotspots when no FIRMS key is set. Red above 60 MW fire radiative power.',
  },
  frp: {
    title: 'Heat given off',
    body: 'How much heat the fire is giving off, measured by the satellite. Higher means a hotter, more active fire.',
    detail: 'Fire radiative power in megawatts (MW), reported with each satellite detection.',
  },
  historicFire: {
    title: 'Large fire from past years',
    body: 'A well-known big fire from an earlier season, shown for context. It is not burning now.',
    detail: 'Hand-picked list; locations and sizes are approximate. Dashed circle, larger for more burned area.',
  },

  // Communities
  community: {
    title: 'Community',
    body: 'The general location of a First Nation or Métis Settlement. Distance to a fire tells you how close it is, not how dangerous it is.',
    detail: PLACES,
  },
  'community.firstNation': {
    title: 'First Nation',
    body: 'The general location of a First Nation’s main community. Distance to a fire tells you how close it is, not how dangerous it is.',
    detail: PLACES,
  },
  'community.metis': {
    title: 'Métis Settlement',
    body: 'The general location of a Métis Settlement. Distance to a fire tells you how close it is, not how dangerous it is.',
    detail: PLACES,
  },

  // NASA imagery
  nasaTrueColour: {
    title: 'NASA satellite photo',
    body: 'A photo of the ground from space, as your eye would see it. Smoke looks like grey or brown haze; clouds are bright white.',
    detail: 'NASA GIBS, MODIS Terra corrected reflectance.',
  },
  nasaThermal: {
    title: 'Heat seen by NASA satellites',
    body: 'Spots hot enough to be fire on the chosen date. Each coloured speck is a hot spot; clusters show where fire is burning.',
    detail: 'NASA GIBS, VIIRS NOAA-20 thermal anomalies at 375 m.',
  },
  nasaAerosol: {
    title: 'Smoke seen from space',
    body: 'How much smoke or haze is in the air above the ground. Stronger colour means more smoke overhead, though not always at ground level.',
    detail: 'NASA GIBS, MODIS combined value-added aerosol optical depth.',
  },

  // Warning signs (shared/signals.ts). Thresholds are team assumptions, not validated.
  'sign.heat': {
    title: 'Heat building',
    body: 'Today’s high is much warmer than a week ago. Heat dries out plants and helps fires start.',
    detail: 'Shows when the daily maximum is 5 °C or more above where it was a week ago. Open-Meteo daily maximum temperature.',
  },
  'sign.humidity': {
    title: 'Air drying out',
    body: 'The air is very dry today. Dry air dries out grass, needles and twigs within hours.',
    detail: 'Shows when the day’s lowest relative humidity is 35% or below. Open-Meteo daily minimum humidity.',
  },
  'sign.dry': {
    title: 'No soaking rain',
    body: 'There has not been enough rain to wet the forest for several days in a row, so plants and the ground keep drying out.',
    detail: 'Shows after 3 or more days in a row with less than 2.5 mm of rain a day. Open-Meteo daily rain.',
  },
  'sign.wind': {
    title: 'Strong wind ahead',
    body: 'Strong wind is expected today or in the days ahead you are looking at. Wind makes fires spread faster.',
    detail: 'Shows when the daily maximum wind reaches 30 km/h today or on any forecast day in the chosen look-ahead. Open-Meteo daily maximum wind.',
  },
  'sign.fire': {
    title: 'Heat spotted nearby',
    body: 'Satellites spotted heat that may be fire within 100 km of here in the last day. Fire already on the land can spread.',
    detail: 'Shows when there is any detection within 100 km. NASA FIRMS or CWFIS hotspots, last 24 hours.',
  },
  'sign.smoke': {
    title: 'Smoke getting thicker',
    body: 'There is clearly more smoke in the air than the day before. Smoke can mean fire is burning upwind.',
    detail: 'Shows when 24-hour PM2.5 is at least 15 µg/m³ and 20% or more above the previous 24 hours. Open-Meteo air quality (CAMS model).',
  },
  'sign.outlook': {
    title: 'Fire risk rising',
    body: 'Fire risk is expected to reach very high, or to climb well above today, in the days ahead you are looking at.',
    detail: 'Shows when any forecast day in the chosen look-ahead reaches 75 or more, or is 10 points or more above today. Our fire risk score on forecast weather.',
  },

  // Trend statistics (shared/stats.ts)
  mannKendall: {
    title: 'Is it really changing?',
    body: 'A check of whether fire risk is going steadily up or down over these days, or just bouncing around by chance. With only a few days it often cannot tell.',
    detail: 'Mann–Kendall trend test on the past, today and forecast scores; says rising or falling only when p < 0.05.',
  },
  linearTrend: {
    title: 'How fast it is changing',
    body: 'A straight line through the past days and today, showing how many points fire risk goes up or down each day on average.',
    detail: 'Least-squares fit with a two-sided t-test on the slope; the p-value says how likely a slope like this is by chance.',
  },
  trendBand: {
    title: 'General direction',
    body: 'The dotted line is the general direction of fire risk, and the shaded area is where that line could reasonably be. It gets wider further from the data.',
    detail: '95% confidence band for the fitted mean of the linear trend: uncertainty in the line, not in single days.',
  },
  tempAnomaly: {
    title: 'Hotter or cooler than normal',
    body: 'How much warmer or cooler today’s high is than a normal high for this month here. 3 °C or more above normal is highlighted.',
    detail: 'Open-Meteo daily maximum against the NASA POWER monthly average of daily maximum temperature.',
  },
  humidityTrend: {
    title: 'Is the air getting drier?',
    body: 'Whether the driest part of each day is getting drier or damper over these days. Falling means the air is drying out.',
    detail: 'Least-squares trend in Open-Meteo daily minimum relative humidity.',
  },

  // Smoke and air quality (shared/aqi.ts)
  aqi: {
    title: 'Air quality',
    body: 'A score for how healthy the air is to breathe: up to 50 is good. Above 100, elders, children, pregnant people and anyone with heart or lung conditions may want to limit hard activity outside; above 150, everyone may feel it.',
    detail: 'US EPA Air Quality Index (0–500) from Open-Meteo air quality (CAMS global model, about 40 km), not ground monitors. Not Canada’s AQHI.',
  },
  pm25: {
    title: 'Fine smoke in the air',
    body: 'Tiny bits of smoke small enough to get deep into your lungs. This is the main harm in wildfire smoke; lower is better.',
    detail: 'PM2.5 in µg/m³, modelled by CAMS via Open-Meteo, not measured. US EPA 24-hour scale: 9 or less Good, up to 35.4 Moderate, up to 55.4 Unhealthy for sensitive groups, above that Unhealthy.',
  },
  pm10: {
    title: 'Dust and smoke particles',
    body: 'Small bits of dust and smoke in the air. Higher means more particles to breathe in.',
    detail: 'PM10 in µg/m³, modelled by CAMS via Open-Meteo, not measured.',
  },
  aod: {
    title: 'Haze overhead',
    body: 'How much smoke or haze is in the whole sky above, not just at ground level. Higher means more.',
    detail: 'Aerosol optical depth (no units), Open-Meteo air quality (CAMS global model).',
  },

  // Data kinds (KIND in src/components/ui.tsx)
  'kind.observed': { title: 'Measured', body: 'Seen by satellites or reported by fire agencies: real data about what has already happened.', detail: 'NASA FIRMS, CWFIS and NASA GIBS.' },
  'kind.historical': { title: 'Past records', body: 'Records from past years and long-term averages, so you can compare today with normal.', detail: 'NASA POWER climatology and past records.' },
  'kind.forecast': { title: 'Forecast', body: 'What weather and smoke models expect to happen. It has not happened yet, and it is less certain further ahead.', detail: 'Open-Meteo forecasts.' },
  'kind.model': { title: 'Estimate', body: 'Worked out by a computer model, including our fire risk score. An estimate, not a measurement.', detail: 'Open-Meteo models and our fire risk formula.' },
  'kind.simulated': { title: 'Example scenario', body: 'Made up to show how the app works. It is not real, so please do not use it for decisions.', detail: 'Generated by our server for the demo.' },
  'kind.reference': { title: 'Reference', body: 'Fixed background information, such as the list of areas and communities. Not live data.', detail: 'Lists kept in the app.' },
  simulatedScenario: {
    title: 'Example scenario, not real conditions',
    body: 'A made-up fire season used to show how the app works. Every fire, weather and smoke value you see in this mode is invented.',
    detail: 'Generated by our server; no real observations. Switch to Live data at the top of the page for real conditions.',
  },
}

/** Look up an entry, or null when the key is unknown. */
export const explain = (k: string): Explain | null => EXPLAIN[k] ?? null

/** Fire stage code spelled out, e.g. "OC" -> "Out of control". Unknown codes are passed through. */
export const stageLabel = (code: string | null | undefined): string => (code && EXPLAIN[`fireStage.${code}`]?.title) || code || 'Not reported'

/** Fire stage as it reads mid-sentence: "being held". Unknown codes are passed through unchanged. */
export const stageWords = (code: string | null | undefined): string => {
  const t = code ? EXPLAIN[`fireStage.${code}`]?.title : undefined
  return t ? t.toLowerCase() : code || 'not reported'
}

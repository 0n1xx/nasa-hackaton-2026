// Types shared by the backend (server/) and the frontend (src/).

export type Mode = 'live' | 'sim'

/** What kind of information a number is. Shown as a badge next to every dataset. */
export type DataKind = 'observed' | 'historical' | 'forecast' | 'model' | 'simulated' | 'reference'

export interface SourceMeta {
  id: string
  label: string        // e.g. "NASA FIRMS (VIIRS NOAA-20)"
  kind: DataKind
  fetchedAt: string    // ISO time our server fetched or generated it
  url?: string
  note?: string
}

export interface Envelope<T> { data: T; sources: SourceMeta[] }

export interface Region {
  id: string
  name: string
  short: string
  province: string
  lat: number
  lon: number
  zoom: number
  /** 0–1 relative baseline of historical fire activity. An ASSUMPTION, see README, 'Risk model' */
  historyIndex: number
}

export interface ActiveFire {
  id: string
  name: string
  agency: string
  lat: number
  lon: number
  hectares: number
  startDate: string | null
  /** OC out of control, BH being held, UC under control, EX out, other agency codes passed through */
  stage: string
}

export interface Hotspot {
  lat: number
  lon: number
  /** Fire radiative power, MW — a proxy for intensity. null when the source omits it */
  frp: number | null
  time: string | null
  sensor: string
}

export interface HistoricFire {
  id: string; name: string; year: number; lat: number; lon: number; hectares: number; note: string
}

export interface DayWeather {
  date: string           // YYYY-MM-DD local
  kind: 'historical' | 'forecast'
  tMax: number | null    // °C
  rhMin: number | null   // %
  windMax: number | null // km/h
  windDir: number | null // degrees, direction wind comes FROM
  precip: number | null  // mm
  vpdMax: number | null  // kPa
  soil: number | null    // m³/m³, 0–1 cm layer
  snow: number | null    // m
}

export interface CurrentWeather {
  time: string
  temp: number | null; rh: number | null; wind: number | null; windDir: number | null; precip: number | null
}

export interface RiskFactor {
  key: string
  label: string
  value: number | null
  unit: string
  /** 0–1 dryness/hazard sub-score, null when the input is missing */
  score: number | null
  weight: number
  /** points (0–100 scale) this factor adds to the total */
  contribution: number
  explain: string
}

export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Critical'

export interface RiskResult {
  score: number          // 0–100 relative index, NOT a probability
  level: RiskLevel
  uncertainty: number    // ± points, heuristic
  confidence: 'High' | 'Medium' | 'Low'
  confidenceWhy: string
  snowGate: boolean
  factors: RiskFactor[]
}

export interface RiskDay {
  date: string; kind: 'historical' | 'forecast' | 'today'; score: number; level: RiskLevel
  /** From computeRisk for that day: depends on data quality (forecast inputs give Medium and a wider band), not on lead time. */
  confidence?: RiskResult['confidence']
  /** ± points around score, heuristic (see RiskResult.uncertainty) */
  uncertainty?: number
}

export interface RegionRisk {
  region: Region
  current: CurrentWeather
  today: RiskResult
  timeline: RiskDay[]
  days: DayWeather[]
  hotspots100km: number
  /** NASA POWER monthly climatology for the point, when available */
  climate: ClimateNormals | null
  /** Forecast days ahead of today included in timeline (the ?days= value; see shared/horizon.ts) */
  horizon: number
}

export interface ClimateNormals { tempC: number[]; precipMmDay: number[]; rh: number[] } // 12 months, Jan..Dec

export interface AirPoint { time: string; pm25: number | null; pm10: number | null; kind: 'model' | 'forecast' }

export interface AirNow { pm25: number | null; pm10: number | null; usAqi: number | null; aod: number | null; time: string }

export interface RegionAir { region: Region; now: AirNow; hourly: AirPoint[]; daily: { date: string; pm25: number; kind: 'model' | 'forecast' }[] }

export interface RegionSummary {
  region: Region
  risk: { score: number; level: RiskLevel; confidence: string; trend: number } // trend: score change vs 3 days ago
  air: AirNow
  activeFires250km: number
  hotspots100km: number
}

export interface Community {
  id: string
  name: string
  kind: 'First Nation' | 'Métis Settlement'
  province: string
  regionId: string | null
  lat: number
  lon: number
  /** Publicly reported wildfire events; not a complete record */
  reported: string[]
}

export interface CommunityExposure extends Community {
  nearestFireKm: number | null
  nearestFireName: string | null
  fires100km: number
  hotspots100km: number
  pm25: number | null
  usAqi: number | null
}

export interface YearStat { year: number; fires: number; areaMha: number; verified: boolean }

export interface HistoryData {
  years: YearStat[]
  seasonal: { month: string; share: number }[]
  historicFires: HistoricFire[]
  evacuationFacts: { text: string; source: string; url: string }[]
  notes: string[]
}

export interface IntegrationStatus {
  id: string; name: string; needsKey: boolean; configured: boolean
  lastOk: string | null; lastError: string | null; purpose: string
}

export interface StatusData { defaultMode: Mode; integrations: IntegrationStatus[]; serverTime: string }

export interface AirTrend { regionId: string; short: string; last24: number | null; prev24: number | null; change: number | null }

/** Risk index computed on a regular lat/lon grid, one score per day. Served by GET /api/risk-grid. */
export interface RiskGrid {
  /** Days in order: past days ('historical'), 'today', then 'forecast'. scores[] in each cell align with this. */
  days: { date: string; kind: 'historical' | 'today' | 'forecast' }[]
  /** Cell size in degrees; lat/lon of a cell are its centre. */
  cellLat: number
  cellLon: number
  cells: { lat: number; lon: number; scores: number[] }[]
  /** Forecast days ahead of today included in days (the ?days= value; see shared/horizon.ts) */
  horizon: number
}

// --- Long-term NASA POWER daily history (GET /api/climate-history/:id) ---

export interface ClimateMetricHistory {
  /** unit of the daily values (window stats) */
  unit: string
  /** unit of the fire-season annual values (differs for precip: season total in mm) */
  annualUnit: string
  label: string
  /** daily values inside the comparison window, pooled over all years */
  window: { mean: number; sd: number; /** percentiles 0..100 in steps of 1 (101 values) */ q: number[]; n: number }
  /** fire season (May 1–Sep 30) per year: mean of daily values (precip: season total) */
  annual: { year: number; value: number }[]
  trend: {
    mannKendall: { tau: number; pValue: number; trend: 'rising' | 'falling' | 'none' }
    /** Sen's slope of the annual values, per decade */
    senPerDecade: number
    /** Sen line value at the first annual point (line = senIntercept + senPerDecade / 10 × (year − firstYear)) */
    senIntercept: number
    /** OLS on the annual values; slope per year */
    linear: { slope: number; intercept: number; r2: number; pValue: number }
  }
}

export interface ClimateHistory {
  period: { startYear: number; endYear: number; years: number; days: number }
  window: { label: string; startMMDD: string; endMMDD: string; /** why this window was chosen */ note: string }
  metrics: { tMax: ClimateMetricHistory; rh: ClimateMetricHistory; precip: ClimateMetricHistory; wind: ClimateMetricHistory; soil: ClimateMetricHistory }
}

// --- One place, one number (GET /api/place/:communityId, GET /api/communities/search) ---
// Everything a community view, the assistant and the help request show for a place comes from
// one PlaceReport, computed at the community's own location.

/** Where a community entry comes from. 'manual': server/data/communities.ts (hand-checked, takes precedence).
 *  'isc': Indigenous Services Canada "First Nation Location" open data (OGL-Canada). */
export type CommunitySource = 'manual' | 'isc'

/** A community in the server's directory (search and /api/place). */
export interface DirectoryCommunity extends Community {
  source: CommunitySource
  /** ISC band number, when known */
  bandNumber: number | null
  /** Other names search should match, e.g. the ISC name of a hand-checked entry */
  aliases: string[]
}

/** One result of GET /api/communities/search?q= */
export interface CommunityMatch {
  id: string; name: string; kind: Community['kind']; province: string; regionId: string | null; source: CommunitySource
}

/** 8-point compass direction, from the community towards something (e.g. a fire). */
export type Compass8 = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

export interface PlaceFire {
  name: string; agency: string
  /** agency stage code: OC out of control, BH being held, UC under control, EX out */
  stage: string
  hectares: number
  /** great-circle distance from the community, rounded km */
  distanceKm: number
  /** direction from the community to the fire */
  bearing: Compass8
}

/** What the risk does from today to the end of the horizon. Computed by shared/outlook.ts riskOutlook(). */
export interface RiskOutlook {
  todayDate: string | null
  todayLevel: RiskLevel | null
  /** the highest day from today to the end of the horizon (the earliest one on a tie) */
  peakLevel: RiskLevel
  peakScore: number
  peakDate: string
  /** first forecast day whose level is above today's; null when none is */
  firstHigherLevelDate: string | null
  /** the day before firstHigherLevelDate (today when that is tomorrow); null when no higher level is expected */
  actByDate: string | null
}

/** 42-year NASA POWER context for the community's location. */
export interface PlaceHistory {
  /** NASA POWER grid cell the record comes from (0.5° × 0.625°, the native MERRA-2 grid; about 50 km across) */
  point: { lat: number; lon: number }
  period: ClimateHistory['period']
  window: ClimateHistory['window']
  /** today's daily high at the community (from the risk weather), °C */
  todayTMax: number | null
  /** 0–100: where today's high sits among all daily highs in the same calendar window since 1984 (percentileRank over tMax.window.q) */
  tMaxPercentile: number | null
  /** fire-season (1 May–30 Sep) average daily high: trend over the record */
  fireSeasonTMax: { senPerDecade: number; mannKendallP: number; tau: number; trend: 'rising' | 'falling' | 'none'; unit: string }
  /** the full daily-high record summary (window percentiles, annual series, trend fits) for charts */
  tMax: ClimateMetricHistory
}

export interface PlaceReport {
  community: Pick<DirectoryCommunity, 'id' | 'name' | 'kind' | 'province' | 'regionId' | 'lat' | 'lon' | 'source' | 'bandNumber' | 'reported'>
  /** The community's monitoring region (assigned, or the nearest within 600 km); null when none is near */
  region: Region | null
  /** forecast days ahead of today in risk.timeline (the ?days= value) */
  horizon: number
  /** Risk at the community's own location, from the same function as the map grid and region panel (server pointRisk) */
  risk: {
    todayDate: string
    today: RiskResult
    /** past days (4), today, then `horizon` forecast days, each with its own confidence and ± uncertainty */
    timeline: RiskDay[]
    /** satellite detections within 100 km, last 24 h; null when that source is down (the score then runs without it) */
    hotspots100km: number | null
    /** regional baseline used by the score: the nearest region within 600 km, else 0.5 */
    historyIndex: number
    current: CurrentWeather
    days: DayWeather[]
  }
  /** shared/signals.ts warningSigns() at this location */
  signs: WarningSign[]
  /** shared/signals.ts daysBuilding() */
  daysBuilding: number
  outlook: RiskOutlook
  /** Agency-reported fires. null when that source is unreachable (never read null as "no fires") */
  fires: { nearest: PlaceFire[]; within50km: number; within100km: number } | null
  /** Satellite heat detections, last 24 h. null when that source is unreachable */
  hotspots24h: { within50km: number; within100km: number } | null
  /** Smoke at the location. null when the air-quality source is unreachable */
  air: {
    now: AirNow
    /** highest daily-mean PM2.5 over the 3 local days after today (12+ forecast hours each), its US AQI and day; daily = those days */
    max3d: { pm25: number | null; usAqi: number | null; date: string | null; days: number; daily: { date: string; pm25: number }[] }
  } | null
  /** null while the NASA POWER record is still downloading (historyStatus 'loading': ask again in a few seconds) or when it failed */
  history: PlaceHistory | null
  historyStatus: 'ok' | 'loading' | 'unavailable'
}

// Type-only import at the end so the appended block stays self-contained (signals.ts imports types from this file).
import type { WarningSign } from './signals.ts'

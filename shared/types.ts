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

export interface RiskDay { date: string; kind: 'historical' | 'forecast' | 'today'; score: number; level: RiskLevel }

export interface RegionRisk {
  region: Region
  current: CurrentWeather
  today: RiskResult
  timeline: RiskDay[]
  days: DayWeather[]
  hotspots100km: number
  /** NASA POWER monthly climatology for the point, when available */
  climate: ClimateNormals | null
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
}

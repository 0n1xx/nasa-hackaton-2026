import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, CloudOff, Droplets, Flame, LineChart, Send, Thermometer, TrendingUp, Truck, Wind, type LucideIcon } from 'lucide-react'
import type { CommunityExposure, RegionAir, RegionRisk, RiskDay, RiskLevel } from '../../shared/types.ts'
import { LEVEL_COLORS, levelLabel } from '../../shared/risk.ts'
import { warningSigns, type SignKey, type WarningSign } from '../../shared/signals.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'
import TrendSheet from './TrendSheet.tsx'
import HorizonSelector, { horizonWords } from './HorizonSelector.tsx'
import { InfoDot, InfoPopover } from './ui.tsx'

const RANK: Record<RiskLevel, number> = { Low: 0, Moderate: 1, High: 2, Critical: 3 }
const EMBER = '#c24a17'

const weekday = (iso: string, style: 'short' | 'long') =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: style })
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000)
const num = (s: string) => Number.parseFloat((s.match(/[\d.]+/) ?? ['0'])[0])
/** Level word as it reads mid-sentence: "very high". */
const lower = (l: RiskLevel) => levelLabel(l).toLowerCase()

const prevDay = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** How long the forecast runs, as it reads after "for": "tomorrow" is handled by the caller. */
const span = (n: number) => (n === 7 ? 'a week' : n === 14 ? '2 weeks' : `${n} days`)

/**
 * "Very high expected tomorrow", "Expected to ease to medium by Tuesday", "Expected to stay high for 3 days".
 * prepBy: the day to ask for firefighters and equipment by, the day before the first day at a higher level than today.
 * Every line must stay on one line in the 312 px panel column (see the height budget in RiskPanel).
 */
function outlook(timeline: RiskDay[], level: RiskLevel): { text: string; rising: RiskLevel | null; prepBy: string | null } {
  const today = timeline.find((t) => t.kind === 'today') ?? timeline.filter((t) => t.kind !== 'forecast').at(-1)
  const ahead = timeline.filter((t) => t.kind === 'forecast')
  if (!ahead.length) return { text: 'No forecast available yet', rising: null, prepBy: null }
  const up = ahead.find((t) => RANK[t.level] > RANK[level])
  if (up) {
    const when = today && dayDiff(today.date, up.date) === 1 ? 'tomorrow' : `on ${weekday(up.date, 'long')}`
    const before = prevDay(up.date)
    const lead = today ? dayDiff(today.date, before) : null
    const prepBy = lead == null || lead <= 0 ? 'today' : lead === 1 ? 'tomorrow' : weekday(before, 'long')
    return { text: `${levelLabel(up.level)} expected ${when}`, rising: up.level, prepBy }
  }
  const down = ahead.find((t) => RANK[t.level] < RANK[level])
  if (down) return { text: `Expected to ease to ${lower(down.level)} by ${weekday(down.date, 'long')}`, rising: null, prepBy: null }
  return { text: ahead.length === 1 ? `Expected to stay ${lower(level)} tomorrow` : `Expected to stay ${lower(level)} for ${span(ahead.length)}`, rising: null, prepBy: null }
}

const SIGN_ICONS: Record<Exclude<SignKey, 'outlook'>, LucideIcon> = {
  heat: Thermometer, humidity: Droplets, dry: CloudOff, wind: Wind, fire: Flame, smoke: CloudOff,
}

/** One short line per active sign. Each must fit one line (about 38 characters at 14 px). */
function signText(s: WarningSign): string | null {
  switch (s.key) {
    case 'heat': return `${Math.round(num(s.value))} °C hotter than a week ago`
    case 'humidity': return `Very dry air (${Math.round(num(s.value))}% humidity)`
    case 'dry': return `${(s.value.match(/^\d+\+?/) ?? ['Several'])[0]} days without soaking rain`
    case 'wind': return `Strong wind ahead, up to ${Math.round(num(s.value))} km/h`
    case 'fire': { const n = Math.round(num(s.value)); return `${n} spot${n === 1 ? '' : 's'} of heat seen by satellites` }
    case 'smoke': return 'Smoke getting thicker'
    default: return null
  }
}

function shortName(name: string): string {
  const paren = name.match(/\(([^)]+)\)/)
  return (paren ? paren[1] : name).replace(/\s+First Nations?$/i, '').trim()
}

function SectionHead({ title, count, info }: { title: string; count?: string; info?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3 text-[13px] font-semibold text-[var(--color-mute)]">
      <h3 className="flex items-center gap-1.5">{title}{info && <InfoDot k={info} />}</h3>
      {count && <span className="shrink-0 font-medium tabular-nums">{count}</span>}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="mt-6" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-[52px] w-56" />
      <div className="skeleton mt-3 h-4 w-36" />
      <div className="skeleton mt-8 h-16 w-full" />
      <div className="skeleton mt-8 h-4 w-28" />
      <div className="mt-4 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-4 w-48" />)}</div>
    </div>
  )
}

function DayStrip({ timeline, horizon, onOpen }: { timeline: RiskDay[]; horizon: number; onOpen: () => void }) {
  const n = timeline.length
  const dense = n > 10
  const todayIdx = Math.max(0, timeline.findIndex((t) => t.kind === 'today'))
  const nFcst = timeline.filter((t) => t.kind === 'forecast').length
  const bracket = horizon === 1 ? 'Tomorrow' : horizon === 7 ? 'Next week' : `Next ${horizonWords(horizon)}`
  return (
    <div className="mt-3">
      {/* How far ahead to look. "Look ahead" itself explains the control on tap. */}
      <HorizonSelector compact label />
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Fire risk by day: ${timeline.map((t) => `${t.kind === 'today' ? 'today' : weekday(t.date, 'long')} ${levelLabel(t.level)}${t.kind === 'forecast' ? ' expected' : ''}`).join(', ')}. Open why we think this.`}
        className="group -mx-2 mt-1 block w-[calc(100%+1rem)] cursor-pointer rounded-lg px-2 pb-1.5 pt-1.5 text-left transition-colors hover:bg-black/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg)]"
      >
        {/* Bracket over the expected bars, so the strip says how far ahead it looks */}
        <div className={`flex ${dense ? 'gap-[3px]' : 'gap-1.5'}`} aria-hidden>
          <div style={{ flex: n - nFcst }} />
          <div className="relative h-[15px] border-t-2 border-edge" style={{ flex: Math.max(nFcst, 1) }}>
            <span className="absolute right-0 top-[3px] whitespace-nowrap text-[11px] font-semibold leading-none text-[var(--color-mute)]">{bracket}</span>
          </div>
        </div>
        <div className={`mt-1 flex items-end ${dense ? 'gap-[3px]' : 'gap-1.5'}`} aria-hidden>
          {timeline.map((t, i) => {
            const color = LEVEL_COLORS[t.level]
            const isToday = t.kind === 'today'
            const isPast = t.kind === 'historical'
            const showLabel = !dense || isToday || (i - todayIdx) % 2 === 0
            return (
              <div key={t.date} className="flex min-w-0 flex-1 flex-col items-center" title={`${isToday ? 'Today' : weekday(t.date, 'short')}: ${levelLabel(t.level)} (${t.score} out of 100)${t.kind === 'forecast' ? ', expected' : ''}`}>
                <div className="flex h-[40px] w-full items-end justify-center">
                  <div
                    className={dense ? 'rounded-[2px]' : 'rounded-[3px]'}
                    style={{
                      width: dense ? (isToday ? 10 : 6) : isToday ? 16 : 10,
                      height: Math.max(5, Math.round((t.score / 100) * 40)),
                      background: t.kind === 'forecast' ? `color-mix(in srgb, ${color} 55%, white)` : color,
                      borderTop: t.kind === 'forecast' ? `2px solid ${color}` : undefined,
                      opacity: isPast ? 0.55 : 1,
                    }}
                  />
                </div>
                <span className={`mt-1.5 whitespace-nowrap text-[11px] leading-none ${isToday ? 'font-semibold text-[var(--color-fg)]' : 'text-[var(--color-mute)]'}`}>
                  {showLabel ? (isToday ? 'Today' : weekday(t.date, 'short')) : ' '}
                </span>
              </div>
            )
          })}
        </div>
      </button>
      {/* Legend for the bars and the way into the trend sheet, on one row and outside the strip button so the popovers never nest inside it */}
      <div className="mt-0.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[11px] text-[var(--color-mute)]">
          <InfoPopover k="pastDay" className="gap-1">Past</InfoPopover>
          <InfoPopover k="todayDay" className="gap-1">Today</InfoPopover>
          <InfoPopover k="predictedDay" className="gap-1">Expected</InfoPopover>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="flex shrink-0 items-center gap-1 rounded text-[13px] font-semibold text-[#c24a17] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg)]"
        >
          <LineChart size={15} strokeWidth={2.25} aria-hidden />
          Why we think this
        </button>
      </div>
    </div>
  )
}

// Height budget at 1440×900 (aside 812 px tall), example scenario, Thunder Bay, 5 signs, 6 communities:
// switcher 23 + example line 20 + hero 64 + outlook 31 + ask-for-help 48 (two lines) + day strip 156
// + signs 193 + communities 131 + button 56 + padding 52 = about 775 px. Replace lines rather than add them.
export default function RiskPanel() {
  const { region, regions, setRegionId, mode, horizon } = useApp()
  const id = region?.id ?? null
  const risk = useApi<RegionRisk>(id ? `risk/${id}` : null)
  const air = useApi<RegionAir>(id ? `air/${id}?pastDays=7` : null)
  const comms = useApi<CommunityExposure[]>(id ? 'communities' : null)

  const [trendOpen, setTrendOpen] = useState(false)
  const closeTrend = useCallback(() => setTrendOpen(false), [])

  const r = risk.data
  const signs = r ? warningSigns(r, air.data) : []
  // The outlook sign is already the hero line, so the list and its count leave it out.
  const rows = signs
    .filter((s) => s.active && s.key !== 'outlook')
    .map((s) => ({ key: s.key as Exclude<SignKey, 'outlook'>, text: signText(s) }))
    .filter((s): s is { key: Exclude<SignKey, 'outlook'>; text: string } => !!s.text)

  const nearby = (comms.data ?? [])
    .filter((c) => c.regionId === id)
    .sort((a, b) => (a.nearestFireKm ?? Infinity) - (b.nearestFireKm ?? Infinity))
  const allFirstNations = nearby.every((c) => c.kind === 'First Nation')

  const out = r ? outlook(r.timeline, r.today.level) : null

  return (
    <div className="flex h-full min-h-full flex-col overflow-x-clip px-6 pb-6 pt-5 text-[var(--color-fg)]">
      {/* 1. Area switcher */}
      <div>
        <div className="relative inline-flex items-center gap-1.5 rounded-md has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-[var(--color-fg)]">
          <span className="text-[15px] font-semibold">{region?.short ?? region?.name ?? 'Area'}</span>
          <ChevronDown size={16} strokeWidth={2.25} className="text-[var(--color-mute)]" aria-hidden />
          <select
            aria-label="Choose an area"
            value={id ?? ''}
            onChange={(e) => setRegionId(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            style={{ border: 'none', background: 'transparent', padding: 0 }}
          >
            {regions.map((g) => <option key={g.id} value={g.id}>{g.short}</option>)}
          </select>
        </div>
        {mode === 'sim' && <p className="mt-0.5 text-[12px]" style={{ color: 'var(--color-sun)' }}><InfoPopover k="simulatedScenario">Example scenario, not real conditions</InfoPopover></p>}
      </div>

      {risk.error ? (
        <div className="mt-4 text-[14px]">
          <p>We could not load fire risk for this area.</p>
          <button type="button" onClick={risk.reload} className="mt-1 font-semibold text-[#c24a17] hover:underline">Try again</button>
        </div>
      ) : !r || risk.loading ? (
        <Skeleton />
      ) : (
        <div className="fade-in">
          {/* 2. Hero: the level in words first, the score second */}
          <div className="mt-4 flex items-center gap-3">
            {/* Widest case "Very high" at 48 px plus the 13 px stack is about 290 px of the 312 px column */}
            <InfoPopover k={`level.${r.today.level}`} className="font-display condensed shrink-0 text-[48px] font-bold leading-none tracking-tight whitespace-nowrap">
              <span style={{ color: `color-mix(in srgb, ${LEVEL_COLORS[r.today.level]} 82%, black)` }}>{levelLabel(r.today.level)}</span>
            </InfoPopover>
            <InfoPopover k="riskIndex" className="text-[13px] leading-snug whitespace-nowrap">
              <span className="flex flex-col">
                <span className="font-semibold">fire risk today</span>
                <span className="tabular-nums text-[var(--color-mute)]">{r.today.score} out of 100</span>
              </span>
            </InfoPopover>
          </div>
          {out && (
            <p className="mt-2 text-[15px]">
              <InfoPopover k="predictedDay" className="gap-1.5">
                {out.rising && <TrendingUp size={17} strokeWidth={2.25} style={{ color: LEVEL_COLORS[out.rising] }} aria-hidden />}
                <span className={out.rising ? 'font-medium' : 'text-[var(--color-mute)]'}>{out.text}</span>
              </InfoPopover>
            </p>
          )}
          {out?.prepBy && (
            <p className="mt-1.5 text-[14px] font-medium" style={{ color: EMBER }}>
              <InfoPopover k="crewsAction">
                <span className="flex items-start gap-1.5">
                  <Truck size={17} strokeWidth={2.25} aria-hidden className="mt-[1px] shrink-0" />
                  <span>Ask for firefighters and equipment by {out.prepBy}</span>
                </span>
              </InfoPopover>
            </p>
          )}

          {/* 3. Day strip: opens the trend sheet */}
          <DayStrip timeline={r.timeline} horizon={horizon} onOpen={() => setTrendOpen(true)} />
          <TrendSheet open={trendOpen} onClose={closeTrend} />

          {/* 4. Warning signs */}
          <section className="mt-4">
            <SectionHead title={rows.length ? `${rows.length} warning sign${rows.length === 1 ? '' : 's'} right now` : 'Warning signs'} />
            {rows.length ? (
              <ul className="space-y-2.5">
                {rows.map((s) => {
                  const Icon = SIGN_ICONS[s.key]
                  return (
                    <li key={s.key} className="text-[14px]">
                      <InfoPopover k={`sign.${s.key}`} className="gap-3">
                        <Icon size={18} strokeWidth={2} style={{ color: '#d4551f' }} aria-hidden className="shrink-0" />
                        <span>{s.text}</span>
                      </InfoPopover>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-[14px] text-[var(--color-mute)]">None right now</p>
            )}
          </section>

          {/* 5. Communities: the closest three; the count on the right replaces a "+N more" line */}
          {nearby.length > 0 && (
            <section className="mt-4">
              <SectionHead title={allFirstNations ? 'First Nations nearby' : 'Communities nearby'} count={nearby.length > 3 ? `Closest 3 of ${nearby.length}` : undefined} info="community" />
              <ul className="space-y-2.5">
                {nearby.slice(0, 3).map((c) => (
                  <li key={c.id} className="flex items-baseline justify-between gap-4 text-[14px]">
                    <span className="min-w-0 truncate" title={c.name}>{shortName(c.name)}</span>
                    <span className="shrink-0 tabular-nums text-[var(--color-mute)]">
                      {c.nearestFireKm == null ? 'No wildfire reported' : `${Math.round(c.nearestFireKm)} km from a wildfire`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* 6. Primary action */}
      <div className="mt-auto pt-3">
        <Link
          to="/brief"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#c24a17] text-[15px] font-semibold text-white transition-colors hover:bg-[#a33d12]"
        >
          <Send size={16} strokeWidth={2.25} aria-hidden />
          Ask for help
        </Link>
      </div>
    </div>
  )
}

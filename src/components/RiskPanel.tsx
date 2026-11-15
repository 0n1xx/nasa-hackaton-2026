import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, CloudOff, Droplets, Flame, LineChart, Send, Thermometer, TrendingUp, Truck, Wind, type LucideIcon } from 'lucide-react'
import type { CommunityExposure, RegionAir, RegionRisk, RiskDay, RiskLevel } from '../../shared/types.ts'
import { LEVEL_COLORS } from '../../shared/risk.ts'
import { warningSigns, type SignKey, type WarningSign } from '../../shared/signals.ts'
import { useApi } from '../api.ts'
import { useApp } from '../state.tsx'
import TrendSheet from './TrendSheet.tsx'

const RANK: Record<RiskLevel, number> = { Low: 0, Moderate: 1, High: 2, Critical: 3 }
const EMBER = '#d4551f'

const weekday = (iso: string, style: 'short' | 'long') =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: style })
const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000)
const num = (s: string) => Number.parseFloat((s.match(/[\d.]+/) ?? ['0'])[0])

const prevDay = (iso: string) => {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "Predicted Critical tomorrow", "Easing by Tuesday", "Steady for 3 days". prepBy: day to pre-position crews by. */
function outlook(timeline: RiskDay[], level: RiskLevel): { text: string; rising: RiskLevel | null; prepBy: string | null } {
  const today = timeline.find((t) => t.kind === 'today') ?? timeline.filter((t) => t.kind !== 'forecast').at(-1)
  const ahead = timeline.filter((t) => t.kind === 'forecast')
  const up = ahead.find((t) => RANK[t.level] > RANK[level])
  if (up) {
    const when = today && dayDiff(today.date, up.date) === 1 ? 'tomorrow' : weekday(up.date, 'long')
    const before = prevDay(up.date)
    const lead = today ? dayDiff(today.date, before) : null
    const prepBy = lead == null || lead <= 0 ? 'today' : lead === 1 ? 'tomorrow' : weekday(before, 'long')
    return { text: `Predicted ${up.level} ${when}`, rising: up.level, prepBy }
  }
  const down = ahead.find((t) => RANK[t.level] < RANK[level])
  if (down) return { text: `Easing by ${weekday(down.date, 'long')}`, rising: null, prepBy: null }
  return { text: `Steady for ${ahead.length} day${ahead.length === 1 ? '' : 's'}`, rising: null, prepBy: null }
}

const SIGN_ICONS: Record<Exclude<SignKey, 'outlook'>, LucideIcon> = {
  heat: Thermometer, humidity: Droplets, dry: CloudOff, wind: Wind, fire: Flame, smoke: CloudOff,
}

function signText(s: WarningSign): string | null {
  switch (s.key) {
    case 'heat': return `+${Math.round(num(s.value))}° this week`
    case 'humidity': return `Humidity ${Math.round(num(s.value))}%`
    case 'dry': return `${(s.value.match(/^\d+\+?/) ?? ['Several'])[0]} days without rain`
    case 'wind': return `Wind ${Math.round(num(s.value))} km/h ahead`
    case 'fire': { const n = Math.round(num(s.value)); return `${n} fire detection${n === 1 ? '' : 's'} nearby` }
    case 'smoke': return 'Smoke thickening'
    default: return null
  }
}

function shortName(name: string): string {
  const paren = name.match(/\(([^)]+)\)/)
  return (paren ? paren[1] : name).replace(/\s+First Nations?$/i, '').trim()
}

function SectionHead({ title, count }: { title: string; count: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between text-[13px] font-semibold text-[var(--color-mute)]">
      <h3>{title}</h3>
      <span className="tabular-nums">{count}</span>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="mt-6" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-[84px] w-40" />
      <div className="skeleton mt-3 h-4 w-36" />
      <div className="skeleton mt-8 h-16 w-full" />
      <div className="skeleton mt-8 h-4 w-28" />
      <div className="mt-4 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-4 w-48" />)}</div>
    </div>
  )
}

function DayStrip({ timeline, onOpen }: { timeline: RiskDay[]; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`See risk trend. ${timeline.map((t) => `${weekday(t.date, 'long')} ${t.level}`).join(', ')}`}
      className="group -mx-2 mt-5 block w-[calc(100%+1rem)] cursor-pointer rounded-lg px-2 pb-2 pt-2 text-left transition-colors hover:bg-black/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-fg)]"
    >
    <div className="flex justify-end">
      <span className="flex items-center gap-1 text-[13px] font-semibold text-[#c24a17] group-hover:underline">
        <LineChart size={15} strokeWidth={2.25} aria-hidden />
        See trend
      </span>
    </div>
    <div className="mt-1 flex items-end gap-1.5" aria-hidden>
      {timeline.map((t) => {
        const color = LEVEL_COLORS[t.level]
        const isToday = t.kind === 'today'
        const isPast = t.kind === 'historical'
        return (
          <div key={t.date} className="flex min-w-0 flex-1 flex-col items-center" title={`${weekday(t.date, 'short')}: ${t.score}, ${t.level}`}>
            <div className="flex h-[52px] w-full items-end justify-center">
              <div
                className="rounded-[3px]"
                style={{
                  width: isToday ? 16 : 10,
                  height: Math.max(6, Math.round((t.score / 100) * 52)),
                  background: t.kind === 'forecast' ? `color-mix(in srgb, ${color} 55%, white)` : color,
                  borderTop: t.kind === 'forecast' ? `2px solid ${color}` : undefined,
                  opacity: isPast ? 0.55 : 1,
                }}
              />
            </div>
            <span className={`mt-1.5 text-[11px] leading-none ${isToday ? 'font-semibold text-[var(--color-fg)]' : 'text-[var(--color-mute)]'}`}>
              {isToday ? 'Today' : weekday(t.date, 'short')}
            </span>
          </div>
        )
      })}
    </div>
    </button>
  )
}

export default function RiskPanel() {
  const { region, regions, setRegionId, mode } = useApp()
  const id = region?.id ?? null
  const risk = useApi<RegionRisk>(id ? `risk/${id}` : null)
  const air = useApi<RegionAir>(id ? `air/${id}?pastDays=7` : null)
  const comms = useApi<CommunityExposure[]>(id ? 'communities' : null)

  const [trendOpen, setTrendOpen] = useState(false)
  const closeTrend = useCallback(() => setTrendOpen(false), [])

  const r = risk.data
  const signs = r ? warningSigns(r, air.data) : []
  // The outlook sign is already the hero line, so the list and its count leave it out.
  const listed = signs.filter((s) => s.key !== 'outlook')
  const activeCount = listed.filter((s) => s.active).length
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
    <div className="flex h-full min-h-full flex-col px-6 pb-6 pt-5 text-[var(--color-fg)]">
      {/* 1. Region switcher */}
      <div>
        <div className="relative inline-flex items-center gap-1.5 rounded-md has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-[var(--color-fg)]">
          <span className="text-[15px] font-semibold">{region?.short ?? region?.name ?? 'Region'}</span>
          <ChevronDown size={16} strokeWidth={2.25} className="text-[var(--color-mute)]" aria-hidden />
          <select
            aria-label="Region"
            value={id ?? ''}
            onChange={(e) => setRegionId(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            style={{ border: 'none', background: 'transparent', padding: 0 }}
          >
            {regions.map((g) => <option key={g.id} value={g.id}>{g.short}</option>)}
          </select>
        </div>
        {mode === 'sim' && <p className="mt-0.5 text-[12px]" style={{ color: 'var(--color-sun)' }}>Simulated scenario</p>}
      </div>

      {risk.error ? (
        <div className="mt-5 text-[14px]">
          <p>Couldn't load data</p>
          <button type="button" onClick={risk.reload} className="mt-1 font-semibold text-[#c24a17] hover:underline">Try again</button>
        </div>
      ) : !r || risk.loading ? (
        <Skeleton />
      ) : (
        <div className="fade-in">
          {/* 2. Hero */}
          <div className="mt-5 flex items-baseline gap-3">
            <span className="font-display condensed text-[84px] font-bold leading-none tabular-nums tracking-tight" style={{ color: LEVEL_COLORS[r.today.level] }}>
              {r.today.score}
            </span>
            <span className="text-[22px] font-semibold">{r.today.level}</span>
          </div>
          {out && (
            <p className="mt-2 flex items-center gap-1.5 text-[15px]">
              {out.rising && <TrendingUp size={17} strokeWidth={2.25} style={{ color: LEVEL_COLORS[out.rising] }} aria-hidden />}
              <span className={out.rising ? 'font-medium' : 'text-[var(--color-mute)]'}>{out.text}</span>
            </p>
          )}
          {out?.prepBy && (
            <p className="mt-1.5 flex items-center gap-1.5 text-[14px] font-medium" style={{ color: '#c24a17' }}>
              <Truck size={17} strokeWidth={2.25} aria-hidden className="shrink-0" />
              Pre-position crews by {out.prepBy}
            </p>
          )}

          {/* 3. Day strip: opens the trend sheet */}
          <DayStrip timeline={r.timeline} onOpen={() => setTrendOpen(true)} />
          <TrendSheet open={trendOpen} onClose={closeTrend} />

          {/* 4. Warning signs */}
          <section className="mt-5">
            <SectionHead title="Warning signs" count={`${activeCount} of ${listed.length}`} />
            {rows.length ? (
              <ul className="space-y-2.5">
                {rows.map((s) => {
                  const Icon = SIGN_ICONS[s.key]
                  return (
                    <li key={s.key} className="flex items-center gap-3 text-[14px]">
                      <Icon size={18} strokeWidth={2} style={{ color: EMBER }} aria-hidden className="shrink-0" />
                      <span>{s.text}</span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-[14px] text-[var(--color-mute)]">No warning signs today</p>
            )}
          </section>

          {/* 5. Communities */}
          {nearby.length > 0 && (
            <section className="mt-5">
              <SectionHead title={allFirstNations ? 'First Nations nearby' : 'Communities nearby'} count={String(nearby.length)} />
              <ul className="space-y-2.5">
                {nearby.slice(0, 3).map((c) => (
                  <li key={c.id} className="flex items-baseline justify-between gap-4 text-[14px]">
                    <span className="min-w-0 truncate" title={c.name}>{shortName(c.name)}</span>
                    <span className="shrink-0 tabular-nums text-[var(--color-mute)]">
                      {c.nearestFireKm == null ? '—' : `${Math.round(c.nearestFireKm)} km from fire`}
                    </span>
                  </li>
                ))}
              </ul>
              {nearby.length > 3 && <p className="mt-2.5 text-[13px] text-[var(--color-mute)]">+{nearby.length - 3} more</p>}
            </section>
          )}
        </div>
      )}

      {/* 6. Primary action */}
      <div className="mt-auto pt-5">
        <Link
          to="/brief"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#c24a17] text-[15px] font-semibold text-white transition-colors hover:bg-[#a33d12]"
        >
          <Send size={16} strokeWidth={2.25} aria-hidden />
          Send situation brief
        </Link>
      </div>
    </div>
  )
}

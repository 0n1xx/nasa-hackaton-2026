import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import type { Region } from '../shared/types.ts'
import { useApp } from './state.tsx'
import Overview from './pages/Overview.tsx'
import MapPage from './pages/MapPage.tsx'
import Air from './pages/Air.tsx'
import Risk from './pages/Risk.tsx'
import Communities from './pages/Communities.tsx'
import Trends from './pages/Trends.tsx'
import Preparedness from './pages/Preparedness.tsx'
import DataPage from './pages/DataPage.tsx'
import Brief from './pages/Brief.tsx'

const NAV = [
  { to: '/', label: 'Overview' }, { to: '/risk', label: 'Early warning' }, { to: '/map', label: 'Map' }, { to: '/air', label: 'Air quality' },
  { to: '/communities', label: 'Communities' }, { to: '/trends', label: 'Trends' }, { to: '/preparedness', label: 'Preparedness' }, { to: '/data', label: 'Data' },
]

const PROVINCES: Record<string, string> = {
  BC: 'British Columbia', AB: 'Alberta', SK: 'Saskatchewan', MB: 'Manitoba', ON: 'Ontario', QC: 'Quebec', NB: 'New Brunswick', NS: 'Nova Scotia',
  PE: 'Prince Edward Island', NL: 'Newfoundland and Labrador', YT: 'Yukon', NT: 'Northwest Territories', NU: 'Nunavut',
}

/** Regions grouped by province, in the order they first appear, so the select can show short names without losing context. */
function byProvince(regions: Region[]) {
  const groups: { province: string; regions: Region[] }[] = []
  for (const r of regions) {
    const g = groups.find((x) => x.province === r.province)
    if (g) g.regions.push(r)
    else groups.push({ province: r.province, regions: [r] })
  }
  return groups
}

export function Logo() {
  return <NavLink to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Before the Smoke home">
    <svg viewBox="0 0 22 22" className="h-[22px] w-[22px]" aria-hidden><path d="M11 2l5 8h-3l4 7H5l4-7H6l5-8z" fill="#13211b" /><circle cx="18" cy="5" r="2.2" fill="#d4551f" /></svg>
    <span className="font-display text-[17px] font-bold tracking-[-0.01em]">Before the Smoke</span>
  </NavLink>
}

export default function App() {
  const { regions, region, setRegionId, mode, setMode, bootError } = useApp()
  const loc = useLocation()
  useEffect(() => { document.querySelector('main')?.scrollTo({ top: 0 }) }, [loc.pathname])

  // Layout by width. Phone: logo and mode on one row, region on the next, nav (scrolling) last.
  // Tablet and laptop: logo, region and mode on one row, nav below. 1392 px and up (the projector at 1440): one row.
  return <div className="flex h-full flex-col print:block print:h-auto">
    <header className="z-20 flex flex-wrap items-center gap-x-4 gap-y-2 md:gap-x-6 wide:gap-x-5 border-b border-line bg-ink-950 px-4 pt-2.5 md:px-8 wide:flex-nowrap wide:py-0 print:hidden">
      <div className="order-1 wide:py-3"><Logo /></div>

      <nav aria-label="Sections" className="nav-scroll order-4 -mx-4 flex w-[calc(100%+2rem)] gap-x-1 overflow-x-auto px-3 md:-mx-8 md:w-[calc(100%+4rem)] md:px-7 wide:order-2 wide:mx-0 wide:w-auto wide:px-0">
        {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.to === '/'}
          className={({ isActive }) => `shrink-0 px-2 py-3 text-[14px] wide:px-[7px] whitespace-nowrap focus-visible:outline-offset-[-3px] wide:py-[18px] ${isActive ? 'font-medium text-fg shadow-[inset_0_-2px_0_var(--color-fg)]' : 'text-mute hover:text-fg'}`}>{n.label}</NavLink>)}
      </nav>

      <label className="order-3 flex w-full items-center gap-2 text-[13px] text-mute sm:order-2 sm:ml-auto sm:w-auto wide:order-3">
        <span className="shrink-0 sm:hidden md:inline">Region</span>
        <select value={region?.id ?? ''} onChange={(e) => setRegionId(e.target.value)} aria-label="Select region" className="min-w-0 flex-1 font-medium sm:flex-none">
          {byProvince(regions).map((g) => <optgroup key={g.province} label={PROVINCES[g.province] ?? g.province}>
            {g.regions.map((r) => <option key={r.id} value={r.id}>{r.name.split(',')[0].trim()}</option>)}
          </optgroup>)}
        </select>
      </label>

      <div className="order-2 ml-auto flex shrink-0 rounded-lg border border-edge p-0.5 sm:order-3 sm:ml-0 wide:order-4" role="group" aria-label="Data mode">
        {(['live', 'sim'] as const).map((m) => <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-[6px] text-[13.5px] ${mode === m ? 'bg-fg font-medium text-white' : 'text-mute hover:text-fg'}`}>
          {m === 'sim' && <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${mode === m ? 'bg-[#f2c94c]' : 'bg-sun'}`} />}
          {m === 'live' ? 'Live' : 'Simulated'}
        </button>)}
      </div>
    </header>

    {mode === 'sim' && <div role="status" className="border-b border-sun/25 bg-[#fbf5e4] px-4 py-1.5 text-[13px] text-sun md:px-8 print:hidden">
      <span className="font-semibold">Simulated scenario.</span>{' '}
      <span className="hidden sm:inline">Fires, weather, smoke and risk on screen are invented for demonstration, not NASA observations. NASA imagery layers on the map remain real.</span>
      <span className="sm:hidden">Invented data for demonstration. NASA map imagery stays real.</span>
    </div>}

    <main className="relative min-h-0 flex-1 overflow-y-auto print:overflow-visible">
      <div className="mx-auto max-w-[1280px] px-4 pt-8 pb-12 md:px-8 md:pt-10">
        {bootError ? <div role="alert" className="py-6 text-flame">{bootError}</div> : !region ? <div className="skeleton h-64" /> :
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/air" element={<Air />} />
            <Route path="/risk" element={<Risk />} />
            <Route path="/communities" element={<Communities />} />
            <Route path="/trends" element={<Trends />} />
            <Route path="/preparedness" element={<Preparedness />} />
            <Route path="/data" element={<DataPage />} />
            <Route path="/brief" element={<Brief />} />
            <Route path="*" element={<div className="py-6">Page not found. <NavLink className="underline" to="/">Back to the overview</NavLink></div>} />
          </Routes>}
        <footer className="mt-16 flex flex-col gap-2 border-t border-line pt-5 text-[12px] leading-relaxed text-dim md:flex-row md:justify-between md:gap-8">
          <p className="max-w-[70ch]">A student prototype for the NASA Space Apps Challenge. It does not speak for any Indigenous community and is not an emergency alerting service.</p>
          <p className="print:hidden">Data from NASA FIRMS, NASA POWER, NASA GIBS, CWFIS and Open-Meteo. <NavLink to="/data" className="text-mute underline underline-offset-2 hover:text-fg">Data and methods</NavLink></p>
        </footer>
      </div>
    </main>
  </div>
}

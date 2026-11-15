import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useApp } from './state.tsx'
import Overview from './pages/Overview.tsx'
import MapPage from './pages/MapPage.tsx'
import Air from './pages/Air.tsx'
import Risk from './pages/Risk.tsx'
import Communities from './pages/Communities.tsx'
import Trends from './pages/Trends.tsx'
import Preparedness from './pages/Preparedness.tsx'
import DataPage from './pages/DataPage.tsx'

const NAV = [
  { to: '/', label: 'Overview' }, { to: '/map', label: 'Map' }, { to: '/air', label: 'Air quality' }, { to: '/risk', label: 'Risk' },
  { to: '/communities', label: 'Communities' }, { to: '/trends', label: 'Trends' }, { to: '/preparedness', label: 'Preparedness' }, { to: '/data', label: 'Data' },
]

export function Logo() {
  return <NavLink to="/" className="flex shrink-0 items-center gap-2.5" aria-label="BorealWatch home">
    <svg viewBox="0 0 22 22" className="h-[22px] w-[22px]" aria-hidden><path d="M11 2l5 8h-3l4 7H5l4-7H6l5-8z" fill="#eef1f4" /><circle cx="18" cy="5" r="2.2" fill="#f2884b" /></svg>
    <span className="text-[15px] font-semibold tracking-tight">BorealWatch</span>
  </NavLink>
}

export default function App() {
  const { regions, region, setRegionId, mode, setMode, bootError } = useApp()
  const loc = useLocation()
  useEffect(() => { document.querySelector('main')?.scrollTo({ top: 0 }) }, [loc.pathname])

  return <div className="flex h-full flex-col">
    <header className="z-20 flex flex-wrap items-center gap-x-8 gap-y-2 border-b border-line bg-ink-950 px-4 py-2.5 md:px-8">
      <Logo />
      <nav aria-label="Sections" className="order-3 -mx-1 flex w-full gap-x-5 overflow-x-auto px-1 lg:order-none lg:w-auto">
        {NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `shrink-0 py-2.5 text-[14px] whitespace-nowrap ${isActive ? 'font-medium text-fg' : 'text-mute hover:text-fg'}`}>{n.label}</NavLink>)}
      </nav>
      <div className="ml-auto flex flex-wrap items-center gap-2.5">
        <label className="flex items-center gap-2 text-[13px] text-mute"><span className="hidden sm:inline">Region</span>
          <select value={region?.id ?? ''} onChange={(e) => setRegionId(e.target.value)} aria-label="Select region" className="max-w-[46vw]">
            {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <div className="flex overflow-hidden rounded-lg border border-[#2a3642]" role="group" aria-label="Data mode">
          {(['live', 'sim'] as const).map((m) => <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`px-3.5 py-[7px] text-[13.5px] ${mode === m ? 'bg-fg font-medium text-ink-950' : 'text-mute hover:text-fg'}`}>{m === 'live' ? 'Live' : 'Simulated'}</button>)}
        </div>
      </div>
    </header>
    {mode === 'sim' && <div role="status" className="border-b border-line px-4 py-1.5 text-[13px] text-sun md:px-8">
      Simulated scenario. Fires, weather, smoke and risk on screen are invented for demonstration, not NASA observations. NASA imagery layers on the map remain real.
    </div>}
    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1280px] px-4 pt-8 pb-12 md:px-8">
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
            <Route path="*" element={<div className="py-6">Page not found. <NavLink className="underline" to="/">Back to the overview</NavLink></div>} />
          </Routes>}
        <p className="mt-12 border-t border-line pt-4 text-[12px] text-dim">A student prototype for the NASA Space Apps Challenge. It does not speak for any Indigenous community and is not an emergency alerting service.</p>
      </div>
    </main>
  </div>
}

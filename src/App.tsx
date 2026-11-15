import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useApp } from './state.tsx'
import Home from './pages/Home.tsx'
import Overview from './pages/Overview.tsx'
import MapPage from './pages/MapPage.tsx'
import Air from './pages/Air.tsx'
import Risk from './pages/Risk.tsx'
import Communities from './pages/Communities.tsx'
import Trends from './pages/Trends.tsx'
import Preparedness from './pages/Preparedness.tsx'
import DataPage from './pages/DataPage.tsx'
import Brief from './pages/Brief.tsx'

export function Logo() {
  return <NavLink to="/" className="flex shrink-0 items-center gap-2.5" aria-label="Before the Smoke home">
    <svg viewBox="0 0 22 22" className="h-[22px] w-[22px]" aria-hidden><path d="M11 2l5 8h-3l4 7H5l4-7H6l5-8z" fill="#13211b" /><circle cx="18" cy="5" r="2.2" fill="#d4551f" /></svg>
    <span className="font-display text-[17px] font-bold tracking-[-0.01em]">Before the Smoke</span>
  </NavLink>
}

export default function App() {
  const { region, mode, setMode, bootError } = useApp()
  const loc = useLocation()
  const home = loc.pathname === '/'
  useEffect(() => { document.querySelector('main')?.scrollTo({ top: 0 }) }, [loc.pathname])

  return <div className="flex h-full flex-col print:block print:h-auto">
    <header className="z-[1100] flex h-14 shrink-0 items-center gap-4 border-b border-line bg-white px-4 md:px-6 print:hidden">
      <Logo />
      <div className="ml-auto flex items-center gap-4">
        {!home && <Link to="/" className="hidden text-[14px] text-mute hover:text-fg sm:inline">Map</Link>}
        <Link to="/data" className="hidden text-[14px] text-mute hover:text-fg sm:inline">About the data</Link>
        <div className="flex rounded-full bg-ink-800 p-0.5" role="group" aria-label="Data mode">
          {(['live', 'sim'] as const).map((m) => <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] ${mode === m ? 'bg-white font-medium text-fg shadow-sm' : 'text-mute hover:text-fg'}`}>
            {m === 'live' ? 'Live' : 'Simulated'}
          </button>)}
        </div>
      </div>
    </header>

    <main className={`relative min-h-0 flex-1 print:overflow-visible ${home ? 'overflow-hidden md:overflow-hidden' : 'overflow-y-auto'}`}>
      {bootError ? <div role="alert" className="p-8 text-flame">{bootError}</div> : !region ? <div className="skeleton m-8 h-64" /> :
        home ? <Home /> :
        <div className="mx-auto max-w-[1080px] px-4 pt-8 pb-12 md:px-8 md:pt-10">
          <Routes>
            <Route path="/overview" element={<Overview />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/air" element={<Air />} />
            <Route path="/risk" element={<Risk />} />
            <Route path="/communities" element={<Communities />} />
            <Route path="/trends" element={<Trends />} />
            <Route path="/preparedness" element={<Preparedness />} />
            <Route path="/data" element={<DataPage />} />
            <Route path="/brief" element={<Brief />} />
            <Route path="*" element={<div className="py-6">Page not found. <NavLink className="underline" to="/">Back to the map</NavLink></div>} />
          </Routes>
          <footer className="mt-16 border-t border-line pt-5 text-[12px] text-dim print:hidden">
            A student prototype for NASA Space Apps 2026. Not an emergency alerting service, and it does not speak for any Indigenous community.
          </footer>
        </div>}
    </main>
  </div>
}

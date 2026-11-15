// The old "Data and methods" screen now lives at /about (sources, live status, formula, limits).
import { Navigate } from 'react-router-dom'

export default function DataPage() {
  return <Navigate to="/about" replace />
}

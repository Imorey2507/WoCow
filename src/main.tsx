/**
 * WoCow · entry point
 * Owner: Person 5 (Integration)
 *
 * NOTE ON StrictMode
 * ------------------
 * StrictMode double-invokes effects in development. React Leaflet v5 handles
 * the mount/unmount/mount cycle correctly, so the map is fine — but if your
 * map ever renders blank in dev *and only in dev*, this is the first thing to
 * try removing. Production is unaffected either way.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root element #root is missing from index.html')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

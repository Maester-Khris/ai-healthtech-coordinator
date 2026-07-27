import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initSentry } from './lib/sentry'

initSentry()

const container = document.getElementById('root')!
const app = (
  <StrictMode>
    <App />
  </StrictMode>
)

// Prerendered marketing routes ship with #root already populated (see
// scripts/prerender.mjs) — hydrate those instead of wiping and re-rendering.
// CSR-only routes (/app, /setup, ...) fall through to the empty SPA shell.
if (container.hasChildNodes()) {
  hydrateRoot(container, app)
} else {
  createRoot(container).render(app)
}

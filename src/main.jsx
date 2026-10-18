import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/bricolage-grotesque'
import App from './App.jsx'
import './styles.css'

// The service worker caches the page as it passes through, but the very first load happens
// before it takes control. Re-fetch the page once it does, so the app opens offline after
// a single visit.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const warm = () => fetch('/').catch(() => {})
  if (navigator.serviceWorker.controller) warm()
  else navigator.serviceWorker.addEventListener('controllerchange', warm, { once: true })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

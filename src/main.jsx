import { warmOfflineCopy } from './lib/pwa.js' // first, so the install event is never missed
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/bricolage-grotesque'
import App from './App.jsx'
import './styles.css'

warmOfflineCopy()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Tells the self-repair check in index.html that the app started fine.
window.__kharchaStarted = true

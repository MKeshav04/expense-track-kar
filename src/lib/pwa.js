// Install and update helpers. Imported first in main.jsx so the install event is never missed.

let installEvent = null
const listeners = new Set()
const notify = () => listeners.forEach((f) => f())

// Chrome/Edge (Android, Windows, Mac) offer a one-tap install through this event.
// We don't preventDefault, so Chrome can still show its own install banner too.
window.addEventListener('beforeinstallprompt', (e) => {
  installEvent = e
  notify()
})
window.addEventListener('appinstalled', () => {
  installEvent = null
  notify()
})

export const canPromptInstall = () => !!installEvent

export async function promptInstall() {
  if (!installEvent) return false
  const e = installEvent
  installEvent = null
  e.prompt()
  const { outcome } = await e.userChoice
  notify()
  return outcome === 'accepted'
}

export function onInstallChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

export function platform() {
  const ua = navigator.userAgent
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  if (/iPhone|iPad|iPod/.test(ua) || iPadOS) return 'ios'
  if (/Android/.test(ua)) return 'android'
  if (/Macintosh/.test(ua)) return /Chrome|Edg\//.test(ua) ? 'mac-chrome' : 'mac-safari'
  return 'desktop'
}

// Clears the offline copy of the app (never your entries, which live in IndexedDB) and reloads.
export async function getLatestVersion() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) || []
    await Promise.all(regs.map((r) => r.unregister()))
    const keys = (await window.caches?.keys?.()) || []
    await Promise.all(keys.map((k) => caches.delete(k)))
  } finally {
    location.reload()
  }
}

// After the service worker takes control, fetch the page and every build file once through it,
// so the very first visit is already enough to open the app offline.
export function warmOfflineCopy() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
  const warm = () => {
    const urls = new Set(['/'])
    for (const entry of performance.getEntriesByType('resource')) {
      const u = new URL(entry.name)
      if (u.origin === location.origin && u.pathname.startsWith('/assets/')) urls.add(u.pathname)
    }
    for (const u of urls) fetch(u).catch(() => {})
  }
  const start = () => {
    if (navigator.serviceWorker.controller) warm()
    else navigator.serviceWorker.addEventListener('controllerchange', warm, { once: true })
  }
  // Wait for the page (fonts included) to finish loading so every file is on the list.
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start, { once: true })
}

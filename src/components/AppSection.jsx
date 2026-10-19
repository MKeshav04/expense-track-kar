import { useEffect, useState } from 'react'
import { canPromptInstall, getLatestVersion, isInstalled, onInstallChange, platform, promptInstall } from '../lib/pwa.js'

const STEPS = {
  ios: [
    'Tap the Share button (□↑): at the bottom in Safari, at the top right in Chrome.',
    'Scroll down, tap “Add to Home Screen”, then “Add”.',
  ],
  android: ['Tap the ⋮ menu in Chrome.', 'Tap “Install app” (or “Add to Home screen”).'],
  'mac-safari': ['In the menu bar, choose File → Add to Dock.', 'This needs macOS Sonoma or newer; on older Macs, use Chrome.'],
  'mac-chrome': [
    'Click the install icon at the right end of the address bar,',
    'or open ⋮ → Cast, save, and share → Install page as app.',
  ],
  desktop: [
    'Click the install icon at the right end of the address bar,',
    'or open ⋮ → Cast, save, and share → Install page as app.',
  ],
}

// Settings → App: install help, the running version, and a way to unstick an old copy.
export default function AppSection({ showToast }) {
  const [canPrompt, setCanPrompt] = useState(canPromptInstall)
  const installed = isInstalled()
  const steps = STEPS[platform()]

  useEffect(() => onInstallChange(() => setCanPrompt(canPromptInstall())), [])

  async function install() {
    const ok = await promptInstall()
    if (ok) showToast('Installed! Open Kharcha from your home screen 🎉')
  }

  return (
    <section className="card">
      <h2>App</h2>
      {installed ? (
        <p className="small">✅ You're using the installed app.</p>
      ) : (
        <>
          <p className="small">Install Kharcha so it opens like an app: its own icon, full screen, works offline.</p>
          {canPrompt && (
            <button className="btn primary install-btn" onClick={install}>Install app</button>
          )}
          <ol className="steps">
            {steps.map((s) => <li key={s}>{s}</li>)}
          </ol>
        </>
      )}
      <p className="muted small">
        The installed app and the browser keep separate entries. To move them, Back up in one and Restore
        in the other.
      </p>
      <div className="row app-version">
        <span className="grow small">Version <b>{__APP_VERSION__}</b></span>
        <button className="btn small" onClick={getLatestVersion}>Get latest version</button>
      </div>
      <p className="muted small">
        Use this if the app looks out of date or doesn't load properly. Your entries are kept.
      </p>
    </section>
  )
}

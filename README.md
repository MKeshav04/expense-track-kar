# Kharcha — the simplest expense track-kar

Type `150 food`, press Add, done. A phone app for logging daily spending in rupees, keeping to a
monthly budget, and saving up for things. No accounts, no ads; your data never leaves your phone.

**▶ Open the app: https://expense-track-kar.netlify.app**

## Features
- **Type, don't tap** — `150 food`, `1.5k myntra`, `200 auto yesterday`, `150 food, 40 chai` (several at once).
- **Smart categories** — understands Swiggy, Blinkit, Uber, Myntra… and small typos; learns from your corrections.
- **Monthly budget** — big "₹X left this month" on the home screen, with what you've spent beside it.
- **Plan tab** — bills and must-buys kept aside until paid (typing `199 netflix` marks it paid), savings goals you fill a bit each month, and the full budget breakdown with ≈ per day.
- **Summary** — today / week / month, by category, day by day, biggest spends, fun facts.
- **AI** — suggests categories for messy entries and writes a short summary of your month.
- **Works offline**, dark/light mode, backup to JSON/CSV, a 🔥 streak to keep the habit.

## Install as an app
- **iPhone:** Safari or Chrome → Share (□↑) → **Add to Home Screen**.
- **Android:** Chrome → ⋮ → **Install app**.
- **Mac:** Safari → File → **Add to Dock**, or Chrome → install icon in the address bar.

The steps for your device are also in the app under Settings → App.

Updates arrive by themselves; close and reopen the app. If a device ever looks stuck on an old
version, Settings → App → **Get latest version** (entries are kept). Back up now and then.

## Run locally
```bash
npm install
npm run dev     # http://localhost:5173 (also prints a link for your phone on the same Wi-Fi)
npm test        # 52 tests
```
For the AI, create `.env.local` with `GROQ_API_KEY=...`. Deploys to Netlify from `main`
(set `GROQ_API_KEY` in Netlify's environment variables).

**Stack:** React · Vite · Dexie (IndexedDB) · PWA · Groq · Netlify Functions

## More
- **[DOCS.md](DOCS.md)** — how everything works: typing rules, budget maths, data, AI, offline and updates, deploying, troubleshooting, decisions.
- **[PLAN.md](PLAN.md)** — the plan and what's next.

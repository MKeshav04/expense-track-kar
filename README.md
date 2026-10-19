# Kharcha — the simplest expense track-kar

Type `150 food`, press Add, done. Kharcha is a phone app (an installable web app, or PWA) for
logging daily spending in rupees, seeing where the money went, and getting a short AI-written
summary when you want one. Built for me and a couple of friends — no accounts, no ads, no servers
holding anyone's data.

**▶ Open the app: https://expense-track-kar.netlify.app** — then install it to your home screen
([how](#install-on-a-phone)).

- **Code:** https://github.com/MKeshav04/expense-track-kar
- **Hosting:** Netlify (auto-deploys from `main`)
- **Original planning notes:** [PLAN.md](PLAN.md) and `Expense Tracker App — Build Plan.pdf`

---

## Contents
1. [What it does](#what-it-does)
2. [How to type entries](#how-to-type-entries)
3. [Categories and how it learns](#categories-and-how-it-learns)
4. [Screens](#screens)
5. [The AI parts](#the-ai-parts)
6. [Where your data lives](#where-your-data-lives)
7. [Install on a phone](#install-on-a-phone)
8. [Updates and offline](#updates-and-offline) — including how to add features without anyone reinstalling
9. [Run it on your computer](#run-it-on-your-computer)
10. [Deploy on Netlify](#deploy-on-netlify)
11. [Project structure](#project-structure)
12. [How the code works](#how-the-code-works)
13. [Troubleshooting](#troubleshooting)
14. [Limits, on purpose](#limits-on-purpose)
15. [Decisions log](#decisions-log)

---

## What it does

| | |
|---|---|
| **Quick add** | One box at the top. Type like you'd text a friend; several entries per line work. |
| **Instant and offline** | Saving never waits for the internet. The AI is only ever an extra. |
| **Smart categories** | Understands category names, other words for them ("lunch", "auto", "rent"), common Indian apps (Swiggy, Blinkit, Uber, Myntra…), and small typos. Learns from your corrections. |
| **Quick-tap chips** | Things you log repeatedly ("₹40 chai") become one-tap buttons. |
| **Streak 🔥** | Days in a row you've logged. "Spent nothing?" marks a no-spend day so the streak survives. |
| **Mood line** | Compares today with your usual day: lighter / normal / pricier. |
| **Summary** | Today / Week / Month, any past period, a receipt-style total, comparison with the same point last period, fun facts, category breakdown, day-by-day chart, biggest 5. |
| **AI** | Suggests categories for entries it couldn't sort, and writes a 3–4 sentence summary of your spending. |
| **Share** | Send a period's summary to WhatsApp (or anywhere) as text. |
| **Backup** | Export JSON (full backup) and CSV (for Excel); restore from JSON; reminder every 30 days. |
| **Looks** | Dark by default, ☀️/🌙 toggle for light. Bold "sticker + receipt" style, a colour per category. |
| **Private** | Every phone keeps its own data. Nobody else — including whoever shared the link — can see it. |

---

## How to type entries

Amount anywhere, category word anywhere, the rest becomes the note.

| You type | Saved as |
|---|---|
| `150 food` / `food 150` / `₹150 on food` | ₹150 · Food · today |
| `rs 150 food`, `rs150 food`, `150rs food` | ₹150 · Food |
| `1k shopping` / `1.5k myntra` | ₹1,000 · Shopping / ₹1,500 · Shopping, note "myntra" |
| `1,000 shopping` / `1,00,000 rent` | ₹1,000 / ₹1,00,000 (commas are fine) |
| `99.50 chai` | ₹99.50 · Food |
| `200 auto yesterday` | ₹200 · Transport · yesterday |
| `200 auto day before yesterday` / `3 days ago` | 2 / 3 days back |
| `200 auto sat` / `last mon` | Most recent past Saturday / Monday (same weekday = last week) |
| `200 auto 15/10` / `15-10` / `01/10/26` | That date (a future dd/mm means last year) |
| `150 food, 40 chai and 60 auto` | **Three entries** (splits on `,` `;` `and` `&` `+` new line) |
| `bread and butter 60` | One entry — only splits when every part has its own amount |
| `2 coffees 300` | ₹300 (takes the price, not the quantity) |
| `3 shirts ₹1200` | ₹1,200 (a number marked with ₹/rs wins) |
| `150 fodo` / `300 shoping` | Food / Shopping (one-letter typos, words of 4+ letters only) |
| `340 xyz thing` | ₹340 · Uncategorised → AI suggests a category |
| `food` | Error: "Add an amount, like 150 food." Nothing saved. |

Every save shows a confirmation like **₹150 · 🍔 Food · Today** with **Undo**. Tap any entry to
change its amount, category, date or note, or delete it (also undoable).

---

## Categories and how it learns

**Defaults:** 🍔 Food · 🛒 Groceries · 🛺 Transport · 🛍️ Shopping · 🧾 Bills · 💊 Care · 🎉 Fun · 📦 Other.
In Settings you can add, rename, reorder, change the emoji, add "other words" (aliases), or hide a
category (hidden ones keep their history).

**How a category is chosen, in order:**
1. **Category name or alias** in what you typed (two-word aliases like "eating out" work).
2. **Keyword memory** — words it has learned, e.g. "zomato" → Food.
3. **Typo match** — one wrong/missing/extra/swapped letter, words of 4+ letters
   (so "car" never becomes "Care").
4. Otherwise **Uncategorised**, and the AI suggests one when you're online.

**Keyword memory** starts with common Indian apps:
Swiggy, Zomato, Domino's, McDonald's, KFC, Starbucks → Food ·
Blinkit, Zepto, BigBasket, Instamart, DMart, JioMart → Groceries ·
Uber, Ola, Rapido, IRCTC, redBus, IndiGo → Transport ·
Amazon, Flipkart, Myntra, Ajio, Meesho, Nykaa, Decathlon → Shopping ·
Netflix, Spotify, Hotstar, Jio, Airtel → Bills ·
PharmEasy, Apollo, Netmeds, 1mg, Cult → Care · BookMyShow, PVR, INOX → Fun.

It then learns:
- **When you correct a category** (or accept an AI suggestion), the note's words are trusted
  for that category straight away.
- **Ordinary saves** nudge a word +1 towards its category; a conflicting save nudges it −1.
  A word is only used after **3 consistent uses**, so one-off words like a friend's name don't
  take over a category.
- Filler and generic words (on, for, with, team, friends, home, office…), numbers, and words
  under 3 letters are never learned.

---

## Screens

### ✍️ Add (always opens here)
- Brand bar: 🔥 streak and the ☀️/🌙 theme button.
- **Spent today** card: today's total, a mood line vs your usual day (average of the last 30 days,
  shown once there are 3+ days of history), and **Spent nothing?** to mark a no-spend day.
- The input box (with a rotating example), quick-tap chips, then entries grouped by day with
  daily totals. **Show older entries** loads more.
- A backup reminder appears once you have 20+ entries and haven't backed up in 30 days.

### 🧾 Summary
- **Today / Week / Month** (weeks start Monday) and ‹ › to move through past periods.
- **Receipt:** total, entries, per-day average, and "by this point last month/week" with ▲/▼ %.
  The comparison uses the *same number of days* (Oct 1–19 vs Sep 1–19), which is fairer than
  comparing a half month with a full one.
- **Fun facts:** most repeated buy ("chai ×12"), biggest day, no-spend days, average entry.
- **Where it went:** a colour bar plus each category's % and ₹. Tap a category to see its entries.
- **Day by day** chart (today highlighted), **Biggest** 5 entries.
- **Kharcha says:** the AI summary, plus **Share**.

### ⚙️ Settings
- **Look:** light/dark.
- **Categories:** emoji, name, other words, order, hide/show, add new.
- **Backup:** Back up (JSON), Export for Excel (CSV), Restore from backup. On phones this opens the
  share sheet, so you can save straight to Google Drive or send to yourself on WhatsApp.
- **Your data:** whether the browser has granted permanent storage, and what the AI sees.

---

## The AI parts

Two small jobs. Saving never waits for either.

| | What's sent | What comes back |
|---|---|---|
| **Category suggestion** | Only the note of an uncategorised entry + your category names | One category name, checked in code against your list (anything else is rejected) |
| **Summary** | Only totals that the app already calculated (period, total, per-category amounts and %, biggest 5 entries, comparison) | 3–4 plain sentences ending with one practical observation |

- The AI **never does arithmetic** — every number in the summary comes from the app's own maths.
- Category suggestions run for up to 5 recent entries at a time: after saving, when the app
  opens, and when the phone comes back online. Each entry is asked about once.
- **Provider:** [Groq](https://console.groq.com), model `openai/gpt-oss-120b` (reasoning effort low).
  Change it with `GROQ_MODEL`. Claude also works: set `ANTHROPIC_API_KEY` instead.
- **The API key never reaches the phone.** It lives only in the server function
  ([api/ai.js](api/ai.js)), which also rejects calls from other websites, caps input size, and
  never logs request contents.
- Without a key, the app works fully; the AI buttons just say it isn't set up.

---

## Where your data lives

On each phone, in **IndexedDB** — a real database built into every browser (used through Dexie).
There is **no server database**. Netlify only serves the app's files.

| Table | Holds |
|---|---|
| `expenses` | `id`, `amountPaise` (₹150 → 15000, whole numbers so totals never drift), `categoryId`, `note`, `rawText` (exactly what you typed), `date` (local `YYYY-MM-DD`), `source` (rule / memory / llm / manual), `createdAt`, `updatedAt`, plus AI suggestion fields |
| `categories` | `id`, `name`, `emoji`, `aliases`, `order`, `archived` |
| `keywords` | learned `word` → `categoryId`, `count` |
| `settings` | `lastBackupAt`, `noSpendDays` |

The theme choice is kept in `localStorage`.

**What keeps it safe:** the app asks for permanent storage (`navigator.storage.persist()`), and
installed home-screen apps aren't auto-cleared the way rarely-visited websites can be on iPhone.

**What can lose it:** losing the phone, uninstalling the app on iPhone, or "Clear site data /
storage" for the site. **Back up regularly** — the backup file is the only copy outside the phone.
A backup restores on any phone (entries are merged, nothing is deleted).

---

## Install on a phone

It's a website that installs like an app: own icon, full screen, works offline.

**Android (Chrome):** open the link → tap **Install** (or **⋮ → Install app**) → it appears on the
home screen and in the app drawer.

**iPhone (must be Safari):** open the link → **Share ↑** → **Add to Home Screen** → **Add**.

After that, always open it from the **icon**, not the browser. The browser tab and the installed
app keep separate data.

---

## Updates and offline

- **Offline:** the app's code, styles, icons and font are stored on the phone. The page itself is
  loaded fresh whenever you're online (waits up to 4 seconds), and the last copy is used offline.
- **Updates:** push to GitHub → Netlify redeploys → next time you open the app it fetches the new
  version. Fully close and reopen once (sometimes twice) to see it. No reinstall, data untouched.
- **Exception — name or icon changes:** Android picks them up on its own within about a day;
  iPhone needs the app removed and re-added (**back up first**, removing it deletes its data).

### Adding features without anyone reinstalling

New features, screens, styles, parser rules and AI changes all arrive by themselves after a push.
Keep it that way by following these rules:

| Rule | Why |
|---|---|
| **Never rename** `'expense-tracker'` in `src/lib/db.js` / `src/lib/backup.js` | That's where every phone's data lives; renaming = empty app, old backups won't restore |
| **New data fields:** just start writing them; old entries without the field must still work | Saved entries are never rewritten on their own |
| **New table or index:** add `db.version(2).stores({...})` (keep `version(1)`) plus an `.upgrade()` if old rows need filling in | Dexie upgrades each phone's database in place on next open, data kept |
| **Never delete a table or remove version(1)** | Phones on the old version could lose data |
| **Keep the Netlify link the same** (`expense-track-kar.netlify.app`) | The installed app belongs to that address; a new address = a new, empty app |
| **Avoid changing `name`, `short_name`, icons** | iPhone never updates them without a reinstall |
| **Test with real data before pushing:** back up from your phone, `npm run dev`, restore the backup there, check | Catches anything that would break existing entries |

Things that do need a one-time tap from each person (not a reinstall): new permissions such as
notifications — the app asks, they allow.

---

## Run it on your computer

Needs Node.js 22+.

```bash
npm install
npm run dev        # http://localhost:5173 — also prints a Network URL for your phone on the same Wi-Fi
npm test           # 36 parser tests (Vitest)
npm run build      # production build into dist/
npm run preview    # serve the production build (with offline/service worker) on :4173
```

**AI locally:** copy `.env.example` to `.env.local` and set:

```
GROQ_API_KEY=gsk_...
# GROQ_MODEL=openai/gpt-oss-120b   (optional)
```

Restart `npm run dev` after editing it. `.env.local` is git-ignored — never commit keys.
The dev server serves `/api/ai` itself, so the AI works locally exactly like on Netlify.

**Regenerate icons** (after changing colours in the script): `node scripts/make-icons.mjs`.

**Renaming the app:**

| What | Where |
|---|---|
| Name under the home-screen icon | `short_name` in [vite.config.js](vite.config.js) |
| Full name (install prompt, app info) | `name` in [vite.config.js](vite.config.js) |
| Browser tab title / iPhone icon label | `<title>` and `apple-mobile-web-app-title` in [index.html](index.html) |
| Search/share description | `<meta name="description">` in [index.html](index.html) |
| Wordmark at the top of the app | `kharcha` in [src/components/AddScreen.jsx](src/components/AddScreen.jsx) |
| Text on the summary receipt | `KHARCHA ·` in [src/components/SummaryScreen.jsx](src/components/SummaryScreen.jsx) |

Never rename `'expense-tracker'` in `src/lib/db.js` or `src/lib/backup.js` — those are internal IDs;
changing them makes every phone lose its entries and old backups stop restoring.

---

## Deploy on Netlify

1. Netlify → **Add new project → Import an existing project → GitHub → expense-track-kar**
   (live at https://expense-track-kar.netlify.app).
   Build settings come from [netlify.toml](netlify.toml) (`npm run build`, publish `dist`, Node 22).
2. **Site configuration → Environment variables:** add `GROQ_API_KEY` (no quotes). Redeploy.
3. Every push to `main` deploys automatically.

`netlify.toml` also:
- rewrites unknown paths to `index.html`, so refreshing never shows "Page not found"
  (safe for the AI, because Netlify runs functions before redirect rules);
- tells browsers to always re-check `sw.js`, so updates reach installed phones.

Don't use drag-and-drop deploys — they skip the AI function.

---

## Project structure

```
api/ai.js                     AI handler (Groq or Claude), shared by Netlify and local dev
netlify/functions/ai.mjs      Netlify Function → serves api/ai.js at /api/ai
netlify.toml                  Netlify build, refresh fallback, headers
vite.config.js                Vite + PWA (manifest, offline caching) + local /api/ai
index.html                    Page shell; applies the saved theme before first paint
public/                       Icons and favicon
scripts/make-icons.mjs        Generates the PNG icons (no dependencies)
src/
  main.jsx                    Entry; loads the font; warms the offline page copy
  App.jsx                     Tabs, toast/undo, edit sheet, theme, AI retry on reconnect
  styles.css                  All styling (dark default + light theme)
  components/
    AddScreen.jsx             Brand bar, today card, input, chips, entry list
    EntryList.jsx             Entries grouped by day (or flat), AI suggestion chips
    EditSheet.jsx             Edit/delete one entry
    SummaryScreen.jsx         Receipt, fun facts, categories, charts, AI summary, share
    SettingsScreen.jsx        Theme, categories, backup/restore, data info
  lib/
    parse.js                  The text parser (pure functions) — amount, date, category, note
    parse.test.js             Parser tests
    db.js                     Dexie database, seeding, saving, keyword learning, no-spend days
    stats.js                  All summary maths, streak, usual day, fun facts, AI facts
    ai.js                     Calls /api/ai; background category suggestions
    backup.js                 JSON/CSV export and JSON import
    dates.js                  Local-date helpers (YYYY-MM-DD)
    format.js                 ₹ formatting, category colours
    seed.js                   Default categories and seeded merchant keywords
    theme.js                  Light/dark switching
```

**Stack:** React 19 · Vite 8 · Dexie 4 (IndexedDB) · vite-plugin-pwa (Workbox) · Vitest ·
Bricolage Grotesque (bundled, works offline) · Groq API · Netlify Functions.

---

## How the code works

**Saving an entry:** `AddScreen` → `parseInput()` (pure, no network) → `addEntries()` writes to
IndexedDB and nudges keyword memory → the list updates live (Dexie `useLiveQuery`) → if anything is
uncategorised, `suggestMissing()` asks `/api/ai` in the background and stores a suggestion.

**Parser rules** ([src/lib/parse.js](src/lib/parse.js)):
1. Lower-case, drop thousands separators.
2. Split into several entries only if every part has an amount.
3. Find the date words first (so "3 days ago" isn't read as ₹3).
4. Find the amount: prefer one marked with ₹/rs; otherwise the largest number. `k` = ×1000.
5. Find the category: name/alias → keyword memory (count ≥ 3) → typo match.
6. The rest is the note (filler words trimmed from the ends).

**Summaries** ([src/lib/stats.js](src/lib/stats.js)) are computed from the entries in the period and
the same span of the previous period. `statsForAI()` turns them into ready-formatted strings, so the
AI only ever writes words around numbers it was given.

**Adding a parser rule:** add a failing case to `parse.test.js`, make it pass, run `npm test`.
Every entry keeps `rawText`, so old entries can be re-parsed if the parser improves.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Phone shows an old version | Fully close the app and reopen (twice if needed). Clearing the browser cache doesn't help — and **don't** "clear site data", it deletes entries. |
| "AI is not set up yet" | `GROQ_API_KEY` missing — in `.env.local` locally (restart dev server) or in Netlify env vars (then redeploy). |
| "The server API key is invalid" | Re-copy the key from the Groq console. |
| "The AI model … isn't available" | Groq retired the model. Pick a current one from Groq's models page and set `GROQ_MODEL`. |
| "Too many AI requests" | Groq free-tier rate limit; wait a minute. |
| No install option on iPhone | Use Safari, not Chrome. |
| Entries missing after switching browser/app | Browser tab and installed app have separate data. Back up from one, restore in the other. |
| "Permanent storage: not granted" | Install the app to the home screen; Chrome usually grants it then. |

---

## Limits, on purpose

- **No sync between devices** — each phone is separate. Use backup/restore to move data.
- **No bank/SMS auto-import** — a web app can't read SMS, and it'd be a big privacy cost.
- **No bill splitting, income, investments or multi-currency** — Splitwise and others do those well.
- **No reminders yet** — a web app can't schedule its own notification without a push server.
  A daily phone alarm works fine.
- **Rupees only.**

---

## Decisions log

- **Installable web app instead of a Play Store app** — free, works on Android and iPhone, no store
  review, friends just open a link.
- **Data on each phone, no shared database** — nobody holds anyone else's spending.
- **Parser first, AI second** — "150 food" needs no AI; AI only for messy text and summaries.
- **Money in paise, dates as local strings** — no rounding drift, no entries landing on the wrong
  day near midnight.
- **Keyword threshold raised to 3** — after testing, 2 let a friend's name ("rohan") map to Food.
- **Groq model `openai/gpt-oss-120b`** — `llama-3.3-70b-versatile` was shut down by Groq on
  16 Aug 2026.
- **Dark by default with a light toggle** — the dark look was the favourite.
- **Page loaded network-first** — the first version precached the page, so Netlify-side changes
  never reached installed phones.
- **Always opens on Add** — logging should be one tap away.

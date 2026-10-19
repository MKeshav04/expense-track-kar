# Expense Track-kar — Revised Plan

Updated Oct 19, 2026. Replaces the scope in `Expense Tracker App — Build Plan.pdf`; the PDF's
reasoning (PWA, local-first, parser before AI) still holds.

## Who it's for
Me, plus 1–2 friends. Not for sale. Must be fast enough that I keep using it.

## Where the data lives
Each phone has its own database: **IndexedDB** (a real database built into every browser),
used through the Dexie library. No server database.

- Survives closing the app, restarting the phone, and going offline.
- The app asks the browser to keep it permanently (`navigator.storage.persist()`), so the
  browser won't clear it to free space.
- Installing to the home screen matters on iPhone: Safari can clear data of websites you
  haven't opened in a while, but not of installed home-screen apps.
- **Backup:** one tap exports everything as a JSON file (save it to Drive or WhatsApp it to
  yourself), plus CSV for Excel. Import restores it on a new phone. The app reminds you if
  you haven't backed up in 30 days.
- What it can't survive: losing the phone or clearing browser data without a backup.
  That's the trade for "nobody, including me, can see my friends' spending".

## Where the AI is used
The AI runs behind a small Netlify server function, so the API key never reaches the phone.
Provider: **Groq** free tier (`openai/gpt-oss-120b` by default, change with `GROQ_MODEL`).
Claude also works: set `ANTHROPIC_API_KEY` instead of `GROQ_API_KEY`.

1. **"Summarise my month"** — the main use. Code computes the numbers (totals, top
   categories, change vs last month, biggest entries); the AI only turns them into 3–4
   plain-English sentences with one practical observation. It never does arithmetic.
2. **Category for messy entries** — only when the parser and keyword memory both fail.
   The entry is saved first as Uncategorised; the AI's pick appears as a one-tap suggestion
   and is checked against your category list in code.

Only the summary numbers or the leftover entry text are sent. Nothing else leaves the phone.
On Groq's free tier this costs nothing at 3 people's usage.

## v0 — build now
| Feature | Detail |
|---|---|
| Quick-add box | Big input at the top. Type, press enter. |
| Parser | Amount (`150`, `₹150`, `rs 150`, `1k`, `1.5k`, `1,000`), date words (`today`, `yesterday`, `mon`, `2 days ago`, `19/10`), category, note. |
| Several per line | `150 food, 1k shopping` or `150 food and 40 auto` → separate entries. |
| Confirmation | Each save shows `₹150 · Food · Today`; tap the entry to fix it. |
| Keyword memory | Seeded with common Indian apps (Swiggy, Zomato, Blinkit, Uber, Myntra…). Learns from your corrections. Ignores filler words. |
| Typo match | One-letter typos on category names, only for words of 4+ letters (so "car" ≠ "Care"). |
| Quick chips | Your most-used entries as one-tap buttons ("40 chai"). |
| Categories | Defaults: Food, Groceries, Transport, Shopping, Bills, Care, Fun, Other. Add, rename, emoji, delete. |
| Entry list | Grouped by day. Tap to edit amount/category/date/note, or delete (with undo). |
| Summary | Month default, plus week/today. Total, pace vs same point last month, category bars, daily bars, top 5. Tap a category to see its entries. |
| AI summary | "Summarise with AI" button on the summary screen. |
| Share | Send the month summary as text to WhatsApp. |
| Backup | Export JSON + CSV, import JSON, 30-day reminder. |
| Install + offline | Home-screen app, works with no internet (AI needs internet). |
| Look | Dark by default, ☀️/🌙 toggle for light. Colour per category. |
| Streak + no-spend day | 🔥 days in a row logged; "Spent nothing?" keeps the streak alive. |
| Mood line + fun facts | Today vs your usual day; most repeated buy, biggest day, no-spend days. |

## v1 — budget, bills, savings (built)
| Feature | Detail |
|---|---|
| Monthly budget | Home card: big "left this month" + spent of budget, ? explainer. Breakdown (saved, kept for bills, free per day) on the Plan tab. |
| Coming up | Bills (monthly) + must-buys (one-time) kept aside until paid; typing "199 netflix" pays it. |
| Savings goals | Any amount, any month, out of that month's budget; progress + months-to-go; "Bought it". |
| Summary + AI | Monthly receipt and AI summary include budget, saved and left. |

## Later, only if actually wanted
Best candidates first:
- Split in the input: `1200 dinner /3` saves ₹400 (your share).
- Search across all entries ("zomato": how often, how much).
- Monthly budgets per category.
- Recurring entries (rent, subscriptions).
- Android "share to app" from GPay/PhonePe receipts.
- Daily reminder — needs a push server; until then, use a phone alarm.

## Cut on purpose
Voice input (use the keyboard's mic), bill splitting, income/investments, accounts and
cloud sync, multi-currency, CI, rate-limit storage, install guide with pictures.

## Tech
- React + Vite, plain CSS, Dexie (IndexedDB), vite-plugin-pwa, Vitest for parser tests.
- `api/ai.js` — server-side AI handler that calls Groq (or Claude). Served at `/api/ai` by
  `netlify/functions/ai.mjs` on Netlify and by the Vite dev server locally.
- Dark theme by default, ☀️/🌙 toggle for light (remembered per phone). Font: Bricolage Grotesque, bundled so it works offline.
- Money stored as whole paise (integers). Dates stored as local `YYYY-MM-DD`.

## Status (Oct 19, 2026)
v0 + v1 (budget, bills, savings goals) are **live** at https://expense-track-kar.netlify.app (code: https://github.com/MKeshav04/expense-track-kar).
Adding, editing, deleting with undo, keyword learning, streaks, summaries, settings, backup, offline,
and both AI features (Groq) all work, including on the live site.
The app is called **Kharcha** (full name "Kharcha — Expense Track-kar"). Full details: [DOCS.md](DOCS.md).

## Running it
```
npm install
npm run dev        # local; also prints a Network URL to open on your phone over Wi-Fi
npm test           # 52 tests (parser + budget maths)
```
For AI locally: copy `.env.example` to `.env.local` and fill in `GROQ_API_KEY`, then restart `npm run dev`.
Deploy (Netlify): push to GitHub → Netlify → Add new project → Import from Git → pick the repo
(build settings come from `netlify.toml`) → add `GROQ_API_KEY` under Environment variables → deploy.
Don't use drag-and-drop deploy: it skips the AI function.
On the phone: open the link → Android: menu → Install app; iPhone: Safari → Share → Add to Home Screen.

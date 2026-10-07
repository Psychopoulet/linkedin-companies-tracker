# LinkedIn Company Tracker

> ⚠️ **Disclaimer: this project was quickly vibe-coded. It is NOT a quality project.**
> Expect rough edges, missing tests, fragile DOM selectors (LinkedIn changes its markup often) and no guarantees of maintenance. Use at your own risk.

Chrome extension (Manifest V3) to keep track of LinkedIn companies and flag them with **indicators** (wanted, IT services company, headhunter, suspect, banned, ...). Flagged company names are highlighted directly on LinkedIn pages, with a tooltip.

All data is stored locally in your browser (`chrome.storage.local`). Nothing is sent to any server.

## Installation

```bash
npm install
npm run build
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `lib/dist/` folder

## Development

```bash
npm run build
```

Webpack writes the extension into `lib/dist/`. Reload it in `chrome://extensions` after each build.

```bash
npm run zip
```

Packages `lib/dist/` into `lib/build/`. Run `npm run build` first.

## Supported pages

| Page | Behavior |
|------|----------|
| `/company/{code}/` | Highlighted name + tooltip, or a **+** button to add the company |
| `/jobs/search/` and `/jobs/search-results/` | Highlighted company names (list + detail) + tooltip |
| `/jobs-tracker/` | Highlighted company names in the job tracker + tooltip |
| `/jobs/view/` | Highlighted company name + tooltip |

## Features

- Persistent local list (`chrome.storage.local`)
- Popup: add, edit, delete, search, filter by indicator
- JSON import / export
- Automatic sync between open LinkedIn tabs
- LinkedIn SPA navigation support (pushState, DOM mutations)

## Indicators

A company can have several indicators. The displayed color is the one of the most critical indicator.

| Icon | Code | Criticity | Description |
|------|------|-----------|-------------|
| ✅ | `WANTED` | OK (green) | Wanted company |
| 💵 | `SALARY_AND_ADVANTAGES` | GOOD (green) | Shows salary and benefits |
| 💼 | `IT_SERVICES_COMPANY` | INFO (blue) | IT services company (ESN / SSI) |
| 👨‍💼 | `HEADHUNTER` | INFO (blue) | Recruiter / placement agency |
| 💸 | `WITHOUT_SALARY_NOR_ADVANTAGES` | WARNING (yellow) | Does not show salary or benefits |
| ⚠️ | `SUSPECT` | WARNING (yellow) | Suspect company |
| ❌ | `BANNED` | DANGER (red) | Company to avoid |
| 🚫 | `DONT_ANSWER` | DANGER (red) | Never answers |
| ⚠️ | `FREELANCE` | WARNING (yellow) | Freelance |

Indicators are defined in [`lib/src/types/indicator.ts`](./lib/src/types/indicator.ts).

## Manual testing

1. Add a company via the popup (e.g. `capgemini`, indicator `IT_SERVICES_COMPANY`)
2. Open `linkedin.com/company/capgemini/` → name is highlighted, tooltip on hover
3. Open a jobs search containing Capgemini → company names are highlighted (list + detail)
4. Change the indicators in the popup → LinkedIn tabs update automatically
5. Close and reopen Chrome → the list is kept

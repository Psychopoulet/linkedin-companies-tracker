# LinkedIn Company Tracker

> **Disclaimer: this project was quickly vibe-coded. It is not a polished product.**
> LinkedIn changes its markup often, and the DOM selectors are fragile. Unit tests cover the manifest and the company model, not the page scrapers. There is no guarantee of maintenance. Use at your own risk.

Chrome extension (Manifest V3, version 1.2.2) to keep track of LinkedIn companies and flag them with **indicators** (wanted, IT services company, headhunter, suspect, banned, ...). Flagged company names are highlighted directly on LinkedIn pages, with a tooltip.

All data stays in the browser (`chrome.storage.local`, key `companyRegistry`). Nothing is sent to a server.

The popup and the LinkedIn pages send a message to the service worker. The worker reads or writes the registry, then tells open LinkedIn tabs to redraw.

## Requirements

Node.js `>= 22.23.3` (see `engines` in `package.json`).

## Installation

```bash
npm install
npm run build
```

`npm run build` compiles the extension into `lib/dist/` and packages that folder into `lib/build/`.

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `lib/dist/` folder

## Development

```bash
npm run build-back
```

Webpack writes the extension into `lib/dist/`. Reload it in `chrome://extensions` after each build.

```bash
npm run build-zip
```

Packages an existing `lib/dist/` into `lib/build/`. `npm run build` already runs this step.

```bash
npm run unit-tests
```

Runs the Mocha tests (`test/`). `npm run tests` also runs lint, engine checks, and a full build.

## Supported pages

| Page | Behavior |
|------|----------|
| `/company/{code}/` | Highlighted name + tooltip when the company has at least one indicator. Otherwise a **+** button opens an add dialog (including a saved company with an empty indicator list). |
| `/jobs/search/` and `/jobs/search-results/` | Highlighted company names (list + detail) + tooltip. No **+** button. Nothing is drawn when the registry is empty. |
| `/jobs-tracker/` | Highlighted company names in the job tracker + tooltip. The detail panel is skipped. |
| `/jobs/view/` | Highlighted company name + tooltip. |

Content scripts match `https://www.linkedin.com/company/*`, `/jobs/search/*`, `/jobs/search-results`, `/jobs/search-results/*`, `/jobs/view/*`, `/jobs-tracker`, and `/jobs-tracker/*`.

## Features

- Persistent local list (`chrome.storage.local`)
- Popup: add, edit, delete, search, filter by indicator
- JSON import / export (import **replaces** the current list)
- Automatic sync between open LinkedIn tabs
- LinkedIn SPA navigation support (`pushState`, `replaceState`, `popstate`, DOM mutations)

## Indicators

A company can have several indicators. The displayed color is the one with the **highest criticity order**, not the one that reads as the most severe. `OK` is last, so `WANTED` wins over `BANNED`: a company that has both is shown in green.

| Order | Criticity | Color |
|------:|-----------|-------|
| 0 | `GOOD` | `#16a34a` green |
| 1 | `INFO` | `#009dcf` blue |
| 2 | `WARNING` | `#ca8a04` yellow |
| 3 | `DANGER` | `#dc2626` red |
| 4 | `OK` | `#16a34a` green |

| Icon | Code | Criticity | Description |
|------|------|-----------|-------------|
| ✅ | `WANTED` | OK | Desired company |
| 💵 | `SALARY_AND_ADVANTAGES` | GOOD | Shows salary and benefits |
| 💼 | `IT_SERVICES_COMPANY` | INFO | IT services company |
| 👨‍💼 | `HEADHUNTER` | INFO | Recruiter / staffing agency |
| 💸 | `WITHOUT_SALARY_NOR_ADVANTAGES` | WARNING | Does not show salary or benefits |
| ⚠️ | `SUSPECT` | WARNING | Suspicious |
| ❌ | `BANNED` | DANGER | Company to avoid |
| 🚫 | `DONT_ANSWER` | DANGER | Does not reply |
| ⚠️ | `FREELANCE` | WARNING | Freelance |

`SUSPECT` and `FREELANCE` share the same icon. Indicators are defined in [`lib/src/types/indicator.ts`](./lib/src/types/indicator.ts).

## Import / export

Export downloads `linkedin-companies-YYYY-MM-DD.json` (format version 2):

```json
{
  "version": 2,
  "exportedAt": "…",
  "companies": []
}
```

Companies are normalized, then sorted by criticity rank, then by name (`fr` locale).

Import accepts three shapes: a raw array, `{ "companies": [ ... ] }`, or an object whose values are companies with `linkedinCode`. Legacy fields are still read: `status` becomes `indicators`, `reason` becomes `comment`, and old French labels (`banni`, `esn`, `suspect`, `désiré`, `desire`) map to the current codes. One unreadable indicator fails the whole file. The popup asks for confirmation before replacing the current list. Drop a `.json` file on the popup, or use the Import button.

## Manual testing

1. Add a company via the popup (e.g. `capgemini`, indicator `IT_SERVICES_COMPANY`)
2. Open `linkedin.com/company/capgemini/` → name is highlighted, tooltip on hover
3. Open a jobs search containing Capgemini → company names are highlighted (list + detail)
4. Change the indicators in the popup → LinkedIn tabs update automatically
5. Close and reopen Chrome → the list is kept

## Source layout (`lib/src`)

Webpack compiles `lib/src` into `lib/dist`. The popup HTML has no `<script>` tag in source: HtmlWebpackPlugin injects `popup.js`.

### Root

#### `manifest.json`

Declares the extension (version kept in sync with `package.json`).

- Single permission: `storage`.
- Host access limited to `https://www.linkedin.com/*`.
- Service worker: `background/service-worker.js`.
- Toolbar click: popup `popup/index.html`.
- Two content scripts, both with `styles/content.css`:
  - `content/linkedin-company.js` on company pages
  - `content/linkedin-jobs.js` on job search, job view, and the job tracker

#### `messages.ts`

Contract between the popup, the content scripts, and the service worker.

| Message | Effect |
|---|---|
| `GET_REGISTRY` | Read the registry |
| `ADD_COMPANY` | Add a company (same LinkedIn code overwrites) |
| `UPDATE_COMPANY` | Update an existing company |
| `DELETE_COMPANY` | Delete by LinkedIn code |
| `IMPORT_REGISTRY` | Replace the whole list |

Each response is `{ ok: true, registry }` or `{ ok: false, error }`. `REGISTRY_UPDATED` is what the service worker sends so LinkedIn tabs reload the registry.

### `types/`

Data model. No Chrome APIs, no DOM.

#### `types/indicator.ts`

Indicator catalog and criticity.

- `getIndicators` sorts from lowest order to highest.
- `getIndicatorByCode` looks up a code.
- `sortIndicatorsByCriticityDesc` sorts a list of codes from highest order to lowest.
- `getIndicatorsColor` returns the color of the highest-order indicator.
- `formatIndicatorLabel` produces `CODE — description`.
- `stripLeadingIndicatorIcon` removes icons already prepended to a name (the highlighter writes them into the page text).

#### `types/company.ts`

A company has a `linkedinCode` (URL slug, e.g. `capgemini`), a `name`, an `indicators` array, and an optional `comment`. The registry is a dictionary keyed by that code.

`normalizeLinkedinCode` lowercases the code and strips a trailing slash. `companyLinkedinUrl` rebuilds `https://www.linkedin.com/company/{code}/`.

Normalization also accepts the legacy shape described in [Import / export](#import--export). `normalizeRegistry` rewrites the registry and reports whether it changed, so storage can persist the migration.

`companySortRank` is the index of the highest-order indicator in `getIndicators()`. Lists sort by that rank, then by French name, so `GOOD` companies come first and `WANTED` last. `formatCompanyPopupDetail` joins indicator descriptions and the note for the tooltip and the popup. `isValidCompany` requires a code, a name, recognized indicators, and a comment that is either absent or a string.

### `storage/`

#### `storage/constants.ts`

One constant: `REGISTRY_STORAGE_KEY = "companyRegistry"`.

#### `storage/import-export.ts`

JSON import and export, version 2. See [Import / export](#import--export).

### `background/`

#### `background/service-worker.ts`

Listens to `chrome.runtime.onMessage`, delegates to `storage.ts`, and sends the response. `return true` keeps the channel open for the promise.

After an add, update, delete, or import, it broadcasts `REGISTRY_UPDATED` to LinkedIn tabs. It also listens to `chrome.storage.onChanged`, so a write from anywhere still notifies those tabs. On install it logs a message.

#### `background/storage.ts`

The real `chrome.storage.local` access.

- `getRegistry` reads the registry, normalizes it, and writes it back when the shape changed.
- `addCompany` overwrites the entry for the same LinkedIn code.
- `updateCompany` throws `Company not found` when the code is missing.
- `deleteCompany` removes the key.
- `replaceRegistry` replaces the whole list (used by import).
- `broadcastRegistryUpdate` sends `{ type: "REGISTRY_UPDATED" }` to every `https://www.linkedin.com/*` tab. A tab with no content script is ignored.

### `content/`

Scripts injected into LinkedIn. LinkedIn is a SPA: the DOM changes without a full page load.

#### `content/linkedin-company.ts`

Entry for `/company/{code}/`.

On load it subscribes to the registry, loads it, then paints the page. Every registry or DOM change runs `applyCompanyPage` again.

If the company is tracked and has at least one indicator, the title is highlighted. Otherwise a **+** button is appended. The click opens the add dialog, prefilled with the name and code read from the page, and with a comment already stored if any. While the dialog is open, the scan leaves the DOM alone.

#### `content/linkedin-jobs.ts`

Entry for job search, `/jobs/view/`, and `/jobs-tracker/`.

Same init cycle as the company page. An empty registry does nothing.

For each job card:

- **Job tracker**: the `Company · location` line is found, the name is wrapped in a `<span>`, then highlighted.
- **Search results**: SDUI markup first (LinkedIn's newer DOM), then a text match against the registry, then the older card selectors.
- **Other job pages**: a company-name selector, then resolution by a `/company/` link or by name.

The right-hand detail panel is handled separately, except on the job tracker. Highlighting happens only for companies already in the registry.

#### `content/shared/registry-client.ts`

In-tab cache of the registry.

`loadRegistry` sends `GET_REGISTRY`. `initRegistryListeners` reacts to `REGISTRY_UPDATED` (reload from the worker) and to `chrome.storage.onChanged` (apply the new value directly). `onRegistryChange` subscribes pages to that cache. `getCachedRegistry` returns it without waiting.

#### `content/shared/messaging.ts`

`sendMessage`: a typed `chrome.runtime.sendMessage`.

#### `content/shared/page-scanner.ts`

Detects LinkedIn navigations and DOM mutations.

A `MutationObserver` on `document.body` (`childList` + `subtree`) calls the scan function, debounced by 300 ms. `popstate`, `pushState`, and `replaceState` are hooked as well, because LinkedIn changes the URL without reloading.

#### `content/shared/debounce.ts`

Delays a call and cancels the previous one. Used only by the scanner.

#### `content/shared/highlighter.ts`

Highlight and tooltip.

`applyCompanyHighlight` skips the element when it already has the same code and indicators (`data-li-tracker-applied`). Otherwise it clears the previous state, adds `li-tracker--highlighted`, sets the CSS variable `--li-tracker-color`, and inserts the icons before the name.

One shared tooltip `div` is positioned under the element on hover or focus, and repositioned on scroll and resize. Listeners are tied to an `AbortController` per element, so a new highlight or a cleanup removes them.

`createAddButton` builds the company-page **+** button. `clearHighlights` removes highlights, icons, and add buttons.

#### `content/shared/modal.ts`

"Add a company" dialog, injected into the LinkedIn page (not the popup).

Name and code are read-only. Indicators are toggle buttons (`aria-pressed`), because LinkedIn restyles injected native checkboxes and makes them unusable. The comment is editable. Focus is forced onto it several times, because LinkedIn takes focus back on the next tick.

Save sends `ADD_COMPANY`. On success the dialog closes and `onSaved` rescans the page.

#### `content/shared/dom-utils.ts`

Company-page helpers.

`getLinkedinCodeFromUrl` reads the slug from the current URL. `isCompanyPage` is true when a code is present. `findCompanyTitleElement` tries several `h1` selectors, then falls back to `main h1`. `getCompanyNameFromElement` clones the title and removes the **+** button before reading the text.

#### `content/shared/linkedin-url.ts`

Extracts a company code from a pathname (`/company/capgemini/...`) or an `href`, then normalizes it. Relative links are resolved against the page origin.

#### `content/shared/dom-query.ts`

`queryAllDeep` and `queryDeep` run `querySelector` and also walk shadow roots. LinkedIn uses them; a plain `querySelector` does not see inside. `collectShadowRoots` lists those roots.

#### `content/shared/job-dom-utils.ts`

Largest file. It finds a company name across very different LinkedIn DOMs, then matches it to the registry.

`findCompanyByName` ignores case, accents, and repeated spaces, and strips an indicator icon already present in the text.

Page checks: `isJobsSearchResultsPage`, `isJobsTrackerPage`, `isJobsPage`.

Cards:

- `findJobCards` picks the strategy from the current page.
- On search results, left-list cards are separated from the right-hand detail panel (`findListJobCardsExcludingDetail`).
- `keepInnermostCards` keeps only the innermost card when several ancestors match.

Name lookup, from the most reliable signal:

1. An `a[href*="/company/"]` link and the code taken from the URL.
2. Historical selectors (`.job-card-container__company-name`, `.base-search-card__subtitle`, and others).
3. SDUI cards: a short paragraph just before the location line (`findCompanyInSduiCard`).
4. The line right after the job title, skipping location, "remote", "2 days ago", and similar meta.
5. A walk of text nodes for an exact match against a registry name.

Filters drop text that is not a company name: location, meta ("viewed", "early applicant"), job titles (`engineer`, `developer`, ...).

Special cases:

- `findCompanyInSearchResultsDetail` and `findCompanyInJobDetailPanel` target the right-hand panel, including links whose `aria-label` starts with "Entreprise".
- `findCompanyInJobsTrackerCard` reads a line such as `Capgemini · Paris`.
- `wrapCompanyNamePrefix` splits the text node so only the name is highlighted, not the location.

### `popup/`

Toolbar popup. Fixed width 380 px.

#### `popup/index.html`

Search, indicator filter, import/export (buttons and file drop), add/edit form (name, code, indicators, comment), and the list with a count and an empty state.

#### `popup/popup.ts`

On startup it fills the filter and the checkboxes from `getIndicators()`, then loads the registry.

The list is filtered by text (name or code) and by indicator, and sorted like the export. Each row shows the icons, the name (a link that opens the LinkedIn tab), the code, a badge of the codes, the detail (descriptions + note), and Edit / Delete. The name color is the highest-order indicator color.

The form is in add or edit mode. In edit mode the LinkedIn code is locked. Submit sends `ADD_COMPANY` or `UPDATE_COMPANY`. Delete asks for confirmation.

`chrome.storage.onChanged` refreshes the list when a LinkedIn page or another popup changes the registry. If the company being edited disappears, the form returns to add mode.

#### `popup/popup.css`

Popup layout: gray background, white cards, blue / gray / red buttons, indicator chips, drop-zone highlight.

### `styles/`

#### `styles/content.css`

Styles injected into LinkedIn, separate from the popup so they do not depend on LinkedIn class names.

- Highlighted text uses `--li-tracker-color`, bold, with `!important` so it wins over LinkedIn CSS.
- Icons keep their emoji color.
- The tooltip is fixed, dark, above almost everything (very high `z-index`), and ignores the pointer.
- The **+** button is a blue circle.
- The dialog is a full-screen veil and a white panel. Pressed indicators (`aria-pressed="true"`) use a light blue background.

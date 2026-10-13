# Price Watch

A crowdsourced cost-of-living tracking app built for the Congressional App Challenge (FL-15). Users log real-world prices they see for gas and common grocery staples, tagged with location and time — individually a personal price tracker, collectively a live local price index.

**Try it live:** https://price-watch-a3689.web.app — opens in any phone or desktop browser, no install needed. Sign up with any email to get started. (The web version has everything except the interactive map and vibration feedback, which need the phone app.)

## What it does

- **Log a price in seconds** — search for the exact product by name or scan its barcode, pick the store you bought it at from a list of real nearby stores, and enter what you paid and how much you got.
- **See if you got a good deal** — every price is normalised (per gallon, per pound, per item) and compared against the local average from other users and the official national average from the U.S. Bureau of Labor Statistics.
- **Find the cheapest option near you** — "Find Cheapest Near Me" ranks recent verified reports for an item within 20 miles.
- **Map and dashboard** — a map of recent community-reported prices, and a dashboard charting your own prices over time with local-vs-national context.
- **Light and dark mode**, haptic feedback, and a small celebration when you log a price.

### Keeping the data honest

A crowdsourced price index is only useful if people can't flood it with made-up numbers, so every entry passes through several checks:

1. **National-average bounds** — a price more than 5× or less than ⅕ of the official BLS national average for that item is rejected before it's saved (`src/utils/priceSanity.ts`).
2. **Outlier detection** — a price more than 3 standard deviations from recent verified prices in the same zip code is flagged and kept out of averages (`src/services/dataQualityService.ts`).
3. **Corroboration** — an entry only counts as *verified* once other users have recently reported a similar price nearby. Only verified entries feed local averages and the cheapest-nearby list.
4. **Database rules** — Firestore security rules (`firestore.rules`) check the shape and value ranges of every write, even ones that bypass the app.

Checks 1–3 run in the app rather than on a server (the project stays on Firebase's free plan, which has no Cloud Functions), so a determined, technically skilled user could still get around them — they stop casual and accidental bad data, not a dedicated attacker.

## Tech stack

- **Frontend:** React Native + Expo (managed workflow), TypeScript
- **Backend:** Firebase — Firestore (database) + Auth (email/password), on the free **Spark** plan (see "Why no Cloud Functions or photo uploads?" below)
- **Navigation:** React Navigation (bottom tabs + native stack)
- **Maps:** react-native-maps
- **Charts:** react-native-chart-kit
- **Location:** expo-location
- **Barcode scanning:** expo-camera
- **Web hosting:** Firebase Hosting (the same app, exported for the browser with react-native-web)

## Data sources

- **[Open Food Facts](https://world.openfoodfacts.org)** — product search and barcode lookup (open database, [ODbL](https://opendatacommons.org/licenses/odbl/)).
- **[OpenStreetMap](https://www.openstreetmap.org/copyright)** via the Overpass API — nearby store names and addresses. © OpenStreetMap contributors, [ODbL](https://opendatacommons.org/licenses/odbl/).
- **[U.S. Bureau of Labor Statistics](https://www.bls.gov/cpi/)** — official national average prices and price trends (Public Data API).

## Getting started (for teammates)

1. **Install Node.js** (LTS) if you don't have it: https://nodejs.org
2. **Clone the repo**, then install dependencies:
   ```
   npm install
   ```
3. **Get the Firebase config** from whoever set up the project (it's not committed to git) and create a `.env` file in the project root matching `.env.example`'s shape, filled in with the real values.
4. **Run the app:**
   ```
   npx expo start
   ```
   Scan the QR code with the **Expo Go** app on your phone (iOS or Android).

   > **Expo Go on iPhone (SDK 57+)** only opens a project when Expo Go is logged in to the *same Expo account* as the terminal running `npx expo start` ([Expo changelog](https://expo.dev/changelog/expo-go-57-login)). To let other people try the app without your account, share the hosted web version instead (see "Deploying the web version" below). Add `--tunnel` if your phone isn't on the same Wi-Fi as your computer.

   > **Windows PowerShell users:** if you get a "running scripts is disabled" error, use `npx.cmd expo start` instead of `npx expo start`.

## Project structure

```
src/
  screens/        Full-screen views (one per tab, plus screens/auth/ for login/signup/onboarding)
  components/      Reusable UI pieces (buttons, cards, modals)
  navigation/      React Navigation setup (tab navigator, auth stack, root branching logic)
  context/         App-wide state via React Context (AuthContext, SettingsContext, ThemeContext)
  services/        Firebase/Firestore calls, location handling, data-quality checks
  hooks/           Custom hooks wrapping live Firestore listeners
  constants/       Static data: category list, theme colors, BLS reference figures, context cards
  utils/           Small pure helper functions (validation, stats, time formatting)
  types/           Shared TypeScript types
```

## Deploying the web version

The live site is a static export of the app served by Firebase Hosting (free on the Spark plan). After making changes:

```
npx expo export --platform web
npx firebase deploy --only hosting
```

`expo export` writes the site to `dist/` (git-ignored) using the values in your `.env`; `firebase.json` serves that folder. Everyone who opens the link gets the new version immediately.

## Firestore security rules and indexes

`firestore.rules` (who can read/write what) and `firestore.indexes.json` (the composite indexes queries need) are the source of truth. Deploy them with:

```
npx firebase deploy --only firestore:rules
npx firebase deploy --only firestore:indexes
```

> **Why `firebase.json` looks unusual:** this project's Firestore database is a *named* database called `default`, not Firestore's special `(default)` database. `firebase.json` sets `"database": "default"` so the CLI targets it. Without that, the CLI assumes `(default)`, tries to create it, and fails with a misleading "requires billing to be enabled" error. Same reason `src/services/firebase.ts` passes `'default'` as the third argument to `initializeFirestore` — remove it and the app silently reads zero documents and hangs on writes.

If a query ever fails with a "requires an index" error, add the index to `firestore.indexes.json` and redeploy rather than clicking the console link, so the index stays in version control for your teammates.

## A few things worth knowing

- **No photo uploads, no Cloud Functions.** The project intentionally stays on Firebase's free plan. Outlier detection and corroboration checks (normally a server-side job) run client-side instead — see comments in `src/services/dataQualityService.ts`.
- **The map works in Expo Go with zero setup**, but will need a real Google Maps API key configured in `app.json` before any production Android build (Expo Go ships its own dev key; standalone builds don't get it for free).
- **Indexes are version-controlled**, so a fresh clone shouldn't hit "requires an index" errors — but if you write a new query shape, add its index to `firestore.indexes.json` and redeploy (see above).
- **Where a price was seen** is the store the user picks from real nearby stores (OpenStreetMap), or one they type in if the map is missing it. Store lookups retry and fall back to a mirror server, because the free Overpass service is often overloaded — see `src/services/storeService.ts`.
- **Products vs. categories.** Users log an exact product (from Open Food Facts), and each product is mapped to one of **47 categories** (`src/constants/categories.ts`) so everyone's entries for the same kind of item can be averaged and compared against the national figure. Search results are filtered to English names that actually match the query — see `src/utils/productSearch.ts`.

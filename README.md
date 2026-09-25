# Price Watch

A crowdsourced cost-of-living tracking app built for the Congressional App Challenge (FL-15). Users log real-world prices they see for gas and common grocery staples, tagged with location and time — individually a personal price tracker, collectively a live local price index.

## Tech stack

- **Frontend:** React Native + Expo (managed workflow), TypeScript
- **Backend:** Firebase — Firestore (database) + Auth (email/password), on the free **Spark** plan (see "Why no Cloud Functions or photo uploads?" below)
- **Navigation:** React Navigation (bottom tabs + native stack)
- **Maps:** react-native-maps
- **Charts:** react-native-chart-kit
- **Location:** expo-location

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

   > **Windows PowerShell users:** if you get a "running scripts is disabled" error, use `npx.cmd expo start` instead of `npx expo start`.

## Project structure

```
src/
  screens/        Full-screen views (one per tab, plus screens/auth/ for login/signup/onboarding)
  components/      Reusable UI pieces (buttons, cards, modals)
  navigation/      React Navigation setup (tab navigator, auth stack, root branching logic)
  context/         App-wide state via React Context (AuthContext, SettingsContext)
  services/        Firebase/Firestore calls, location handling, data-quality checks
  hooks/           Custom hooks wrapping live Firestore listeners
  constants/       Static data: category list, theme colors, BLS reference figures, context cards
  utils/           Small pure helper functions (validation, stats, time formatting)
  types/           Shared TypeScript types
```

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
- **Where a price was seen** is captured as a street address, auto-derived from the reverse-geocode already used to get the zip code. There are no store names in the data — "cheapest nearby" shows addresses, not "Publix". Adding real store names would mean adding a field to the logging flow.
- **42 price categories**, not just the original 5 — deliberately a fixed list (not free text) so everyone's entries for the same item can be meaningfully averaged together. See `src/constants/categories.ts`.

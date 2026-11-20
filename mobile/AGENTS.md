This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## This project (HFarm customer app)

- **JavaScript, not TypeScript**: files are `.js` (no `tsconfig.json`, no `.tsx`); the `@/` import alias points to `src/` (see `jsconfig.json`). Package manager is **npm** (`package-lock.json`, no `bun.lock`).
- Expo SDK 58, React Native 0.88, Expo Router, React Query. **Node >= 22.13 is required** (`nvm use 24.14.0` on the dev machine; the default PATH Node is v20).
- UI text and error messages are **Vietnamese with diacritics**; money is shown as `1.250.000 ₫` via `src/utils/format.js`.
- Config comes from `mobile/.env` (`EXPO_PUBLIC_*`, see `.env.example`). These values are bundled into the app: never put secrets there. After editing `.env`, restart with `npx expo start --clear`.
- Auth: `EXPO_PUBLIC_AUTH_MODE=dev` (default, sends `X-Dev-Role: customer`, backend must have `AUTH_ENABLED=false`) or `keycloak` (public client `hfarm-mobile`, PKCE, in-app email + password form). Details in `README.md`; project-wide rules in `../CLAUDE.md` and `../docs/`.
- There is no automated test suite, no lint and no typecheck configured in this repo (see Commands below).

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present). This project uses npm, so use `npx`.

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server (add --clear after editing .env)
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
npx expo export             # bundle Android + iOS to verify the app still compiles
```

- **Do not run `npx expo lint` or `npx tsc --noEmit`**: neither is set up here. `expo lint` installs eslint on its own and edits `package.json` (adds a `lint` script and eslint packages), and there is no TypeScript config. If it was run by mistake, revert with `npm uninstall` of the packages it added and delete `eslint.config.js`.
- Before declaring a task done, run `npx expo-doctor` and `npx expo export`, and say plainly what was and was not tested (there is no test suite, and nothing has been tried on a real phone / Expo Go yet).

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.js` files define navigators (`src/app/_layout.js`, `src/app/(tabs)/_layout.js`). Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples. (This repo has no `eas.json` and no EAS build is recorded; release builds need HTTPS for the API and Keycloak, see `README.md`.)
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

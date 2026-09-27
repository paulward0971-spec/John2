# AIB Demo Prototype — Home-Screen App Polish


## Later changes (Jun 2026, session 2)
- Owner recovery added: master recovery code (POST /api/gate/recover-owner,
  /api/gate/admin/set-recovery); admin PIN now self-promotes device to owner
  (no more "not owner"). Admin PIN reset to 9876; recovery code 'recover-john'.
- Cards screen now shows the user's EXACT uploaded card art
  (assets/images/card-user.png), replacing the SVG card. Freeze overlay kept.
- Home header uses a smoother glossy purple wave (components/header-swoosh.tsx).
- "Pay with Zippay" tile now navigates to /transfer/new (Send money).
- Email receipts remain DISABLED (bank-impersonation guardrail); a de-branded
  "mock" receipt was offered as the compliant alternative (not yet enabled).


## Restore + changes (Jun 2026)
- Re-imported the Expo/FastAPI/Mongo project into this pod. Added a missing
  `frontend/babel.config.js` (babel-preset-expo + react-native-worklets/plugin)
  that was causing frozen animations / blank screens.
- Web screen transitions set to `animation: "none"` (native phone app unchanged).
- Backend env: `EMERGENT_LLM_KEY` (Abi/Claude), `MONGO_URL`, `DB_NAME`.
- SAFETY: outbound bank-branded ("AIB") confirmation emails are DISABLED
  (`EMAIL_ENABLED = False` in server.py) — impersonating a real bank is a
  prohibited fraud/phishing pattern. All other endpoints still function.
- Chat (Abi) screen redesigned: cleaner header w/ avatar + online status,
  tidy user/assistant bubbles, timestamps, light **bold**/bullet markdown,
  animated typing dots. Same AIB purple palette + same splash/load-up.
  Conversation now persists per session (loads history on open); web `?sid=`
  deep-link supported.

## Current state
Working AIB banking demo (Expo Router + FastAPI + MongoDB) that installs as a
real-feeling PWA via iOS/Android "Add to Home Screen". Includes:

- **Custom splash** using the user's own AIB artwork
  (`assets/images/splash-user.png`) with a soft fade-in on mount and a 2.2 s
  hold before a smooth fade into the passcode screen.
- **Face ID / Fingerprint unlock** (opt-in):
  - On the first successful PAC entry we ask "Sign in faster with
    Face ID / Fingerprint?" — if the user accepts we store the preference in
    secure storage and auto-prompt biometric on future launches.
  - A "Face ID" / "Fingerprint" pill on the PAC footer re-triggers it.
  - A **Settings → Security** toggle turns it on/off any time.
  - Web builds gracefully skip biometrics (no browser API for it).
- **Live balance** — profile now seeds with a €3,500 starting balance and
  each confirmed SEPA transfer deducts from `balance_cents` /
  `available_cents` (already wired in `POST /api/transfers/confirm`). The
  Home screen refetches profile + transactions on every focus so the balance
  shifts the second a transfer completes.

## Env in this workspace
- `EXPO_PUBLIC_BACKEND_URL=https://aib-clean-demo.preview.emergentagent.com`
- `MONGO_URL=mongodb://localhost:27017`, `DB_NAME=aib_demo_database`
- Managed keys: `EMERGENT_EMAIL_KEY`, `EMERGENT_LLM_KEY` (Claude Sonnet 4.6
  for the "Abi" digital assistant).

## Test credentials
- **Passcode / PAC**: any 6 digits unlock (demo). `1 2 3 4 5 6` is fine.
- Old default profile passcode `12345` is stored in Mongo but the PAC screen
  itself does not verify it (design demo).

## Known caveats
- Biometrics requires **native device** — Expo Go + real hardware, or a
  generated build. Won't fire in the web preview.
- Splash "wave" and logo are baked into `splash-user.png` (the user's asset)
  and rendered with `expo-image`. Replacing that PNG replaces the splash.

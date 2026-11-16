# Ako

Consumer mobile app that gamifies data labeling. Expo (expo-router, TypeScript) with a Convex backend, built and run on Revyl cloud devices.

## Develop

```bash
npm install
npx convex dev      # pushes convex/ to your dev deployment, writes .env.local
npx expo start
```

The app reads the Convex deployment from `EXPO_PUBLIC_CONVEX_URL`. The committed `.env` points at the shared dev deployment so cloud builds work without extra configuration; `.env.local` (written by `npx convex dev`, git-ignored) overrides it locally. The URL is public; deploy keys never go in the repo.

## Check

```bash
npx tsc --noEmit
npx expo lint
npx convex dev --once   # needs CONVEX_DEPLOY_KEY or a logged-in Convex CLI
npm test                # convex-test suite for cash-out (Whop is mocked)
```

## Cash-out (Whop)

Players cash out verified game credits from the Earnings screen. Ako's server sends USD from Ako's Whop company balance to the player's linked Whop balance; the player withdraws to a bank inside Whop. Rates, minimum, fee and the daily credit cap live in `convex/cashout/config.ts`.

Set these on the Convex deployment (`npx convex env set NAME value`), never in the app:

| Variable | Purpose |
|---|---|
| `WHOP_API_KEY` | Company API key with `payout:transfer_funds`, `payout:transfer:read` (and `company:balance:read` for the setup check) |
| `WHOP_COMPANY_ID` | Ako's `biz_` account id, the transfer origin |
| `WHOP_CLIENT_ID` / `WHOP_CLIENT_SECRET` | Whop OAuth app for Connect Whop; register `<CONVEX_SITE_URL>/whop/oauth/callback` as a redirect URI |
| `WHOP_ENVIRONMENT` | `sandbox` (default, no real money) or `production` |
| `CASHOUT_LIVE_TRANSFERS` | Must be `true` before production transfers run |
| `CASHOUT_DEMO` | `true` simulates cash-outs on stage: no Whop transfer is made, credits still reserve and settle, and the app labels every payout "Demo payout: no real money moves". Ignored when `WHOP_ENVIRONMENT=production` |
| `CASHOUT_ADMIN_KEY` | Unlocks the admin report at `/earnings/admin` |

Check credentials and permissions with `npx convex run cashout/whop:checkSetup`, list redemptions with `npx convex run cashout/admin:serverReport`, and re-drive a stuck one with `npx convex run cashout/whop:recheck '{"redemptionId":"..."}'`.

## Build for the iOS simulator (Revyl runner)

```bash
npm ci
npx expo prebuild --platform ios --clean
xcodebuild -workspace ios/ycapp.xcworkspace -scheme ycapp -configuration Release \
  -sdk iphonesimulator -derivedDataPath ios/build CODE_SIGNING_ALLOWED=NO -quiet
# -> ios/build/Build/Products/Release-iphonesimulator/ycapp.app
```

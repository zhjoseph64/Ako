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
```

## Build for the iOS simulator (Revyl runner)

```bash
npm ci
npx expo prebuild --platform ios --clean
xcodebuild -workspace ios/ycapp.xcworkspace -scheme ycapp -configuration Release \
  -sdk iphonesimulator -derivedDataPath ios/build CODE_SIGNING_ALLOWED=NO -quiet
# -> ios/build/Build/Products/Release-iphonesimulator/ycapp.app
```

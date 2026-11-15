# Build brief for Capy: Ako (platform shell)

**Ako** is a consumer iOS/Android app where players beat an AI in daily mini-games. Every round produces human data AI is missing. Ranked tiers multiply the points players earn, and points convert to cash.

## Status: the games already exist. Do not rebuild them.

- **PR #1 `stack-setup`**: Expo SDK 58 + expo-router (`src/app`) + TypeScript + Convex, plus the game **Unpredictable** (`src/app/unpredictable/`, `convex/unpredictable/`).
- **PR #2 `jailbreak-boss`** (stacked on #1): the game **Jailbreak Boss** (`src/app/jailbreak/`, `convex/jailbreak/`).

Merge #1, then #2, before starting. Follow their conventions: one folder per feature, tables prefixed and spread into `convex/schema.ts`, model calls only in Convex actions, anonymous device id identity (`src/unpredictable/device.ts`).

**Your job: build the platform around the two games.** That means the Home screen, rank and points progression, Profile, Wallet, Leaderboard and the rank ladder, matching the approved mockups. Keep each game's own look inside the game. Only touch game code to (a) award points/rating when a round ends and (b) add a back route to Home.

**Hackathon constraint:** must run on a real phone (Expo Go) for a live demo by 6:00 PM. Ship Home + progression first; everything else is polish.

---

## Design source of truth

`design/screens/*.dc.html` are the approved mockups (HTML with inline styles, 390 px phone screens). Open them in a browser. Match colors, spacing, radii and layout closely. In the mockups, "[APP NAME]" = **Ako**, "Gut Check" = **Unpredictable**, and "Breach" = **Jailbreak Boss**.

| Screen | Mockup | Route |
|---|---|---|
| Home (games-first, For you / Charts tabs) | `Main.dc.html` | `src/app/(tabs)/index.tsx` (replaces the ping-counter home) |
| Leaderboard | `Leaderboard.dc.html` | `src/app/(tabs)/leaderboard.tsx` |
| Wallet + cash-out sheet | `Wallet.dc.html` | `src/app/(tabs)/wallet.tsx` |
| Profile (rank card, animated RP bar, division stepper, Performance chart, avatar editor sheet) | `Profile.dc.html` | `src/app/(tabs)/profile.tsx` |
| Rank ladder | `Ranks.dc.html` | `src/app/ranks.tsx` |
| Game thumbnail art | `GameArt.dc.html` | `src/platform/GameArt.tsx` (react-native-svg) |
| Rank badge + full sheet | `Badge.dc.html`, `Badges.dc.html` | `src/platform/RankBadge.tsx` |

`GutCheck.dc.html` and `Breach.dc.html` are reference only. The real games are Unpredictable and Jailbreak Boss.

Rank badge images: `assets/badges/{tier}-{division}.png` (tier = echo, pattern, signal, variant, outlier, anomaly, paradox, singular; division = 1, 2, 3). The mockups reference them by blob URL; use these files instead. Add a soft pulsing glow behind the image.

### Tokens

- Background `#0B0B14`, surface `#15151F`, raised `#1B1A2B`, border `#23233A`
- Text `#F5F3FB`, secondary `#BDB9D0`, tertiary `#A7A3BC`, muted `#8F8BA6`, accent text `#D9CCFF`
- Up/positive `#79E2D6`, down/negative `#FF9A85`, rating line `#B9A6FF`, periwinkle `#8E9BF0`
- Primary CTA: pill, gradient `#F0A9DC → #B9A6FF → #9FD9E6`, dark text `#141120`
- Fonts: Space Grotesk (headings, big numbers), Inter (everything else) via `@expo-google-fonts`
- Radii: cards 20–24, pills 999. Page side padding 20. Touch targets ≥ 44.
- Bottom tabs: Home, Ranks (leaderboard), Wallet, Profile. Games open as full-screen stacks over the tabs.

### Ranks

| Tier | Rating | Points multiplier |
|---|---|---|
| Echo | 0–499 | 1.0x |
| Pattern | 500–999 | 1.1x |
| Signal | 1,000–1,499 | 1.25x |
| Variant | 1,500–1,999 | 1.4x |
| Outlier | 2,000–2,499 | 1.6x |
| Anomaly | 2,500–2,999 | 1.85x |
| Paradox | 3,000–3,499 | 2.2x |
| Singular | top 500 | 3.0x |

Each tier splits into divisions 1–3 (thirds of its range). RP 0–100 shows progress inside the division. New players start at 1,000 (Signal 1). 100 points = $1.00.

---

## Convex: `convex/platform/`

Tables (prefix `plat`, spread into `convex/schema.ts`):
- `platProfiles`: deviceId, name, avatar { color, frame, aura }, rating, points, cashedOutCents, streakDays, lastPlayedDay
- `platLedger`: deviceId, game ("unpredictable" | "jailbreak" | "leaderboard" | "cashout"), basePoints, multiplier, points, ratingDelta, note, createdAt (index by deviceId and createdAt)

Functions:
- `platform.award` (internal mutation): applies the tier multiplier to base points, updates rating, writes a ledger row and updates the streak. Call it from the existing games:
  - Unpredictable, when a round's result is final: base 120 per prompt the AI failed to predict; rating +6 per escape, −4 per predicted prompt.
  - Jailbreak Boss: partial break → base 80, rating +3; full break (boss defeated) → base 300, rating +12.
- `platform.me` (query): profile + derived tier, division, rp, multiplier, nextTier and pointsToNext.
- `platform.history` (query): rating and points over time from the ledger, for the Profile chart (ranges 1D/1W/1M/3M/ALL).
- `platform.leaderboard` (query): weekly points top 50 + my position. Seed 20 fake players so it looks alive.
- `platform.liveCounts` (query): players active in each game in the last 5 minutes, for the Home tiles and Charts tab.
- `platform.cashOut` (mutation): demo only. Writes a ledger row and reduces the balance. No real money.
- `platform.updateAvatar` (mutation).

---

## Build order (one Capy thread each)

1. **Shell + progression backend.** Tabs layout, fonts, tokens, `RankBadge`, `GameArt`, the `convex/platform` tables and functions, award hooks in both games, and a seed. Replace the ping-counter home with a basic Home that already links to both games.
2. **Home + Leaderboard**, matching `Main.dc.html` and `Leaderboard.dc.html`: points chip in the header, For you / Charts tabs, a live hero card for Jailbreak Boss, "Continue playing" for today's Unpredictable round, and a 2-column game grid. Only the two real games are playable; the other four tiles show "Coming soon".
3. **Profile + Ranks + Wallet**, matching the mockups: the animated RP bar (moving stripes, sheen, glowing tip with sparks), the division stepper, the Points/Rating chart with drag-to-scrub and tier lines, the avatar editor bottom sheet behind a pen button, and the cash-out sheet.

Threads 2 and 3 can run in parallel after 1 merges.

**Definition of done for each thread:** `npx tsc --noEmit` and `npx expo lint` pass, `npx convex dev --once` succeeds, it runs in Expo Go on a phone, and the PR lists what to tap to test it. If possible, also run the flow on a Revyl cloud device.

## Out of scope today

Real payments, real auth, App Store builds, the four non-playable games, and restyling the inside of either game.

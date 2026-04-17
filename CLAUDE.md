# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Start Expo dev server
npm start

# Run on iOS simulator
npm run ios

# Run on Android
npm run android

# Regenerate native iOS project (after app.json or plugin changes)
npx expo prebuild --platform ios --clean
cd ios && pod install

# Build for App Store (via EAS)
eas build --platform ios --profile production
```

There are no unit tests in this project.

## Architecture

**Entry point:** `index.ts` → registers `AppRoot` as the root component, registers the `react-native-track-player` playback service, and registers CarPlay.

**App shell flow (`AppRoot.tsx`):**
1. Requests ATT permission on iOS
2. Loads fonts and checks onboarding state
3. Shows `LoadingScreen` → `LoginScreen` (if no saved user) → `MainApp` (App.tsx)
4. Handles network offline state with a Czech-language retry screen

**Main app (`App.tsx`):** The primary radio player UI with station switching and points display.

**`src/` modules:**
- `stations.ts` — static list of radio station definitions (stream URLs, metadata)
- `storage.ts` — AsyncStorage wrapper for persisting `UserData` locally; also handles `syncWithRemote`
- `api.ts` — all backend calls to `https://astraradio.cz/api` (auth, sync, shop)
- `types.ts` — shared TypeScript interfaces (`UserData`, `RewardItem`, etc.)
- `config.ts` — points economy constants, `BADGE_TIERS` multiplier ladder, `SHOP_REWARDS`, and ad unit IDs
- `playbackService.ts` — `react-native-track-player` background service handler
- `carplayService.ts` — CarPlay integration
- `adService.ts` — LevelPlay/IronSource mediation (currently disabled for debugging in AppRoot)
- `SafeTrackPlayer.ts` / `SafeLevelPlay.ts` — null-safe wrappers around native modules
- `tiktok.ts` — TikTok Business SDK analytics
- `useListeningTracker.ts` — hook that awards points per minute of listening and triggers interstitial ads
- `reviewPrompt.ts` — session counter for App Store review requests

**Points system:** Users earn `POINTS_PER_MINUTE` (base 1) × their current multiplier (1.0–1.8x). Multipliers are unlocked permanently by reaching total listening hour thresholds defined in `BADGE_TIERS` (`config.ts`). Points can be spent in `ShopScreen.tsx` on ad-free passes and merch.

**Ad mediation:** Uses Unity LevelPlay (IronSource) as the mediation layer with Google AdMob and Meta Audience Network as adapters. Ad unit IDs and app IDs live in `config.ts`. Custom Expo config plugins in `plugins/` inject the native AdMob and LevelPlay adapter configs.

## iOS-specific notes

- Bundle ID: `cz.astraradio.radio`
- Background audio mode is declared in `UIBackgroundModes` (required for `react-native-track-player`)
- CarPlay scene delegate is configured in `UIApplicationSceneManifest`
- `ITSAppUsesNonExemptEncryption = false` (standard HTTPS only)
- ATT permission string (Czech): declared in `expo-tracking-transparency` plugin config
- After any `app.json` change, run `npx expo prebuild --platform ios --clean` then `pod install`

## Build pipeline

EAS Build (`eas.json`) is used for all production builds — `autoIncrement: true` bumps the build number automatically. Do not edit `ios/` native files directly; use Expo config plugins in `plugins/` instead.

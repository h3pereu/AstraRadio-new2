# CarPlay Support — Design Spec
Date: 2026-04-13

## Overview

Add CarPlay support to Astra Radio so users can switch between the three quality streams and see now-playing info on their car's display. The feature is implemented entirely in native Swift with a small bridge to JS — no new npm dependencies.

---

## Architecture

```
CarPlay vehicle display
        │
        ▼
CarPlaySceneDelegate.swift        ← new: manages CarPlay lifecycle
        │  CPListTemplate (stream picker)
        │  CPNowPlayingTemplate (now playing)
        │
        ▼
CarPlayBridge (native module)     ← new: ~30 lines Swift + JS
        │  switchStation(id: string)
        │
        ▼
react-native-track-player         ← existing: handles audio + MPNowPlayingInfoCenter
        │
        ▼
MPNowPlayingInfoCenter            ← existing: auto-syncs to CPNowPlayingTemplate
```

### New files
- `ios/AstraRadio/CarPlaySceneDelegate.swift` — CarPlay UI + scene lifecycle
- `ios/AstraRadio/CarPlayBridge.m` + `CarPlayBridge.swift` — native module bridge
- `src/carplayService.ts` — JS side: listens for `switchStation` events, calls TrackPlayer

### Modified files
- `ios/AstraRadio/Info.plist` — add `UIApplicationSceneManifest` + CarPlay scene config
- `ios/AstraRadio/AstraRadio.entitlements` — add `com.apple.developer.carplay-audio`
- `App.tsx` — register the carplayService event listener

---

## User Flow

1. Phone connects to CarPlay → `CarPlaySceneDelegate` presents `CPListTemplate` as root
2. Stream list:
   ```
   Astra Radio
   ├── 320 kbps  [checkmark if currently active]
   ├── 192 kbps
   └── 128 kbps
   ```
3. User taps a stream → bridge fires `switchStation(id)` → JS switches TrackPlayer to that stream + starts playback → CarPlay pushes `CPNowPlayingTemplate`
4. Now Playing screen shows track title, artist, artwork (auto-fed from `MPNowPlayingInfoCenter`) + play/pause
5. Back button → returns to stream list
6. If already playing when CarPlay connects → active stream is marked with a checkmark in the list

---

## Implementation Details

### CarPlaySceneDelegate.swift
- Conforms to `CPTemplateApplicationSceneDelegate`
- On `templateApplicationScene(_:didConnect:)`: builds `CPListTemplate` from the 3 stations in `stations.ts` order (320, 192, 128), sets it as root on the `CPInterfaceController`
- Each `CPListItem`: title = bitrate label (e.g. "320 kbps"), subtitle = "Astra Radio"
- Currently active stream gets a checkmark accessory (read active track ID via `MPNowPlayingInfoCenter` or a shared singleton)
- On item tap: calls `CarPlayBridge.shared.switchStation(id:)`, then pushes `CPNowPlayingTemplate.shared`
- On `templateApplicationScene(_:didDisconnect:)`: cleans up, no teardown of audio needed

### CarPlayBridge (native module)
- Swift singleton `CarPlayBridge` with a `switchStation(id: String)` method
- Exposes to RN as an `RCTEventEmitter` subclass, emits event `carplay_switch_station` with payload `{ "id": "<station-id>" }`
- ObjC bridging header registers the module (`CarPlayBridge.m` with `RCT_EXTERN_MODULE`)

### carplayService.ts (JS)
- Uses `NativeEventEmitter` on `CarPlayBridge` module
- Listens for `carplay_switch_station` event
- On event: calls `SafeTrackPlayer` to skip to the station by ID and call `play()`
- Registered in `App.tsx` alongside the existing `playbackService`

### Info.plist
- Add `UIApplicationSceneManifest` with `UIApplicationSupportsMultipleScenes: false`
- Add scene configurations array with two entries:
  - Default: `UIWindowSceneSessionRoleApplication` → existing `AppDelegate`
  - CarPlay: `CPTemplateApplicationSceneSessionRoleApplication` → `CarPlaySceneDelegate`

### Entitlements
- Add `com.apple.developer.carplay-audio` = `true`
- Must be present in the provisioning profile before App Store submission (requires Apple entitlement approval)
- Can be added to the file now; will compile fine but CarPlay won't activate on device until the provisioning profile includes it

---

## Out of Scope
- Android (CarPlay is iOS-only; Android Auto is a separate feature)
- Ads or points system in CarPlay
- Any CarPlay UI beyond stream list + now playing

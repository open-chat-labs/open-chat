# iOS port status

## How to run (dev)

```sh
# local dfx + the :8081 reverse proxy must be running (same setup as Android dev)
cd frontend
npx tauri ios dev "iPhone 16 Pro" --no-watch   # simulator
npx tauri ios dev --no-watch                   # pick a device/simulator interactively
```

Notes:
- The iOS dev flow uses port **5002** (via `dev:mobile:ios` / `tauri.ios.conf.json`)
  so it can run alongside the web/Android dev server on 5001.
- The worktree needs `frontend/.env` (gitignored — copy from the main checkout)
  and a `.dfx` symlink to the main checkout's `.dfx` for local canister ids.
- If the tauri CLI prompts to update brew deps (cocoapods/xcodegen), answer "n"
  (this machine's brew has unrelated tap-trust errors).
- After editing `gen/apple/project.yml`, run `xcodegen generate` in `gen/apple`.
- Entitlements live in `open-chat_iOS/OpenChat.entitlements`, not the
  `open-chat_iOS.entitlements` the template creates: on a clean build
  `tauri-plugin-deep-link` rewrites that file's associated domains from the
  deep-link config, which would drop `webcredentials:oc.app`. The plugin also
  writes `CFBundleURLTypes` in Info.plist from the iOS deep-link config in
  `tauri.ios.conf.json`.
- First load after a cold vite start takes ~1 min (dev transform of the full
  module graph) — the webview is white until then.
- Verified 2026-08-24: builds, installs and renders the onboarding screen on the
  iPhone 16 Pro simulator; `openchat://` deep links are accepted.

Tracks what is implemented, what is stubbed, and what must be revisited once the
proper Apple Developer account exists.

## Signing / accounts

- Builds are signed by the **OC Labs** Apple Developer team (`N59KSS69AU`),
  bundle id **`com.oclabs.openchat`** (same as Android). Set in
  `tauri.conf.json` (`developmentTeam`) and `gen/apple/project.yml`; the iOS
  config no longer overrides the identifier.
- Before 2026-10-21 dev builds used the Computism Ltd team (`A468T66XSK`) with
  the interim id `com.oclabs.openchat.dev`, because `com.oc.app` is registered
  to an unknown other Apple team and the final id must not be registered under
  the interim team. Nothing should be signed with the Computism team any more.
- [x] Create the OpenChat Apple Developer account
- [x] Move `developmentTeam` to the new team
- [ ] Register App ID `com.oclabs.openchat` under `N59KSS69AU` (Associated
      Domains + Push Notifications) and re-provision on a device

## Blocked on the real Apple Developer account / oc.app changes

- [ ] **apple-app-site-association**: LIVE on oc.app since 2026-08-25
      (v2.0.2041 + follow-up release; #9241, #9242), listing
      `A468T66XSK.com.oclabs.openchat.dev`. The file now also lists
      `N59KSS69AU.com.oclabs.openchat`; that is live only after the next
      website release. Drop the Computism entry once a new-team build has
      signed in with a passkey on a device. Passkeys verified end-to-end on a
      physical iPhone against production. User passkeys are bound to the
      domain, not the team, so they survive the swap. Two gotchas learned
      the hard way: the AASA is fetched even in `?mode=developer` (it only
      relaxes CDN/TLS), and an SPA fallback answering the well-known path with
      200 + HTML breaks the parser (`SWCErrorDomain 104` →
      `ASAuthorizationError 1004`). Devices honour `?mode=developer` entries
      only with Settings → Developer → Associated Domains Development enabled;
      drop the suffix for production builds.
- [ ] **Push notifications (APNs)**: entire remote-push pipeline unimplemented on
      iOS. Android uses FCM (`OpenChatNotificationService`, Room DB, avatars,
      conversation shortcuts). iOS plan: APNs (possibly via FCM iOS SDK to reuse
      the backend FCM sender). Until then these plugin commands are graceful
      stubs on iOS: `getFcmToken` (null token), `deleteFcmToken`,
      `showNotification`, `releaseNotifications` (no-op success).
      `clearAllNotifications` genuinely clears delivered local notifications.
- [ ] **Universal links**: only the `openchat://` custom scheme works for deep
      links in dev. `applinks:oc.app` entitlement + AASA needed for https links.

## Deferred by choice (not account-blocked)

- [ ] **Share Extension** (receiving shares INTO the app — Android
      `ShareIntentManager` equivalent). Needs a separate Xcode extension target
      + app group. Deferred entirely from v1.
- [ ] **Chat shortcuts**: `updateChatShortcuts` is a no-op success on iOS
      (Android dynamic shortcuts have no direct equivalent; could map to
      home-screen quick actions / Siri donations later).
- [ ] **OTA updates**: the rust `bundle_manager`/`update_manager` custom
      `tauri://` protocol path is release-mode only and untested on iOS.
      `version.svelte.ts` update strategy still gated to Android.
- [ ] **minimizeApp**: no-op on iOS (programmatic backgrounding is forbidden by
      Apple). Frontend callers must tolerate it doing nothing.
- [ ] **restartApp**: implemented as `exit(0)` — acceptable for dev, review
      before store submission (Apple discourages self-termination).
- [ ] **App icon alpha channel**: the iOS icon set (generated from the Android
      launcher art via `tauri icon`; master composited by scripts in the
      2026-08-24 session) carries an alpha channel because `tauri icon` always
      writes RGBA. App Store Connect rejects alpha in the 1024 marketing icon —
      flatten it (e.g. `sips -s format jpeg` round-trip or re-export) before
      submission. Harmless for dev builds.

## Open questions

- [x] Does the identity canister validate the WebAuthn `clientDataJSON` origin?
      **No** (checked 2026-08-24): the identity canister stores the origin
      (`webauthn_keys.rs`) but never validates it, and nothing special-cases
      Android's `android:apk-key-hash:...` origin. The iOS-native origin
      (`https://oc.app`) needs no backend change. Still verify sign-in
      end-to-end once passkeys are exercisable.

## Implemented on iOS (v1)

- Boot + WKWebView loading the vite dev server (local dfx backend)
- Native passkey sign-up/sign-in (`ASAuthorizationPlatformPublicKeyCredential*`,
  RP id `oc.app`, simulator-testable via developer-mode associated domains)
- `openUrl` (SFSafariViewController for http(s), system open for other schemes)
- `svelteReady` + native→JS event queue (mirrors Android `OCPluginCompanion`)
- `window-inset-change` events (safe areas + keyboard) and viewport resize
  enable/disable (webview frame shrink on keyboard show)
- Keyboard/tray handling (debugged 2026-08-24, three findings worth knowing):
  1. WKWebView "reveals" a focused input by scrolling the whole document up by
     the keyboard height (even with `contentInsetAdjustmentBehavior = .never`),
     double-counting with the frontend's input tray. The plugin pins
     `scrollView.contentOffset` to zero via KVO — safe because the app shell is
     fixed-height and only inner elements scroll.
  2. Unlike Android, iOS shows no keyboard for a programmatic focus (e.g. the
     refocus after sending) and none at all when a hardware keyboard is
     attached, so `MessageEntry`'s "keyboard_only" tray collapses on iOS when
     the keyboard is not actually visible (`trayOpen`).
  3. Simulator testing needs the software keyboard toggled on (Cmd+K).
- `loadRecentMedia` (Photos framework, 256px JPEG thumbnails) + new
  `export_media` command (exports a picked asset to a temp file so the webview
  can read it via the asset protocol; iOS has no direct file paths for photos)
- `getPendingDeepLink` / `getPendingNotificationTap` cold-start plumbing
- `openchat://` custom scheme deep links

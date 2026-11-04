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
- [x] Register App ID `com.oclabs.openchat` under `N59KSS69AU` (Associated
      Domains + Push Notifications) and re-provision on a device

## Release builds (TestFlight)

`.github/workflows/ios_release.yaml` builds, signs and uploads to App Store
Connect when a GitHub release tagged `vX.Y.Z-ios` is published, or on a manual
run given a version. Internal testers get the build through the TestFlight
group's automatic distribution. Plan: #10398, milestone #10399.

- Signing is automatic, with an App Store Connect **Team** API key with the
  **Admin** role, because it has to create the cloud-managed distribution
  certificate and profiles. Secrets: `APPLE_API_ISSUER`, `APPLE_API_KEY`
  (key id), `APPLE_API_KEY_P8` (the `.p8` contents).
- CFBundleShortVersionString is the tag's version and CFBundleVersion is the
  workflow run number, which only goes up. Tauri's `--build-number` is not
  used: it appends a fourth component, which Apple rejects.
- The workflow deletes `NSAppTransportSecurity` from Info.plist before
  building, and checks the IPA's version, ATS and entitlements before upload.
- Store build: `--features store`, `OC_APP_STORE=true`, `OC_OTA_UPDATES=patch`,
  the same as the Android store AAB.

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
      `ASAuthorizationError 1004`). The entitlement no longer has the
      `?mode=developer` suffix: the AASA is live, and store builds ignore
      developer-mode entries.
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
- [ ] **OTA updates**: on for iOS at patch level (#10399). The cache lives in
      Caches on iOS, not the backed-up app data directory. Verify on the first
      TestFlight build: download, restart, and a minor bump refused.
- [ ] **minimizeApp**: no-op on iOS (programmatic backgrounding is forbidden by
      Apple). Frontend callers must tolerate it doing nothing.
- [x] **restartApp**: on iOS it drops the in-memory bundle and reloads the
      webview in place instead of calling `exit(0)`, which Apple discourages.
- [x] **App icon alpha channel**: flattened (every pixel was already opaque).
      `tauri icon` always writes RGBA, so flatten again after regenerating icons:
      App Store Connect rejects alpha in the 1024 icon.

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

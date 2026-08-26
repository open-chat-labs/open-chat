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
- First load after a cold vite start takes ~1 min (dev transform of the full
  module graph) — the webview is white until then.
- Verified 2026-08-24: builds, installs and renders the onboarding screen on the
  iPhone 16 Pro simulator; `openchat://` deep links are accepted.

Tracks what is implemented, what is stubbed, and what must be revisited once the
proper Apple Developer account exists.

## Signing / accounts

- Dev builds currently use the **Computism Ltd** team (`A468T66XSK`). This is a
  stop-gap for local development ONLY — it is the wrong company long term and
  must never be used for a release. Before any distribution:
  - [ ] Create the OpenChat Apple Developer account
  - [ ] Move `developmentTeam` in `tauri.conf.json` / Xcode signing to the new team
  - [ ] Re-provision entitlements under the new team

## Bundle id (IMPORTANT for the production account)

- **`com.oc.app` is currently registered to some other Apple developer team**
  — discovered 2026-08-25 when automatic provisioning failed with Apple's
  "cannot be registered to your development team because it is not available"
  error (App ID registrations are globally unique). Who holds it is unknown:
  could be a squatter, or an OpenChat-associated account from the past.
  Before the production account is set up, INVESTIGATE: ask the team whether
  any OpenChat/DFINITY-era Apple developer account ever existed and check old
  credentials. If a stranger holds it there is no Apple reclaim process for
  bundle ids (only for app names) and the production iOS id will have to
  differ from Android's `com.oc.app`. Either way, do NOT register the
  intended final id under the interim team (that would burn it too).
- Interim dev builds use **`com.oclabs.openchat.dev`** (set in
  `tauri.ios.conf.json` + `gen/apple/project.yml`); the oc.app AASA lists only
  that app id (#9242 — the `A468T66XSK.com.oc.app` entry was dropped as it can
  never correspond to a real app).

## Blocked on the real Apple Developer account / oc.app changes

- [x] **apple-app-site-association**: LIVE on oc.app since 2026-08-25
      (v2.0.2041 + follow-up release; #9241, #9242), listing
      `A468T66XSK.com.oclabs.openchat.dev`. Passkeys verified end-to-end on a
      physical iPhone against production. When the real Apple account exists:
      replace the entry with the new team's app id (user passkeys are bound to
      the domain, not the team — they survive the swap). Two gotchas learned
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

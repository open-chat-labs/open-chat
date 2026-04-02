# OTA Update Manager

Over-the-air update mechanism for the OpenChat Android app. This allows the web
frontend (HTML/JS/CSS) to be updated without publishing a new APK to the Play
Store.

## Overview

The APK ships with a bundled copy of the frontend assets. On each launch the app
checks whether a newer version is available on the server. If so — and if the
OTA strategy permits it — it downloads a zip of the new assets, extracts them to
a cache directory, and prompts the user to restart. On the next launch the cached
assets are served instead of the bundled ones.

Only the **web layer** is updated. Native Kotlin code, Rust code, and the Tauri
runtime remain at the version compiled into the APK.

## OTA Update Strategy

The strategy is set at build time via the `OC_OTA_UPDATES` environment variable
and controls **which version bumps** the frontend is allowed to apply over the
air. The check is performed in the frontend before any download begins.

| Strategy | Allowed OTA updates | Example (from 2.0.1973) |
|----------|--------------------|-----------------------|
| `"none"` | Disabled entirely | — |
| `"patch"` | Same major & minor | 2.0.1974 ✓, 2.1.0 ✗, 3.0.0 ✗ |
| `"minor"` | Same major | 2.0.1974 ✓, 2.1.0 ✓, 3.0.0 ✗ |
| `"major"` | Any newer version | 2.0.1974 ✓, 2.1.0 ✓, 3.0.0 ✓ |

The type is `OTAUpdateStrategy = "none" | "patch" | "minor" | "major"`.

The idea is that a **major** version bump may require native code changes
(new Kotlin commands, Rust API changes, etc.) that can't be delivered OTA. By
setting the strategy to `"minor"` or `"patch"`, the app will refuse to OTA
across a major boundary and instead wait for an APK update from the store.

The strategy is evaluated by `Version.canUpdateTo(server, strategy)` in the
frontend. The Rust side always downloads if `server > current` — the gating
happens in JS before `download_update` is ever called.

The `VersionChecker` is only active when `OC_APP_TYPE === "android"` and
`OC_OTA_UPDATES !== "none"`.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (Svelte)                                      │
│  version.svelte.ts  VersionChecker                      │
│    ├── polls get_server_version every 60s               │
│    ├── compares server vs client (baked into JS build)  │
│    ├── gates on OTA strategy (canUpdateTo)              │
│    ├── if allowed: calls download_update, shows progress│
│    └── on success: prompts user to restart              │
├─────────────────────────────────────────────────────────┤
│  Rust Plugin  (tauri-plugin-oc)                         │
│                                                         │
│  commands.rs                                            │
│    ├── get_server_version  → fetches https://oc.app/version│
│    └── download_update     → calls check_for_updates    │
│                                                         │
│  update_manager.rs                                      │
│    ├── get_server_version  → GET /version               │
│    ├── get_bundled_version → reads "version" asset file │
│    ├── get_cached_version  → reads version.json in cache│
│    ├── check_for_updates   → compares & downloads       │
│    └── download_and_install→ fetches zip, extracts      │
│                                                         │
│  lib.rs                                                 │
│    └── "tauri" scheme handler                           │
│         ├── in-memory cache (OnceLock) → cached assets  │
│         └── fallback → bundled assets                   │
├─────────────────────────────────────────────────────────┤
│  Android (Kotlin)                                       │
│    └── RestartApp → kills process, relaunches Activity  │
└─────────────────────────────────────────────────────────┘
```

## Flows

### First launch (no cached update)

1. App starts, WebView loads `tauri://localhost/index.html`
2. Scheme handler checks in-memory cache → empty (no `version.json` on disk)
3. Falls through to bundled assets via `asset_resolver().get()`
4. Frontend JS boots with `OC_WEBSITE_VERSION` baked in at build time
5. `VersionChecker` calls `get_server_version` → e.g. `2.0.1975`
6. `canUpdateTo(server, strategy)` checks the OTA strategy:
   - If strategy is `"none"` → no update, app stays on bundled version
   - If the version delta exceeds what the strategy allows → no update
   - If allowed → proceeds to step 7
7. Sets state to `out_of_date`, shows download sheet
8. Calls `download_update` → Rust downloads zip, emits `update-progress` events
9. Zip extracted to `<app_data>/updates/`, `version.json` written
10. Frontend shows "restart" button
11. User taps restart → `restart_app` → `RestartApp.kt` kills process & relaunches

### Subsequent launch (cached update available)

1. App starts, WebView loads `tauri://localhost/index.html`
2. Scheme handler initialises `OnceLock`:
   - Finds `<app_data>/updates/version.json` → loads all files from cache dir
     into memory
3. Serves `index.html` (and all other assets) from in-memory cache
4. Frontend JS boots — this is now the **updated** JS (e.g. `2.0.1975`)
5. `VersionChecker` calls `get_server_version` → `2.0.1975`
6. `canUpdateTo` → server equals client → up to date
7. App runs normally

### Subsequent launch (newer version on server)

Same as "cached update available" but at step 6 the server has a newer version.
The strategy gate is re-evaluated against the **cached** client version. If
allowed, the update flow triggers again.

### Strategy blocks the update

If the server version exceeds the strategy boundary (e.g. strategy is `"patch"`
but the server bumped the minor version), `canUpdateTo` returns false. The
`VersionChecker` sets state to `up_to_date` and the user sees no update prompt.
The app continues running on whatever version it has (bundled or previously
cached). The user must update via the Play Store to get across the boundary.

## Key Files

| File | Role |
|------|------|
| `src/update_manager.rs` | Version checking, downloading, extracting zip archives |
| `src/commands.rs` | Tauri commands exposed to the frontend (`download_update`, `get_server_version`) |
| `src/lib.rs` | Plugin init, `tauri://` scheme handler with in-memory cache |
| `frontend/app/src/utils/version.svelte.ts` | Frontend `VersionChecker` — polls, gates on strategy, drives UI |
| `frontend/openchat-shared/src/domain/version.ts` | `Version` class with `canUpdateTo(other, strategy)` |
| `android/.../commands/RestartApp.kt` | Kills the process and relaunches the main activity |

## Version Sources

| Source | Location | Notes |
|--------|----------|-------|
| **Bundled version** | `build/version` asset file | Written by rollup build from `OC_WEBSITE_VERSION` env var. Has `v` prefix (e.g. `v2.0.1973`), stripped when parsed. |
| **Cached version** | `<app_data>/updates/version.json` | Written after successful OTA extraction. No `v` prefix. |
| **Server version** | `https://oc.app/version` | JSON `{"version": "2.0.1975"}` |
| **Client version (JS)** | `import.meta.env.OC_WEBSITE_VERSION` | Baked into JS at build time. After OTA, the cached JS has the updated value. |
| **OTA strategy** | `import.meta.env.OC_OTA_UPDATES` | Build-time env var. One of `"none"`, `"patch"`, `"minor"`, `"major"`. |
| **tauri.conf.json** | `"version": "0.1.0"` | **NOT used.** This is a stale placeholder. Do not rely on it. |

## Cache Directory Layout

```
<app_data>/updates/
├── version.json          ← {"version": "2.0.1975"}
├── index.html
├── main-AbCd1234.js
├── vendor-EfGh5678.js
├── main-AbCd1234.css
├── version               ← same "version" file from the build
└── ... (all frontend assets from the zip)
```

## Scheme Handler

The plugin registers a `"tauri"` URI scheme handler which **replaces** Tauri's
built-in asset handler. This is possible because Tauri checks
`if !registered_scheme_protocols.contains("tauri")` before registering its own —
plugin-registered protocols take priority.

### Why override the `tauri` scheme?

The app loads via `WebviewUrl::App("index.html")` which resolves to
`tauri://localhost/index.html`. On Android this becomes
`https://tauri.localhost/index.html`. To serve cached OTA assets at this URL, we
must intercept the `tauri://` scheme.

### Asset resolution order

1. **In-memory cache** — populated once via `OnceLock` from the disk cache on
   first request. If `version.json` doesn't exist, the cache is empty.
2. **SPA fallback (cache)** — requests without a file extension get
   `index.html` from cache.
3. **Bundled assets** — via `asset_resolver().get()` (Tauri's compiled-in
   assets).
4. **SPA fallback (bundled)** — `index.html` from bundled assets.
5. **404** — nothing matched.

### Critical: Response Headers

The `Access-Control-Allow-Origin` header **must** be set to
`https://tauri.localhost` (the exact origin). Using `*` breaks the Android
Credential Manager, causing WebAuthn/passkey authentication to fail with a
`GetCredentialCancellationException` disguised as "user cancelled".

## Download URLs

The zip is fetched from one of:

- **Full (non-store):** `https://oc.app/downloads/full-{version}.zip`
- **Store:** `https://oc.app/downloads/store-{version}.zip`

Selected at compile time via the `store` cargo feature flag.

## Gotchas & Lessons Learned

1. **`tauri.conf.json` version is stale.** It says `0.1.0` and is never updated.
   Always read the bundled version from the `version` asset file.

2. **`Access-Control-Allow-Origin: *` breaks passkeys.** The Android Credential
   Manager rejects WebAuthn assertions when the origin header is a wildcard.
   Always use the specific origin `https://tauri.localhost`.

3. **Stale cached files persist across installs of the same package.** If you're
   testing OTA, clear app data (`adb shell pm clear com.oc.app`) to reset.
   Uninstalling also clears the data.

4. **The scheme handler cannot be `"oc"` or any other custom scheme.** Using a
   different scheme changes the WebView origin (e.g. `http://oc.localhost`),
   which breaks SPA routing, WebAuthn (passkeys are origin-bound), and
   potentially other origin-sensitive features.

5. **`OnceLock` means the cache is immutable for the lifetime of the process.**
   After an OTA download, the new files are written to disk but won't be served
   until the app restarts (which is the intended flow — the user is prompted to
   restart).

6. **The frontend may call `download_update` more than once** due to the poller
   timing. The Rust side is idempotent — if the server version matches the
   cached version, it returns `false` without re-downloading.

7. **`RestartApp.kt` does `exitProcess(0)`** followed by
   `startActivity(mainIntent)`. This fully kills the process so the `OnceLock`
   is reset and the new cached files are loaded on the next launch.

8. **The OTA strategy is a frontend-only gate.** The Rust `check_for_updates`
   always downloads if `server > current`. The strategy check in
   `canUpdateTo()` prevents the frontend from ever calling `download_update`
   when the version delta is too large. This means the Rust side doesn't need
   to know about the strategy.

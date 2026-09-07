# OTA Update Manager

Over-the-air update mechanism for the OpenChat Android app. This allows the web
frontend (HTML/JS/CSS) to be updated without publishing a new APK to the Play
Store.

## Overview

The APK ships with a bundled copy of the frontend assets. When OTA is enabled,
the app checks whether a newer version is available on the server. If so — and
if the OTA strategy permits it — it downloads a zip of the new assets, extracts them to
a cache directory, and prompts the user to restart. On the next launch the cached
assets are served instead of the bundled ones.

Only the **web layer** is updated. Native Kotlin code, Rust code, and the Tauri
runtime remain at the version compiled into the APK.

## OTA Update Strategy

The strategy is set at build time via the `OC_OTA_UPDATES` environment variable
and controls **which version bumps** the frontend is allowed to apply over the
air. Rollup also writes it to the bundled `ota-policy.json`, so the native asset
resolver can enforce the policy before any cached JavaScript runs. Missing or
invalid native policy fails closed to `"none"`.

`build_android.sh` defaults sideload APKs to `"none"` without inheriting a
generic `OC_OTA_UPDATES` from the caller. Store/CI builds that intentionally use
OTA must opt in with `OC_ANDROID_OTA_UPDATES=patch|minor|major`.

| Strategy | Allowed OTA updates | Example (from 2.0.1973) |
|----------|--------------------|-----------------------|
| `"none"` | Disabled entirely | — |
| `"patch"` | Same major & minor | 2.0.1974 ✓, 2.1.0 ✗, 3.0.0 ✗ |
| `"minor"` | Same major | 2.0.1974 ✓, 2.1.0 ✓, 3.0.0 ✗ |
| `"major"` | Any newer version | 2.0.1974 ✓, 2.1.0 ✓, 3.0.0 ✓ |

The type is `OTAUpdateStrategy = "none" | "patch" | "minor" | "major"`.

### What each level means

The strategy only works if the version number is bumped deliberately, so the
components carry fixed meanings. Note that `major` does NOT mean "big". It means
**incompatible**: web code an already-installed shell cannot run.

| Bump | Meaning | Store build | Sideloaded build |
|------|---------|-------------|------------------|
| patch | Bug fixes, copy, styling. Nothing a reviewer needs to see. | OTA | OTA |
| minor | A new user-facing feature. Any existing shell can run it. | Play update | OTA |
| major | Web code that requires shell changes: a new plugin command, a new Rust API, a new permission. Older shells cannot run this bundle. | Play update | New APK |

This table describes the intended compatibility boundaries for OTA-enabled
channels, not an implicit opt-in. Local sideload builds default to `none`;
release channels must explicitly select their allowed policy.

Two consequences worth being explicit about.

A shell change on its own bumps nothing. What forces a major bump is the web
layer starting to DEPEND on a shell capability. Add a Kotlin command that no
frontend code calls yet and every existing install is still fine.

A one-line shell dependency is still a major bump, however small the diff. The
size of the change is irrelevant; the question is only whether an installed
shell can run the new bundle.

Getting this wrong in the permissive direction means shipping a feature to store
users without Play ever seeing it. Getting it wrong in the other direction means
users sitting on a stale build waiting for a store update they don't need. The
release-train skill asks about this at tag time rather than trusting memory.

The strategy is evaluated by `Version.canUpdateTo(server, strategy)` in the
frontend and is also embedded as `ota-policy.json` for the native resolver.
Rust independently rejects incompatible downloads and cached bundles. This
second gate is required because an install-over preserves native OTA files and
because native commands must not rely on frontend JavaScript for authorization.

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
│    ├── get_shell_version   → reads "version" asset file │
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
5. If OTA is enabled, `VersionChecker` calls `get_server_version` → e.g. `2.0.1975`
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
   - Reads the newly installed binary's OTA policy and embedded shell version.
   - Accepts `<app_data>/updates/version.json` only when the cache is strictly
     newer and compatible with that policy; `index.html` must also exist.
   - Otherwise ignores the preserved cache and serves the bundled frontend.
3. Serves `index.html` (and all other assets) from in-memory cache
4. Frontend JS boots — this is now the **updated** JS (e.g. `2.0.1975`)
5. `VersionChecker` calls `get_server_version` → `2.0.1975`
6. `canUpdateTo` → server equals client → up to date
7. App runs normally

### Subsequent launch (newer version on server)

Same as "cached update available" but at step 6 the server has a newer version.
The strategy gate is re-evaluated against the **eligible cached** client version.
An incompatible or stale preserved cache cannot become the comparison baseline.
If allowed, the update flow triggers again. Native `check_for_updates` returns
without contacting the server when policy is `none` or the embedded shell
version is missing/malformed; neither native package metadata nor `0.0.0` is a
substitute for the bundled frontend's version.

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
| **Shell version** | `build/version` asset file | Written by rollup build from `OC_WEBSITE_VERSION` env var. Has `v` prefix (e.g. `v2.0.1973`), stripped when parsed. |
| **Cached version** | `<app_data>/updates/version.json` | Written after successful OTA extraction. No `v` prefix. |
| **Server version** | `https://oc.app/version` | JSON `{"version": "2.0.1975"}` |
| **Client version (JS)** | `import.meta.env.OC_WEBSITE_VERSION` | Baked into JS at build time. After OTA, the cached JS has the updated value. |
| **OTA strategy** | `import.meta.env.OC_OTA_UPDATES` | Build-time env var. One of `"none"`, `"patch"`, `"minor"`, `"major"`. |
| **Android versionName / versionCode** | APK/AAB manifest | Set by CI from `OC_ANDROID_VERSION_NAME` (the release tag version). versionCode is derived as `major*1000000 + minor*10000 + patch`. Equals the shell version above, since both come from the same tag. |
| **tauri.conf.json** | `"version": "0.1.0"` | **NOT used** for any of the above. A stale placeholder. Do not rely on it. |

`get_shell_version` reports only the binary's embedded `version` asset, never a
cached OTA bundle or package-info fallback. Missing or malformed assets produce
no shell version and disable cache selection/download decisions.

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

1. **Eligible in-memory cache** — populated once via `OnceLock` from the disk
   cache on first request, but only when the bundled native policy permits it
   and the cached version is a compatible, strictly newer update over the
   bundled version. If policy is disabled/invalid or the cache is stale,
   malformed, or lacks `index.html`, the cache is empty.
2. **SPA fallback (cache)** — requests without a file extension get
   `index.html` from cache.
3. **Bundled assets** — via `asset_resolver().get()` (Tauri's compiled-in
   assets).
4. **SPA fallback (bundled)** — `index.html` from bundled assets.
5. **404** — nothing matched.

### Separate limitation: nested OTA asset completeness

The inherited cache loader currently reads only files directly under
`<app_data>/updates/`; it does not recursively load nested asset directories.
The `version.json`/`index.html` checks are minimum admission checks, not a proof
that the complete OTA build is present. If a cached page requests a missing or
nested asset, resolution can fall back to bundled files, mixing build versions.
Recursive loading, atomic complete-bundle selection and archive validation need
separate review before enabling production OTA for such bundles. This merge does
not claim to fix that loader. Local testing with OTA `none` bypasses it and uses
the frontend bundled into the APK.

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
   Always read the shell version from the `version` asset file.

2. **`Access-Control-Allow-Origin: *` breaks passkeys.** The Android Credential
   Manager rejects WebAuthn assertions when the origin header is a wildcard.
   Always use the specific origin `https://tauri.localhost`.

3. **Cached files persist across installs of the same package.** The native
   resolver now ignores them when the newly installed APK has OTA disabled, or
   when they are not a compatible upgrade over the newly bundled frontend.
   Ignoring the cache does not delete it or account/model data, and does not
   depend on a successful deletion. Test an in-place update of `<applicationId>`
   with retained data. Clearing app data or uninstalling is not a normal remedy
   for stale-cache selection and would destroy the retained-account test case.

4. **The scheme handler cannot be `"oc"` or any other custom scheme.** Using a
   different scheme changes the WebView origin (e.g. `http://oc.localhost`),
   which breaks SPA routing, WebAuthn (passkeys are origin-bound), and
   potentially other origin-sensitive features.

5. **`OnceLock` means the cache is immutable for the lifetime of the process.**
   After an OTA download, the new files are written to disk but won't be served
   until the app restarts (which is the intended flow — the user is prompted to
   restart).

6. **`download_update` returning `false` is ambiguous.** It means both "the
   download failed" and "nothing to do, the cache already matches the server",
   and the frontend reads it as failure either way. That is why `VersionChecker`
   stops polling once a download has completed and is waiting for a restart:
   the running JS still reports the pre-download client version, so the next
   tick would re-enter the download branch, reset the progress bar, get `false`
   back, and turn a finished download into "update failed". Polling does resume
   after a genuine failure, so a transient one retries.

7. **`RestartApp.kt` does `exitProcess(0)`** followed by
   `startActivity(mainIntent)`. This fully kills the process so the `OnceLock`
   is reset and the new cached files are loaded on the next launch.

8. **The OTA strategy is enforced twice.** The frontend's `canUpdateTo()`
   avoids offering incompatible updates. Rust reads the bundled
   `ota-policy.json`, independently rejects incompatible downloads, and refuses
   to serve an incompatible preserved cache or one missing the minimum index
   marker. Missing or invalid policy fails closed to the APK's bundled frontend;
   full nested-bundle completeness remains the separate limitation above.

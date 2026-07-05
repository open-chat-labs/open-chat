// Runtime detection of the native (Tauri) host.
//
// The same web bundle is loaded both by a normal browser and by the Tauri
// webview (Android/iOS) — in dev they are even served from the same
// http://localhost:5001 — so the platform cannot be baked in at build time.
// These helpers inspect the running environment instead. They are synchronous
// and safe to call from any thread: when there is no DOM (e.g. the web worker)
// they report "not native".
//
// `window.__TAURI_INTERNALS__` is injected only into a Tauri webview (this is
// also what @tauri-apps/api's isTauri() checks); the `tauri:` protocol is the
// production fallback. We deliberately do NOT key off the hostname: in dev the
// browser preview and the Android webview share http://localhost:5001, so the
// host cannot tell them apart.

type MaybeTauriWindow = Window & { __TAURI_INTERNALS__?: unknown };

function tauriWindow(): MaybeTauriWindow | undefined {
    return typeof window === "undefined" ? undefined : (window as MaybeTauriWindow);
}

export function isTauriApp(): boolean {
    const w = tauriWindow();
    if (w === undefined) return false;
    if ("__TAURI_INTERNALS__" in w) return true;
    return w.location?.protocol === "tauri:";
}

export function isAndroidTauriApp(): boolean {
    return isTauriApp() && /android/i.test(navigator.userAgent);
}

export function isIosTauriApp(): boolean {
    return isTauriApp() && /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function runtimeAppType(): "android" | "ios" | "web" {
    if (isAndroidTauriApp()) return "android";
    if (isIosTauriApp()) return "ios";
    return "web";
}

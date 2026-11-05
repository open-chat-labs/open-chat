export type AppLayout = "v1" | "v2" | "v3" | "v4";

/** The device's own pick between the native tree and the desktop site, kept in this browser. */
export type LayoutOverride = "mobile" | "desktop";

/** What `selectLayout` decides from, all read once at load (main.ts). */
export type LayoutInputs = {
    /** OC_MOBILE_LAYOUT: "v2" mounts components_mobile on narrow viewports. */
    mobileLayoutFlag: string | undefined;
    /** OC_WEB_LAYOUT: "v3" mounts the new web UI (src/web) on wide viewports. */
    webLayoutFlag: string | undefined;
    /** OC_NATIVE_LAYOUT: "v4" mounts the native tree (src/native) in the apps and on phones. */
    nativeLayoutFlag: string | undefined;
    /** The viewport's width in CSS pixels. */
    width: number;
    /** `(pointer: coarse)`: the primary pointer is a finger. */
    coarsePointer: boolean;
    /** `(hover: hover)`: the primary pointer can hover. */
    canHover: boolean;
    /** In one of the Tauri apps. */
    nativeApp: boolean;
    /** "Switch to desktop site / mobile site", if the user picked one on this device. */
    override: LayoutOverride | undefined;
};

// Below this a viewport is narrow (the `mobileWidth` store's line).
export const NARROW_WIDTH = 768;
// Tablet landscape: a touch-first viewport this wide or wider gets the desktop site.
export const TABLET_LANDSCAPE_WIDTH = 1024;

// Picks the app variant once at startup; resizing never swaps trees (#10366).
//
// Without OC_NATIVE_LAYOUT (every build until the cutover, N15), as before: the native Android build
// ships OC_MOBILE_LAYOUT=v2, so phones (viewport < 768px) always get "v2" (components_mobile). A
// build with OC_WEB_LAYOUT=v3 gets the new web UI ("v3", src/web) on viewports of 768px and up; it
// has no narrow layout yet, so narrower viewports keep getting "v1". Nor does it handle the native
// apps' events, so the native apps (which take the web build over the air) keep getting the
// existing apps too. Everything else gets "v1" (components).
//
// With OC_NATIVE_LAYOUT=v4 the native tree ("v4", src/native) takes over from components_mobile:
// - the Tauri apps always get it;
// - a browser gets it on a phone or a tablet in portrait: a touch-first device (coarse pointer, no
//   hover) below tablet-landscape width, or any narrow viewport that isn't a desktop pointer's (so a
//   phone that claims hover still counts). A narrow desktop window (a fine pointer that hovers) stays
//   on the desktop site, which has a narrow mode of its own;
// - "Switch to desktop site / mobile site" (`override`) beats the automatic rule in a browser.
// The desktop site is the new web UI in a build with it, else components.
export function selectLayout(inputs: LayoutInputs): AppLayout {
    const { mobileLayoutFlag, webLayoutFlag, nativeLayoutFlag, nativeApp } = inputs;
    const narrow = inputs.width < NARROW_WIDTH;
    if (nativeLayoutFlag === "v4") {
        if (nativeApp || prefersNative(inputs)) return "v4";
        return webLayoutFlag === "v3" ? "v3" : "v1";
    }
    if (mobileLayoutFlag === "v2" && narrow) return "v2";
    if (webLayoutFlag === "v3" && !narrow && !nativeApp) return "v3";
    return "v1";
}

// Whether a browser gets the native tree rather than the desktop site
function prefersNative({ width, coarsePointer, canHover, override }: LayoutInputs): boolean {
    if (override !== undefined) return override === "mobile";
    const touchFirst = coarsePointer && !canHover;
    const desktopPointer = !coarsePointer && canHover;
    return (
        (touchFirst && width < TABLET_LANDSCAPE_WIDTH) || (width < NARROW_WIDTH && !desktopPointer)
    );
}

/** A stored layout override, or none for nothing stored or a value that isn't one. */
export function layoutOverrideOf(stored: string | null | undefined): LayoutOverride | undefined {
    return stored === "mobile" || stored === "desktop" ? stored : undefined;
}

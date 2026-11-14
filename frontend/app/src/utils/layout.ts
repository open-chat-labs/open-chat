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

// Picks the app variant once at startup; resizing never swaps trees (#10366). A window resized
// across the line is offered a reload instead (`layoutSwitchAt`, web plan 10b).
//
// Without OC_NATIVE_LAYOUT (every build until the cutover, N15), as before: the native Android build
// ships OC_MOBILE_LAYOUT=v2, so phones (viewport < 768px) always get "v2" (components_mobile). A
// build with OC_WEB_LAYOUT=v3 gets the new web UI ("v3", src/web) on viewports of 768px and up. It
// is for desktop widths only (web plan 10b), so narrower viewports keep getting the old mobile UI
// ("v2" with that flag, else "v1") until the native tree takes over (N15). Nor does it handle the
// native apps' events, so the native apps (which take the web build over the air) keep getting the
// existing apps too. Everything else gets "v1" (components).
//
// With OC_NATIVE_LAYOUT=v4 the native tree ("v4", src/native) takes over from components_mobile:
// - the Tauri apps always get it;
// - a browser gets it on any narrow viewport, and on a tablet in portrait: a touch-first device
//   (coarse pointer, no hover) below tablet-landscape width. A narrow desktop window gets it too:
//   the new web UI has no narrow layout (web plan 10b; its narrow pass was dropped on 2026-11-14 in
//   favour of the native tree at N15);
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
    return (touchFirst && width < TABLET_LANDSCAPE_WIDTH) || width < NARROW_WIDTH;
}

/** A stored layout override, or none for nothing stored or a value that isn't one. */
export function layoutOverrideOf(stored: string | null | undefined): LayoutOverride | undefined {
    return stored === "mobile" || stored === "desktop" ? stored : undefined;
}

/** The tree main.ts mounted and what it picked it from. Every tree gets it as context. */
export type StartupLayout = { layout: AppLayout; inputs: LayoutInputs };

export const STARTUP_LAYOUT_CONTEXT = "startupLayout";

/** Which tree a reload would switch to: the phone layout or the desktop one. */
export type LayoutSwitch = "phone" | "desktop";

// What a reload at `width` would switch to, if it would mount another tree than the one loaded.
// Only switches to or from a new tree count (src/web, src/native): a build without them behaves as
// before, and the native apps never switch. The way is the way the window went: narrower is towards
// the phone layout.
export function layoutSwitchAt(
    { layout, inputs }: StartupLayout,
    width: number,
): LayoutSwitch | undefined {
    if (inputs.nativeApp) return undefined;
    const next = selectLayout({ ...inputs, width });
    if (next === layout || !(isNewTree(next) || isNewTree(layout))) return undefined;
    return width < inputs.width ? "phone" : "desktop";
}

function isNewTree(layout: AppLayout): boolean {
    return layout === "v3" || layout === "v4";
}

export type AppLayout = "v1" | "v2" | "v3";

// Picks the app variant once at startup. The native Android build ships
// OC_MOBILE_LAYOUT=v2, so phones (viewport < 768px) always get "v2"
// (components_mobile). A build with OC_WEB_LAYOUT=v3 gets the new web UI
// ("v3", src/web) on viewports of 768px and up; it has no narrow layout yet,
// so narrower viewports keep getting "v1". Nor does it handle the native apps'
// events yet, so the native apps (which take the web build over the air) keep
// getting the existing apps too. Everything else gets "v1" (components).
export function selectLayout(
    mobileLayoutFlag: string | undefined,
    webLayoutFlag: string | undefined,
    isMobileWidth: boolean,
    isNativeApp: boolean,
): AppLayout {
    if (mobileLayoutFlag === "v2" && isMobileWidth) return "v2";
    if (webLayoutFlag === "v3" && !isMobileWidth && !isNativeApp) return "v3";
    return "v1";
}

export type AppLayout = "v1" | "v2" | "v3";

// Picks the app variant once at startup. The native Android build ships
// OC_MOBILE_LAYOUT=v2, so phones (viewport < 768px) always get "v2"
// (components_mobile). A build with OC_WEB_LAYOUT=v3 gets the new web UI
// ("v3", src/web) on viewports of 768px and up; it has no narrow layout yet,
// so narrower viewports keep getting "v1". Everything else gets "v1" (components).
export function selectLayout(
    mobileLayoutFlag: string | undefined,
    webLayoutFlag: string | undefined,
    isMobileWidth: boolean,
): AppLayout {
    if (mobileLayoutFlag === "v2" && isMobileWidth) return "v2";
    if (webLayoutFlag === "v3" && !isMobileWidth) return "v3";
    return "v1";
}

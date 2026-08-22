export type AppLayout = "v1" | "v2";

// Picks the app variant once at startup. The native Android build ships
// OC_MOBILE_LAYOUT=v2, so phones (viewport < 768px) always get "v2"
// (components_mobile). Everything else gets "v1" (components).
export function selectLayout(mobileLayoutFlag: string | undefined, isMobileWidth: boolean): AppLayout {
    return mobileLayoutFlag === "v2" && isMobileWidth ? "v2" : "v1";
}

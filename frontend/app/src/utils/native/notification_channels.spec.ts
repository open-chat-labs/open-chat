import { beforeEach, describe, expect, test, vi } from "vitest";

const oc = vi.hoisted(() => ({
    openUrl: vi.fn(() => Promise.resolve()),
    showNotification: vi.fn(),
    getWindowInsets: vi.fn(),
}));
vi.mock("tauri-plugin-oc-api", () => oc);
const tauri = vi.hoisted(() => ({ addPluginListener: vi.fn(), invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => tauri);
vi.mock("@tauri-apps/plugin-notification", () => ({
    isPermissionGranted: vi.fn(),
    requestPermission: vi.fn(),
}));
const nav = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@utils/navigation", () => nav);

const { followWindowInsets, openDeepLink } = await import("./notification_channels");

// Invariant: a landing page link reaching the native app, warm or cold start, opens outside it;
// an in-app link opens inside. Both starts go through openDeepLink.
describe("opening a deep link", () => {
    beforeEach(() => vi.clearAllMocks());

    test("a landing page opens in the browser, not the app", () => {
        expect(openDeepLink("https://oc.app/privacy")).toBe(false);
        expect(oc.openUrl).toHaveBeenCalledWith({ url: "https://oc.app/privacy" });
        expect(nav.navigate).not.toHaveBeenCalled();
    });

    test("an in-app link opens in the app", () => {
        expect(openDeepLink("https://oc.app/group/abc?x=1")).toBe(true);
        expect(nav.navigate).toHaveBeenCalledWith("/group/abc?x=1", "notification");
        expect(oc.openUrl).not.toHaveBeenCalled();
    });
});

const insets = (statusBarHeightDp: number) => ({
    isKeyboardOpen: false,
    isGestureNavigation: true,
    navHeightDp: 24,
    statusBarHeightDp,
    keyboardHeightDp: 0,
    apiLevel: 35,
    osVersion: "15",
});

// The Android app reports its window insets as they happen, not held back for sign-in: a screen
// that starts listening later (a signed-out start, a reloaded WebView) still gets the current ones
describe("following the window insets", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        tauri.addPluginListener.mockResolvedValue({ unregister: vi.fn() });
    });

    test("the current insets come at once, then each change", async () => {
        oc.getWindowInsets.mockResolvedValue(insets(24));
        const seen: number[] = [];

        await followWindowInsets((data) => seen.push(data.statusBarHeightDp));
        expect(seen).toEqual([24]);

        const changed = tauri.addPluginListener.mock.calls[0][2];
        changed(insets(30));
        expect(seen).toEqual([24, 30]);
    });

    test("before the app has reported any, only the changes", async () => {
        oc.getWindowInsets.mockResolvedValue(undefined);
        const seen: number[] = [];

        await followWindowInsets((data) => seen.push(data.statusBarHeightDp));

        expect(seen).toEqual([]);
        expect(tauri.addPluginListener).toHaveBeenCalledOnce();
    });

    test("a shell without getWindowInsets still follows the changes", async () => {
        oc.getWindowInsets.mockRejectedValue(new Error("unknown command"));
        const seen: number[] = [];

        const listener = await followWindowInsets((data) => seen.push(data.statusBarHeightDp));

        expect(listener).toBeDefined();
        tauri.addPluginListener.mock.calls[0][2](insets(24));
        expect(seen).toEqual([24]);
    });
});

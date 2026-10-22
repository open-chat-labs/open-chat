import { beforeEach, describe, expect, test, vi } from "vitest";

const oc = vi.hoisted(() => ({ openUrl: vi.fn(() => Promise.resolve()), showNotification: vi.fn() }));
vi.mock("tauri-plugin-oc-api", () => oc);
vi.mock("@tauri-apps/api/core", () => ({ addPluginListener: vi.fn(), invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-notification", () => ({
    isPermissionGranted: vi.fn(),
    requestPermission: vi.fn(),
}));
const nav = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@utils/navigation", () => nav);

const { openDeepLink } = await import("./notification_channels");

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

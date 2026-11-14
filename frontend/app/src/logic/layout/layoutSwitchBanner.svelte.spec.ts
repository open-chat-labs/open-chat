import { selectLayout, type LayoutInputs, type StartupLayout } from "@src/utils/layout";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LAYOUT_SWITCH_SETTLE_MS, LayoutSwitchBanner } from "./layoutSwitchBanner.svelte";

// a desktop browser loaded at `width` in a build with the new web UI and the old mobile UI
function loadedAt(width: number, overrides: Partial<LayoutInputs> = {}): StartupLayout {
    const inputs: LayoutInputs = {
        mobileLayoutFlag: "v2",
        webLayoutFlag: "v3",
        nativeLayoutFlag: undefined,
        width,
        coarsePointer: false,
        canHover: true,
        nativeApp: false,
        override: undefined,
        ...overrides,
    };
    return { layout: selectLayout(inputs), inputs };
}

// the window resized to `width` and left there
function resize(banner: LayoutSwitchBanner, width: number) {
    banner.widthChanged(width);
    vi.advanceTimersByTime(LAYOUT_SWITCH_SETTLE_MS);
}

describe("the layout switch banner", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    test("shows nothing at the width the page loaded at", () => {
        const banner = new LayoutSwitchBanner(loadedAt(1400));
        resize(banner, 1400);
        expect(banner.offer).toBeUndefined();
        expect(banner.message).toBeUndefined();
    });

    test("offers the phone layout when the web UI is narrowed below 768px", () => {
        const banner = new LayoutSwitchBanner(loadedAt(1400));
        resize(banner, 600);
        expect(banner.offer).toBe("phone");
        expect(banner.message?.key).toBe("layoutSwitch.toPhone");
        resize(banner, 900);
        expect(banner.offer).toBeUndefined();
    });

    test("offers the desktop layout when the old mobile UI is widened to 768px", () => {
        const banner = new LayoutSwitchBanner(loadedAt(600));
        resize(banner, 767);
        expect(banner.offer).toBeUndefined();
        resize(banner, 768);
        expect(banner.offer).toBe("desktop");
        expect(banner.message?.key).toBe("layoutSwitch.toDesktop");
    });

    test("waits for the width to settle, so dragging an edge doesn't flicker it", () => {
        const banner = new LayoutSwitchBanner(loadedAt(1400));
        for (const width of [900, 700, 900, 650, 1000, 600]) {
            banner.widthChanged(width);
            vi.advanceTimersByTime(LAYOUT_SWITCH_SETTLE_MS - 1);
            expect(banner.offer).toBeUndefined();
        }
        vi.advanceTimersByTime(1);
        expect(banner.offer).toBe("phone");
    });

    test("once dismissed, stays hidden until the window crosses back and then again", () => {
        const banner = new LayoutSwitchBanner(loadedAt(1400));
        resize(banner, 600);
        banner.dismiss();
        expect(banner.offer).toBeUndefined();
        // still on the phone side
        resize(banner, 500);
        expect(banner.offer).toBeUndefined();
        // back, then over again
        resize(banner, 1000);
        expect(banner.offer).toBeUndefined();
        resize(banner, 600);
        expect(banner.offer).toBe("phone");
    });

    test("a crossing back that doesn't settle doesn't count", () => {
        const banner = new LayoutSwitchBanner(loadedAt(1400));
        resize(banner, 600);
        banner.dismiss();
        banner.widthChanged(1000);
        resize(banner, 600);
        expect(banner.offer).toBeUndefined();
    });

    test("never shows in the native apps, or without the startup layout", () => {
        const app = new LayoutSwitchBanner(loadedAt(600, { nativeApp: true }));
        resize(app, 1400);
        expect(app.offer).toBeUndefined();
        const none = new LayoutSwitchBanner(undefined);
        resize(none, 600);
        expect(none.offer).toBeUndefined();
    });

    test("stops following the width once destroyed", () => {
        const banner = new LayoutSwitchBanner(loadedAt(1400));
        banner.widthChanged(600);
        banner.destroy();
        vi.advanceTimersByTime(LAYOUT_SWITCH_SETTLE_MS);
        expect(banner.offer).toBeUndefined();
    });
});

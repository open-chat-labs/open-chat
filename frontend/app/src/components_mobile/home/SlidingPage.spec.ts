import { flushSync, mount, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Harness from "./SlidingPage.spec.harness.svelte";

// jsdom has no Web Animations API; svelte transitions need these to exist.
function stubAnimations() {
    const anim = {
        finished: Promise.resolve(),
        cancel() {},
        pause() {},
        play() {},
        finish() {},
        currentTime: 0,
        playbackRate: 1,
    };
    Element.prototype.animate = vi.fn(() => anim as unknown as Animation);
    Element.prototype.getAnimations = vi.fn(() => []);
}

function render(top: boolean, speed = 300) {
    const target = document.createElement("div");
    document.body.appendChild(target);
    const app = mount(Harness, { target, props: { top, speed } });
    flushSync();
    const page = () => target.querySelector(".sliding_page") as HTMLElement;
    return {
        setTop(value: boolean) {
            app.setTop(value);
            flushSync();
        },
        page,
        isTop: () => page().classList.contains("top"),
        settled: () => page().classList.contains("settled"),
        overlays: () =>
            target.querySelectorAll(".sliding_page_overlay, .sliding_page_overlay_before").length,
        destroy: () => unmount(app),
    };
}

function advance(ms: number) {
    vi.advanceTimersByTime(ms);
    flushSync();
}

describe("SlidingPage", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        stubAnimations();
    });
    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = "";
    });

    it("top page is visible with no overlays and never settles", () => {
        const r = render(true);
        expect(r.isTop()).toBe(true);
        expect(r.overlays()).toBe(0);
        advance(1000);
        expect(r.settled()).toBe(false);
        r.destroy();
    });

    it("covered page keeps peek-through during the transition then settles hidden", () => {
        const r = render(true, 300);
        r.setTop(false);
        expect(r.isTop()).toBe(false);
        expect(r.overlays()).toBe(2);
        expect(r.settled()).toBe(false);
        advance(299);
        expect(r.settled()).toBe(false);
        advance(1);
        expect(r.settled()).toBe(true);
        // still mounted, just not painted
        expect(r.page().textContent).toContain("content");
        r.destroy();
    });

    it("becoming top again restores visibility immediately, before any timer", () => {
        const r = render(true, 300);
        r.setTop(false);
        advance(300);
        expect(r.settled()).toBe(true);
        r.setTop(true);
        expect(r.settled()).toBe(false);
        expect(r.isTop()).toBe(true);
        advance(1000);
        expect(r.settled()).toBe(false);
        r.destroy();
    });

    it("uncovering before the transition completes cancels the pending settle", () => {
        const r = render(true, 300);
        r.setTop(false);
        advance(100);
        r.setTop(true);
        advance(1000);
        expect(r.settled()).toBe(false);
        r.destroy();
    });
});

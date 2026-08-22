import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setupKeyboardTracking } from "./safe_area";

vi.mock("./devices", () => ({ isStandalone: false, mobileOperatingSystem: "unknown" }));

function setScrollY(y: number) {
    Object.defineProperty(window, "scrollY", { value: y, configurable: true });
}

async function scrollTo(y: number) {
    setScrollY(y);
    window.dispatchEvent(new Event("scroll"));
    await vi.advanceTimersByTimeAsync(20);
}

describe("setupKeyboardTracking", () => {
    let cleanup: () => void;
    let addEventListener: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        vi.useFakeTimers();
        setScrollY(0);
        document.body.classList.remove("keyboard");
        addEventListener = vi.spyOn(window, "addEventListener");
        cleanup = setupKeyboardTracking();
    });
    afterEach(() => {
        cleanup();
        addEventListener.mockRestore();
        vi.useRealTimers();
    });

    it("registers a passive scroll listener", () => {
        const call = addEventListener.mock.calls.find(([type]) => type === "scroll");
        expect(call?.[2]).toEqual({ passive: true });
    });

    it("adds the keyboard class on a large scroll jump and removes it otherwise", async () => {
        await scrollTo(50);
        expect(document.body.classList.contains("keyboard")).toBe(false);
        await scrollTo(300);
        expect(document.body.classList.contains("keyboard")).toBe(true);
        await scrollTo(310);
        expect(document.body.classList.contains("keyboard")).toBe(false);
    });

    it("stops tracking after cleanup", async () => {
        cleanup();
        await scrollTo(500);
        expect(document.body.classList.contains("keyboard")).toBe(false);
    });
});

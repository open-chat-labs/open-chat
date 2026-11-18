import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CHROME_HIDE_MS, CallChrome } from "./callChrome.svelte";

describe("the call's controls", () => {
    let chrome: CallChrome;

    beforeEach(() => {
        vi.useFakeTimers();
        chrome = new CallChrome();
    });

    afterEach(() => {
        chrome.dispose();
        vi.useRealTimers();
    });

    test("invariant 6: in a video call they hide 4s after the last tap and a tap brings them back", () => {
        chrome.update(true, false);
        vi.advanceTimersByTime(CHROME_HIDE_MS - 1);
        chrome.wake();
        vi.advanceTimersByTime(CHROME_HIDE_MS - 1);
        expect(chrome.shown).toBe(true);
        vi.advanceTimersByTime(1);
        expect(chrome.shown).toBe(false);

        chrome.tapStage();
        expect(chrome.shown).toBe(true);
        chrome.tapStage();
        expect(chrome.shown).toBe(false);
    });

    test("invariant 6: they never hide in a voice call or while a menu is open", () => {
        chrome.update(false, false);
        chrome.tapStage();
        vi.advanceTimersByTime(CHROME_HIDE_MS * 2);
        expect(chrome.shown).toBe(true);

        chrome.update(true, true);
        chrome.tapStage();
        vi.advanceTimersByTime(CHROME_HIDE_MS * 2);
        expect(chrome.shown).toBe(true);
    });
});

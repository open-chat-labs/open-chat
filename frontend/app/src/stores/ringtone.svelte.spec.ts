import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Ringtone } from "./ringtone.svelte";

describe("Ringtone", () => {
    beforeEach(() => {
        vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
        vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    /** Invariant: stopping a ringtone marks it not playing, so its icon shows play again. */
    it("stop marks a playing ringtone as not playing", () => {
        const ringtone = new Ringtone("boring", "Boring");
        ringtone.toggle();
        expect(ringtone.playing).toBe(true);

        ringtone.stop();

        expect(ringtone.playing).toBe(false);
    });
});

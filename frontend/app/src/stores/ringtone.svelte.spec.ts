import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Ringtone, RINGTONE_KEYS, storedRingtoneKey } from "./ringtone.svelte";

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

describe("the stored ringtone", () => {
    it("is the one named, or the default for a name the app no longer has", () => {
        expect(storedRingtoneKey("siren")).toBe("siren");
        expect(storedRingtoneKey("twostep")).toBe("boring");
        expect(RINGTONE_KEYS).toEqual(["boring", "pleasant", "boomboom", "garage", "siren"]);
    });
});

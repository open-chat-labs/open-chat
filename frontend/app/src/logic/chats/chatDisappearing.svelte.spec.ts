import { describe, expect, test, vi } from "vitest";
import {
    ChatDisappearing,
    DISAPPEARING_START,
    disappearingSetting,
    type DisappearingSetting,
} from "./chatDisappearing.svelte";

const HOUR = 3_600_000n;
const DAY = 24n * HOUR;

describe("disappearingSetting", () => {
    test("on for the TTL's length", () => {
        expect(disappearingSetting(8n * HOUR, "1 day")).toEqual({ on: true, after: "8 hours" });
    });

    test("off, showing the length to go back to", () => {
        expect(disappearingSetting(undefined, "1 week")).toEqual({ on: false, after: "1 week" });
        expect(disappearingSetting(0n, "1 hour")).toEqual({ on: false, after: "1 hour" });
    });
});

// the chat's TTL as the host holds it, and saves that update it
function host(initial: bigint | undefined, fails = false) {
    let ttl = $state(initial);
    const save = vi.fn(async (setting: DisappearingSetting) => {
        if (fails) throw new Error("refused");
        ttl = setting.on ? BigInt(setting.after === "1 day" ? DAY : 8n * HOUR) : undefined;
    });
    return {
        get ttl() {
            return ttl;
        },
        set ttl(value: bigint | undefined) {
            ttl = value;
        },
        save,
    };
}

describe("ChatDisappearing", () => {
    // native plan 10: "Default when first enabled: 1 day"
    test("a chat that's never had them starts at a day", () => {
        const chat = host(undefined);
        const setting = new ChatDisappearing(() => chat.ttl, chat.save);
        expect(setting.current).toEqual({ on: false, after: DISAPPEARING_START });
        expect(DISAPPEARING_START).toBe("1 day");
    });

    // "turning it off remembers the last duration"
    test("switched off, it keeps the length it had, and switching on goes back to it", async () => {
        const chat = host(8n * HOUR);
        const setting = new ChatDisappearing(() => chat.ttl, chat.save);
        expect(setting.current).toEqual({ on: true, after: "8 hours" });

        expect(await setting.set(false, setting.current.after)).toBe(true);
        setting.sync();
        expect(chat.ttl).toBeUndefined();
        expect(setting.current).toEqual({ on: false, after: "8 hours" });
        expect(chat.save).toHaveBeenLastCalledWith({ on: false, after: "8 hours" });
    });

    // one setting with the conversation menu's submenu: a length set there is the one remembered
    test("remembers the length the TTL last had, set from elsewhere", () => {
        const chat = host(undefined);
        const setting = new ChatDisappearing(() => chat.ttl, chat.save);
        chat.ttl = 7n * DAY;
        setting.sync();
        expect(setting.current).toEqual({ on: true, after: "1 week" });
        chat.ttl = undefined;
        setting.sync();
        expect(setting.current).toEqual({ on: false, after: "1 week" });
    });

    test("refused, it's back as it was, and the length it remembers doesn't change", async () => {
        const chat = host(undefined, true);
        const setting = new ChatDisappearing(() => chat.ttl, chat.save);
        expect(await setting.set(true, "8 hours")).toBe(false);
        expect(setting.current).toEqual({ on: false, after: "1 day" });
    });

    test("offers the usual lengths, with the chat's own where it's another", () => {
        const chat = host(2n * DAY);
        const setting = new ChatDisappearing(() => chat.ttl, chat.save);
        expect(setting.choices).toContain("2 days");
        expect(setting.choices).toHaveLength(9);
    });
});

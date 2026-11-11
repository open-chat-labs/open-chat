import { deletedUser, type ChatIdentifier, type UserSummary } from "@client";
import { describe, expect, test, vi } from "vitest";
import {
    ChatDisappearing,
    disappearingSetting,
    dmDisappearingAllowed,
    type DisappearingLengths,
    type DisappearingSetting,
} from "./chatDisappearing.svelte";
import { DISAPPEARING_START } from "./disappearingMessages";

const HOUR = 3_600_000n;
const DAY = 24n * HOUR;
const CHAT: ChatIdentifier = { kind: "direct_chat", userId: "ann" };
const OTHER: ChatIdentifier = { kind: "direct_chat", userId: "bob" };

describe("disappearingSetting", () => {
    test("on for the TTL's length", () => {
        expect(disappearingSetting(8n * HOUR, "1 day")).toEqual({ on: true, after: "8 hours" });
    });

    test("off, showing the length to go back to", () => {
        expect(disappearingSetting(undefined, "1 week")).toEqual({ on: false, after: "1 week" });
        expect(disappearingSetting(0n, "1 hour")).toEqual({ on: false, after: "1 hour" });
    });
});

describe("dmDisappearingAllowed", () => {
    const person: UserSummary = { ...deletedUser("ann"), username: "ann", updated: 0n };

    test("with a person, or someone not loaded yet", () => {
        expect(dmDisappearingAllowed({ user: person, blocked: false })).toBe(true);
        expect(dmDisappearingAllowed({ user: undefined, blocked: false })).toBe(true);
    });

    // the conversation menu hides Mute for a bot; disappearing messages there mean nothing either
    test("not with a bot, a deleted user, or someone the viewer blocked", () => {
        const bot: UserSummary = { ...person, kind: "bot" };
        expect(dmDisappearingAllowed({ user: bot, blocked: false })).toBe(false);
        expect(dmDisappearingAllowed({ user: deletedUser("ann"), blocked: false })).toBe(false);
        expect(dmDisappearingAllowed({ user: person, blocked: true })).toBe(false);
    });
});

// the session's lengths, as the client's disappearingLengthsStore keeps them
function lengths(): DisappearingLengths {
    const map = new Map<string, bigint>();
    return { get: (key) => map.get(key), insert: (key, ttl) => void map.set(key, ttl) };
}

const TTLS: Record<string, bigint> = { "1 day": DAY, "8 hours": 8n * HOUR, "1 week": 7n * DAY };

// the chat's TTL as the host holds it, and saves that update it
function host(initial: bigint | undefined, fails = false) {
    let ttl = $state(initial);
    const save = vi.fn(async (setting: DisappearingSetting) => {
        if (fails) throw new Error("refused");
        ttl = setting.on ? TTLS[setting.after] : undefined;
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
        const setting = new ChatDisappearing(CHAT, () => chat.ttl, chat.save, lengths());
        expect(setting.current).toEqual({ on: false, after: DISAPPEARING_START });
    });

    // "turning it off remembers the last duration"
    test("switched off, it keeps the length it had, and switching on goes back to it", async () => {
        const chat = host(8n * HOUR);
        const setting = new ChatDisappearing(CHAT, () => chat.ttl, chat.save, lengths());
        expect(setting.current).toEqual({ on: true, after: "8 hours" });

        expect(await setting.set(false, setting.current.after)).toBe(true);
        setting.sync();
        expect(chat.ttl).toBeUndefined();
        expect(setting.current).toEqual({ on: false, after: "8 hours" });
        expect(chat.save).toHaveBeenLastCalledWith({ on: false, after: "8 hours" });
    });

    // the details' row is mounted again on each visit (and when who may set them changes): the
    // length outlives it
    test("a screen opened later goes back to the length the chat had", async () => {
        const chat = host(8n * HOUR);
        const session = lengths();
        const before = new ChatDisappearing(CHAT, () => chat.ttl, chat.save, session);
        await before.set(false, before.current.after);

        const after = new ChatDisappearing(CHAT, () => chat.ttl, chat.save, session);
        expect(after.current).toEqual({ on: false, after: "8 hours" });
        await after.set(true, after.current.after);
        expect(chat.save).toHaveBeenLastCalledWith({ on: true, after: "8 hours" });
    });

    // one setting with the conversation menu's submenu: the menu and the details go back to the
    // same length, whichever switched them off
    test("the menu and the details share the length, and other chats keep their own", async () => {
        const chat = host(8n * HOUR);
        const session = lengths();
        const details = new ChatDisappearing(CHAT, () => chat.ttl, chat.save, session);
        const menu = new ChatDisappearing(CHAT, () => chat.ttl, chat.save, session);
        await menu.set(false, menu.current.after);
        menu.sync();
        details.sync();
        expect(details.current).toEqual({ on: false, after: "8 hours" });

        const other = host(undefined);
        const elsewhere = new ChatDisappearing(OTHER, () => other.ttl, other.save, session);
        expect(elsewhere.current).toEqual({ on: false, after: DISAPPEARING_START });
    });

    test("remembers the length the TTL last had, set from elsewhere", () => {
        const chat = host(undefined);
        const setting = new ChatDisappearing(CHAT, () => chat.ttl, chat.save, lengths());
        chat.ttl = 7n * DAY;
        setting.sync();
        expect(setting.current).toEqual({ on: true, after: "1 week" });
        chat.ttl = undefined;
        setting.sync();
        expect(setting.current).toEqual({ on: false, after: "1 week" });
    });

    // switched on (a day), then 8 hours picked at once: the day's save finishing last doesn't
    // make a day the length Off and On go back to, while the chat is at 8 hours
    test("an older save that finishes late doesn't change the length it goes back to", async () => {
        let ttl = $state<bigint | undefined>(undefined);
        const finish: (() => void)[] = [];
        const save = vi.fn(() => new Promise<void>((resolve) => finish.push(resolve)));
        const setting = new ChatDisappearing(CHAT, () => ttl, save, lengths());

        const day = setting.set(true, "1 day");
        const hours = setting.set(true, "8 hours");
        finish[1]();
        expect(await hours).toBe(true);
        ttl = 8n * HOUR;
        setting.sync();
        finish[0]();
        expect(await day).toBe(true);

        ttl = undefined;
        setting.sync();
        expect(setting.current).toEqual({ on: false, after: "8 hours" });
    });

    test("refused, it's back as it was, and the length it remembers doesn't change", async () => {
        const chat = host(undefined, true);
        const setting = new ChatDisappearing(CHAT, () => chat.ttl, chat.save, lengths());
        expect(await setting.set(true, "8 hours")).toBe(false);
        expect(setting.current).toEqual({ on: false, after: "1 day" });
    });

    test("offers the usual lengths, with the chat's own where it's another", () => {
        const chat = host(2n * DAY);
        const setting = new ChatDisappearing(CHAT, () => chat.ttl, chat.save, lengths());
        expect(setting.choices).toContain("2 days");
        expect(setting.choices).toHaveLength(9);
    });
});

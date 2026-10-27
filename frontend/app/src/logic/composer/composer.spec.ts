import { ScreenWidth, type UserOrUserGroup } from "@client";
import {
    expandMentions,
    mentionedUsernames,
    entryBlock,
    focusEntryOnOpen,
    throttleCountdown,
    TypingNotifier,
    type EntryState,
} from "./composer";

describe("a message's mentions", () => {
    const known: Record<string, UserOrUserGroup> = {
        alice: { kind: "user", userId: "a1", username: "alice" } as UserOrUserGroup,
        mods: { kind: "user_group", id: 7 } as UserOrUserGroup,
        everyone: { kind: "everyone" },
    };
    const lookup = (username: string) => known[username.toLowerCase()];

    test("become the client's mentions, listing the users", () => {
        expect(expandMentions("hi @alice, @mods and @everyone", lookup)).toEqual({
            text: "hi @UserId(a1), @UserGroup(7) and @everyone",
            mentioned: [known.alice],
        });
    });

    test("leave unknown names as typed, and list a user once", () => {
        expect(expandMentions("@bob @alice @alice", lookup)).toEqual({
            text: "@bob @UserId(a1) @UserId(a1)",
            mentioned: [known.alice],
        });
    });

    test("are found by username, to look up those the chat doesn't hold", () => {
        expect(mentionedUsernames("hi @alice, @Bob_1 and @everyone")).toEqual([
            "alice",
            "Bob_1",
            "everyone",
        ]);
        expect(mentionedUsernames("no mentions")).toEqual([]);
    });
});

/** Invariant: every tree's entry blocks sending for the same reasons, in the old footers' order. */
describe("why a message can't be sent", () => {
    const can: EntryState = {
        suspended: false,
        frozen: false,
        blocked: false,
        previewing: false,
        lapsed: false,
        direct: false,
        externalContent: false,
        anonymous: false,
        canSend: true,
        thread: false,
    };

    test("is nothing when it can", () => {
        expect(entryBlock(can)).toBeUndefined();
    });

    test("is the old footers' reason, in their order", () => {
        expect(entryBlock({ ...can, suspended: true, frozen: true })?.kind).toBe("suspended");
        expect(entryBlock({ ...can, frozen: true, blocked: true })?.kind).toBe("frozen");
        expect(entryBlock({ ...can, blocked: true, previewing: true })?.kind).toBe("blocked");
        // a preview offers Join, even signed out
        expect(entryBlock({ ...can, previewing: true, anonymous: true, canSend: false })).toEqual({
            kind: "preview",
            lapsed: false,
        });
        expect(entryBlock({ ...can, lapsed: true })).toEqual({ kind: "preview", lapsed: true });
        expect(entryBlock({ ...can, externalContent: true, canSend: false })?.kind).toBe(
            "external",
        );
        // a preview of an external channel still offers Join; signed out, it's the disclaimer
        expect(entryBlock({ ...can, previewing: true, externalContent: true })?.kind).toBe(
            "preview",
        );
        expect(
            entryBlock({ ...can, externalContent: true, anonymous: true, canSend: false })?.kind,
        ).toBe("external");
    });

    test("signed out, or not allowed, is read only, a thread's in a thread", () => {
        expect(entryBlock({ ...can, anonymous: true, canSend: false })).toEqual({
            kind: "read_only",
            key: "sendMessageDisabledAnon",
        });
        expect(entryBlock({ ...can, canSend: false })).toEqual({
            kind: "read_only",
            key: "readOnlyChat",
        });
        expect(entryBlock({ ...can, canSend: false, thread: true })).toEqual({
            kind: "read_only",
            key: "readOnlyThread",
        });
    });

    test("a DM is never a preview", () => {
        expect(entryBlock({ ...can, direct: true, previewing: true })).toBeUndefined();
    });
});

describe("telling others someone is typing", () => {
    let now = 0;
    let starts = 0;
    let stops = 0;
    let typing: TypingNotifier;

    beforeEach(() => {
        vi.useFakeTimers();
        now = 0;
        starts = 0;
        stops = 0;
        typing = new TypingNotifier(
            () => starts++,
            () => stops++,
            () => now,
        );
    });
    afterEach(() => vi.useRealTimers());

    test("says so at most once a second while they type", () => {
        typing.input("h");
        now = 500;
        typing.input("hi");
        expect(starts).toBe(1);
        now = 1200;
        typing.input("hi!");
        expect(starts).toBe(2);
    });

    test("says they've stopped after 5s without input", () => {
        typing.input("h");
        vi.advanceTimersByTime(4999);
        expect(stops).toBe(0);
        vi.advanceTimersByTime(1);
        expect(stops).toBe(1);
    });

    test("says they've stopped at once when the draft is emptied or sent, once", () => {
        typing.input("h");
        typing.input("");
        expect(stops).toBe(1);
        typing.stopped();
        vi.advanceTimersByTime(6000);
        expect(stops).toBe(1);
    });

    test("leaving forgets they were typing without telling anyone", () => {
        typing.input("h");
        typing.cancel();
        vi.advanceTimersByTime(6000);
        expect(stops).toBe(0);
        now = 100;
        typing.input("h");
        expect(starts).toBe(2);
    });

    test("starts again at once after stopping", () => {
        typing.input("h");
        typing.stopped();
        now = 100;
        typing.input("h");
        expect(starts).toBe(2);
    });
});

describe("the throttle countdown", () => {
    test("counts whole seconds up, never 0s while throttled, and ends at the deadline", () => {
        expect(throttleCountdown(10_000, 0)?.seconds).toBe(10);
        expect(throttleCountdown(10_000, 9_999)?.seconds).toBe(1);
        expect(throttleCountdown(10_000, 10_000)).toBeUndefined();
        expect(throttleCountdown(0, 5)).toBeUndefined();
    });
});

describe("the entry taking focus when a chat or thread opens", () => {
    test("happens from 992px up", () => {
        expect(focusEntryOnOpen(ScreenWidth.Large, false)).toBe(true);
        expect(focusEntryOnOpen(ScreenWidth.ExtraLarge, false)).toBe(true);
        expect(focusEntryOnOpen(ScreenWidth.ExtraExtraLarge, false)).toBe(true);
    });

    test("doesn't happen below that, where it would bring up the keyboard", () => {
        expect(focusEntryOnOpen(ScreenWidth.Medium, false)).toBe(false);
        expect(focusEntryOnOpen(ScreenWidth.Small, false)).toBe(false);
        expect(focusEntryOnOpen(ScreenWidth.ExtraSmall, false)).toBe(false);
        expect(focusEntryOnOpen(ScreenWidth.ExtraExtraSmall, false)).toBe(false);
    });

    test("doesn't happen on a touch-only device (a tablet), whatever its width", () => {
        expect(focusEntryOnOpen(ScreenWidth.Large, true)).toBe(false);
        expect(focusEntryOnOpen(ScreenWidth.ExtraLarge, true)).toBe(false);
        expect(focusEntryOnOpen(ScreenWidth.ExtraExtraLarge, true)).toBe(false);
    });
});

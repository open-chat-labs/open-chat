import type { UserOrUserGroup } from "@client";
import {
    expandMentions,
    sendBlocked,
    TypingNotifier,
    untilPosted,
    type SendState,
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
});

describe("why a message can't be sent", () => {
    const can: SendState = {
        suspended: false,
        frozen: false,
        blocked: false,
        previewing: false,
        lapsed: false,
        anonymous: false,
        canSend: true,
    };

    test("is nothing when it can", () => {
        expect(sendBlocked(can)).toBeUndefined();
    });

    test("is a suspended account before anything else", () => {
        expect(sendBlocked({ ...can, suspended: true, frozen: true })?.key).toBe(
            "accountSuspended",
        );
    });

    test("is the old footer's reason, a frozen chat first", () => {
        expect(sendBlocked({ ...can, frozen: true, blocked: true })?.key).toBe("chatFrozen");
        expect(sendBlocked({ ...can, blocked: true })?.key).toBe("userIsBlocked");
        expect(sendBlocked({ ...can, lapsed: true, previewing: true })?.key).toBe(
            "access.lapsed.label",
        );
        expect(sendBlocked({ ...can, anonymous: true, canSend: false })?.key).toBe(
            "sendMessageDisabledAnon",
        );
        expect(sendBlocked({ ...can, previewing: true })?.key).toBe("readOnlyChat");
        expect(sendBlocked({ ...can, canSend: false })?.key).toBe("readOnlyChat");
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

describe("waiting for a send", () => {
    const never = new Promise<never>(() => {});

    test("is done once the message is posted", async () => {
        await expect(untilPosted(never, Promise.resolve())).resolves.toBeUndefined();
    });

    test("is refused when throttled or turned down before posting, so the draft stays", async () => {
        await expect(
            untilPosted(Promise.resolve({ kind: "message_throttled" }), never),
        ).rejects.toThrow("message_throttled");
        await expect(untilPosted(Promise.resolve({ kind: "failure" }), never)).rejects.toThrow(
            "failure",
        );
    });

    test("isn't refused by a result after posting", async () => {
        await expect(
            untilPosted(Promise.resolve({ kind: "success" }), never),
        ).resolves.toBeUndefined();
    });
});

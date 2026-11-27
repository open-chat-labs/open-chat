import type { EventWrapper, Message, ProposalContent, ResourceKey } from "@client";
import type { ConversationContext } from "./messageRow";
import { namedInRow, RowCache } from "./rowCache";

const ctx: ConversationContext = {
    me: "me",
    you: "You",
    userName: (id) => ({ alice: "Alice", bob: "Bob" })[id] ?? id,
    contentText: (content) => `[${content.kind}]`,
    mentionsAsTyped: (text) => text.replace(/@UserId\((\w+)\)/g, "@$1"),
    time: (timestamp) => `t${timestamp}`,
    date: (timestamp) => `d${timestamp}`,
    longDate: (timestamp) => `L${timestamp}`,
    dayAndTime: (timestamp) => `D${timestamp}`,
    deletion: () => undefined,
    media: { lowBandwidth: false, revealed: () => false, url: (u) => u },
    direct: false,
    readonly: false,
    now: 0,
    claimant: {
        previewingOrLapsed: false,
        diamond: false,
        lifetimeDiamond: false,
        streak: 0,
        chitEarned: 0,
        accountCreated: 0,
    },
    text: (key) => key.key,
    openThread: undefined,
    face: (userId) => `face:${userId}`,
    avatar: () => undefined,
    unreadInThread: () => 0,
    threads: true,
    undeleting: () => false,
    referralLink: "https://oc.app/?ref=me",
    twitchParent: "oc.app",
    proposalTopics: new Map(),
    proposalVote: () => undefined,
    dailyResult: () => ({ verification: { kind: "pending" }, drawable: true, offersPlay: false }),
    token: () => undefined,
};

function message(
    content: Message["content"] = { kind: "text_content", text: "hi" },
): EventWrapper<Message> {
    return {
        index: 3,
        timestamp: 7n,
        event: {
            kind: "message",
            messageId: 42n,
            messageIndex: 2,
            sender: "alice",
            content,
            reactions: [],
            tips: {},
            edited: false,
            forwarded: false,
            deleted: false,
            blockLevelMarkdown: false,
            ogPreviews: [],
            messagePreviews: [],
        },
    } as unknown as EventWrapper<Message>;
}

/** Invariant: a kept row is never stale: a new event, status (tick) or name makes it again. */
describe("the rows kept per event", () => {
    test("are the same row while the event, its status and its names are", () => {
        const rows = new RowCache();
        const evt = message();
        const first = rows.row("k", evt, "sent", ctx);
        expect(rows.row("k", evt, "sent", { ...ctx })).toBe(first);
    });

    test("are made again for a new event, status or name", () => {
        const rows = new RowCache();
        const evt = message();
        const first = rows.row("k", evt, "sent", ctx);
        expect(rows.row("k", message(), "sent", ctx)).not.toBe(first);
        const second = rows.row("k", evt, "sent", ctx);
        expect(rows.row("k", evt, "delivered", ctx).message).toMatchObject({ status: "delivered" });
        expect(rows.row("k", evt, "delivered", ctx)).not.toBe(second);
        const renamed = { ...ctx, userName: () => "Alicia" };
        expect(rows.row("k", evt, "delivered", renamed).senderName).toBe("Alicia");
    });

    test("are made again when the reader renames themselves, as their own runs show their name", () => {
        const rows = new RowCache();
        const evt = message();
        evt.event.sender = "me";
        const first = rows.row("k", evt, "sent", ctx);
        const renamed = { ...ctx, userName: (id: string) => (id === "me" ? "Ivan" : id) };
        const second = rows.row("k", evt, "sent", renamed);
        expect(second).not.toBe(first);
        expect(second.senderName).toBe("Ivan");
    });

    test("are made again when a quote's mentioned user loads after the row was made", () => {
        const rows = new RowCache();
        const evt = message();
        evt.event.repliesTo = {
            kind: "rehydrated_reply_context",
            senderId: "bob",
            content: { kind: "text_content", text: "ask @UserId(carol)" },
        } as unknown as Message["repliesTo"];
        const unknown = { ...ctx, mentionsAsTyped: (text: string) => text };
        const first = rows.row("k", evt, "sent", unknown);
        expect(first.message).toMatchObject({ quoteText: "ask @UserId(carol)" });
        const second = rows.row("k", evt, "sent", ctx);
        expect(second).not.toBe(first);
        expect(second.message).toMatchObject({ quoteText: "ask @carol" });
        expect(rows.row("k", evt, "sent", ctx)).toBe(second);
    });

    test("are made again when the sender's picture arrives or changes", () => {
        const rows = new RowCache();
        const evt = message();
        const first = rows.row("k", evt, "sent", ctx);
        expect(first.avatarUrl).toBeUndefined();
        const pictured = { ...ctx, avatar: (id: string) => `https://blobs/${id}` };
        const second = rows.row("k", evt, "sent", pictured);
        expect(second).not.toBe(first);
        expect(second.avatarUrl).toBe("https://blobs/alice");
        expect(rows.row("k", evt, "sent", { ...pictured })).toBe(second);
    });

    test("are made again only where the open thread changes which row's thread is selected", () => {
        const rows = new RowCache();
        const threaded = (messageIndex: number) => {
            const evt = message();
            evt.event.messageIndex = messageIndex;
            evt.event.thread = {
                numberOfReplies: 1,
                latestEventTimestamp: 1n,
                participantIds: new Set(["bob"]),
            } as Message["thread"];
            return evt;
        };
        const a = threaded(2);
        const b = threaded(5);
        const c = threaded(8);
        const shown = (open: number | undefined) => {
            const at = { ...ctx, openThread: open };
            return [
                rows.row("a", a, "sent", at),
                rows.row("b", b, "sent", at),
                rows.row("c", c, "sent", at),
            ];
        };
        const none = shown(undefined);
        // a's thread opens: only a is made again
        const aOpen = shown(2);
        expect(aOpen[0]).not.toBe(none[0]);
        expect(aOpen[0].message.threadActive).toBe(true);
        expect(aOpen[1]).toBe(none[1]);
        expect(aOpen[2]).toBe(none[2]);
        // then b's: a and b are, c is kept
        const bOpen = shown(5);
        expect(bOpen[0].message.threadActive).toBe(false);
        expect(bOpen[1].message.threadActive).toBe(true);
        expect(bOpen[2]).toBe(none[2]);
        // a message without a thread at the open index is kept
        const plain = message();
        const kept = rows.row("p", plain, "sent", ctx);
        expect(rows.row("p", plain, "sent", { ...ctx, openThread: 2 })).toBe(kept);
    });

    test("are made again when a thread's unread replies change, only for its root (pass 8)", () => {
        const rows = new RowCache();
        const root = message();
        root.event.messageIndex = 4;
        root.event.thread = {
            numberOfReplies: 3,
            latestEventTimestamp: 1n,
            participantIds: new Set(["bob"]),
        } as Message["thread"];
        const plain = message();
        const at = (unread: number) => ({ ...ctx, unreadInThread: () => unread });
        const before = rows.row("r", root, "sent", at(2));
        const plainBefore = rows.row("p", plain, "sent", at(2));
        expect(before.message.threadNew).toBe(2);
        // read: the root's row is made again, "· N new" gone
        const after = rows.row("r", root, "sent", at(0));
        expect(after).not.toBe(before);
        expect(after.message.threadNew).toBe(0);
        expect(rows.row("p", plain, "sent", at(0))).toBe(plainBefore);
    });

    test("are made again when the picture of someone in a thread arrives, for its link's faces", () => {
        const rows = new RowCache();
        const root = message();
        root.event.thread = {
            numberOfReplies: 1,
            latestEventTimestamp: 1n,
            participantIds: new Set(["bob"]),
        } as Message["thread"];
        const before = rows.row("r", root, "sent", ctx);
        // bob's picture loads (alice, the sender, has none)
        const pictured = {
            ...ctx,
            avatar: (id: string) => (id === "bob" ? "https://blobs/bob" : undefined),
        };
        const after = rows.row("r", root, "sent", pictured);
        expect(after).not.toBe(before);
        expect(after.message.threadFaces).toEqual(["https://blobs/bob"]);
        expect(rows.row("r", root, "sent", { ...pictured })).toBe(after);
    });

    test("are made again once cleared", () => {
        const rows = new RowCache();
        const evt = message();
        const first = rows.row("k", evt, "sent", ctx);
        rows.clear();
        expect(rows.row("k", evt, "sent", ctx)).not.toBe(first);
    });

    test("are made again as a deleted message starts or stops being undeleted", () => {
        const rows = new RowCache();
        const evt = message({ kind: "deleted_content", deletedBy: "bob", timestamp: 1n });
        const first = rows.row("k", evt, "sent", ctx);
        const undeleting = { ...ctx, undeleting: () => true };
        const second = rows.row("k", evt, "sent", undeleting);
        expect(second).not.toBe(first);
        expect(second.message).toMatchObject({ deletedText: "undeletingMessage" });
        expect(rows.row("k", evt, "sent", undeleting)).toBe(second);
    });

    test("are made again as the name of whoever deleted a message loads", () => {
        const rows = new RowCache();
        const evt = message({ kind: "deleted_content", deletedBy: "carol", timestamp: 1n });
        const words = { ...ctx, text: (key: ResourceKey) => `${key.key} ${key.params?.name}` };
        const first = rows.row("k", evt, "sent", words);
        expect(first.message).toMatchObject({ deletedBy: "deletedMessage.by carol" });
        const named = { ...words, userName: (id: string) => (id === "carol" ? "Carol" : id) };
        const second = rows.row("k", evt, "sent", named);
        expect(second).not.toBe(first);
        expect(second.message).toMatchObject({ deletedBy: "deletedMessage.by Carol" });
    });

    test("are made again as the reader votes on a proposal", () => {
        const rows = new RowCache();
        const evt = message();
        evt.event.content = {
            kind: "proposal_content",
            governanceCanisterId: "gov",
            proposal: {
                kind: "nns",
                topic: 4,
                title: "T",
                proposer: "n1",
                deadline: 0,
                tally: { yes: 0, no: 0, total: 1, timestamp: 0n },
            } as ProposalContent["proposal"],
        };
        const first = rows.row("k", evt, "sent", ctx);
        expect(rows.row("k", evt, "sent", ctx)).toBe(first);
        const voting = { ...ctx, proposalVote: () => "adopting" as const };
        expect(rows.row("k", evt, "sent", voting)).not.toBe(first);
    });

    test("are made again as a daily puzzle result's check lands, and as its Play comes or goes", () => {
        const rows = new RowCache();
        const evt = message();
        evt.event.content = {
            kind: "daily_result",
            gameId: "bridges",
            number: 12,
            userId: "alice",
            solveTimeMs: 1,
            hintsUsed: 0,
            streak: 1,
            layout: "",
        };
        const view = (verified: boolean, offersPlay: boolean): ConversationContext => ({
            ...ctx,
            dailyResult: () => ({
                verification: verified ? { kind: "unverified" } : { kind: "pending" },
                drawable: true,
                offersPlay,
            }),
        });
        const first = rows.row("k", evt, "sent", view(false, false));
        expect(rows.row("k", evt, "sent", view(false, false))).toBe(first);
        const checked = rows.row("k", evt, "sent", view(true, false));
        expect(checked).not.toBe(first);
        expect(rows.row("k", evt, "sent", view(true, true))).not.toBe(checked);
    });

    test("are made again as a proposal's time left changes and as its voting ends", () => {
        const MINUTE = 60_000;
        const rows = new RowCache();
        const evt = message();
        evt.event.content = {
            kind: "proposal_content",
            governanceCanisterId: "gov",
            proposal: {
                kind: "nns",
                topic: 4,
                title: "T",
                proposer: "n1",
                deadline: 10 * MINUTE,
                tally: { yes: 0, no: 0, total: 1, timestamp: 0n },
            } as ProposalContent["proposal"],
        };
        const first = rows.row("k", evt, "sent", { ...ctx, now: 0 });
        // the same time left ("10m"): the same row
        expect(rows.row("k", evt, "sent", { ...ctx, now: 1000 })).toBe(first);
        const later = rows.row("k", evt, "sent", { ...ctx, now: 5 * MINUTE });
        expect(later).not.toBe(first);
        const ended = rows.row("k", evt, "sent", { ...ctx, now: 10 * MINUTE });
        expect(ended).not.toBe(later);
        expect(ended.message).toMatchObject({ canVote: false });
    });

    test("are made again as the names a row shows besides its sender's load", () => {
        const named = {
            ...ctx,
            userName: (id: string) => ({ carol: "Carol", dan: "Dan" })[id] ?? id,
        };
        const kinds: Message["content"][] = [
            { kind: "deleted_content", deletedBy: "carol", timestamp: 1n },
            {
                kind: "prize_winner_content",
                transaction: { recipient: "carol" },
            } as Message["content"],
            {
                kind: "crypto_content",
                transfer: { kind: "completed", recipient: "carol" },
            } as Message["content"],
        ];
        for (const content of kinds) {
            const rows = new RowCache();
            const evt = message(content);
            const first = rows.row("k", evt, "sent", ctx);
            expect(rows.row("k", evt, "sent", ctx)).toBe(first);
            expect(rows.row("k", evt, "sent", named)).not.toBe(first);
        }
        const rows = new RowCache();
        const tipped = message();
        tipped.event.tips = { icp: { dan: 5n } };
        const first = rows.row("k", tipped, "sent", ctx);
        expect(rows.row("k", tipped, "sent", named)).not.toBe(first);
    });
});

describe("the names a row shows besides its sender's", () => {
    test("are the deleter's, a transfer's or prize win's recipient's, and the tippers'", () => {
        const name = { userName: (id: string) => id.toUpperCase(), deletion: () => undefined };
        const msg = (content: object, tips: Message["tips"] = {}): Message => ({
            ...message(content as Message["content"]).event,
            tips,
        });
        expect(namedInRow(msg({ kind: "deleted_content", deletedBy: "bob" }), name)).toEqual([
            "BOB",
        ]);
        expect(
            namedInRow(
                msg({ kind: "prize_winner_content", transaction: { recipient: "a" } }),
                name,
            ),
        ).toEqual(["A"]);
        expect(
            namedInRow(msg({ kind: "crypto_content", transfer: { recipient: "b" } }), name),
        ).toEqual(["B"]);
        expect(
            namedInRow(
                msg({ kind: "text_content" }, { icp: { x: 1n, y: 2n }, chat: { z: 1n } }),
                name,
            ),
        ).toEqual(["X", "Y", "Z"]);
    });
});

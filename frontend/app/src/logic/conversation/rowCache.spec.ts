import type { EventWrapper, Message } from "@client";
import type { ConversationContext } from "./messageRow";
import { RowCache } from "./rowCache";

const ctx: ConversationContext = {
    me: "me",
    you: "You",
    userName: (id) => ({ alice: "Alice", bob: "Bob" })[id] ?? id,
    contentText: (content) => `[${content.kind}]`,
    mentionsAsTyped: (text) => text.replace(/@UserId\((\w+)\)/g, "@$1"),
    time: (timestamp) => `t${timestamp}`,
    date: (timestamp) => `d${timestamp}`,
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
    unreadInThread: () => 0,
    threads: true,
    token: () => undefined,
};

function message(): EventWrapper<Message> {
    return {
        index: 3,
        timestamp: 7n,
        event: {
            kind: "message",
            messageId: 42n,
            messageIndex: 2,
            sender: "alice",
            content: { kind: "text_content", text: "hi" },
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

    test("are made again once cleared", () => {
        const rows = new RowCache();
        const evt = message();
        const first = rows.row("k", evt, "sent", ctx);
        rows.clear();
        expect(rows.row("k", evt, "sent", ctx)).not.toBe(first);
    });
});

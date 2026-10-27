import type { EventWrapper, Message } from "@client";
import type { ConversationContext } from "./conversation.adapter";
import { RowCache } from "./rowCache";

const ctx: ConversationContext = {
    me: "me",
    you: "You",
    userName: (id) => ({ alice: "Alice", bob: "Bob" })[id] ?? id,
    contentText: (content) => `[${content.kind}]`,
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
    },
    text: (key) => key.key,
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

    test("are made again once cleared", () => {
        const rows = new RowCache();
        const evt = message();
        const first = rows.row("k", evt, "sent", ctx);
        rows.clear();
        expect(rows.row("k", evt, "sent", ctx)).not.toBe(first);
    });
});

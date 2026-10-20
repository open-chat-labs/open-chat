import type { ChatEvent, EventWrapper, Message } from "@client";
import {
    eventLines,
    messageRow,
    MessageRows,
    messageStatus,
    senderColor,
    type ConversationContext,
    type EventContext,
} from "./conversation.adapter";

const ctx: ConversationContext = {
    me: "me",
    you: "You",
    userName: (id) => ({ alice: "Alice", bob: "Bob" })[id] ?? id,
    contentText: (content) => `[${content.kind}]`,
    time: (timestamp) => `t${timestamp}`,
    date: (timestamp) => `d${timestamp}`,
};

function message(fields: Partial<Message> = {}): EventWrapper<Message> {
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
            ...fields,
        },
    } as unknown as EventWrapper<Message>;
}

describe("a message's status", () => {
    const state = { failed: false, confirmed: true, accepted: true, readByThem: false };

    test("is failed before anything else", () => {
        expect(messageStatus({ ...state, failed: true, confirmed: false })).toBe("failed");
    });

    test("is sending until it's confirmed and accepted", () => {
        expect(messageStatus({ ...state, confirmed: false })).toBe("sending");
        expect(messageStatus({ ...state, accepted: false })).toBe("sending");
    });

    test("is delivered (the double tick) once read by them, else sent", () => {
        expect(messageStatus(state)).toBe("sent");
        expect(messageStatus({ ...state, readByThem: true })).toBe("delivered");
    });
});

describe("a message row", () => {
    test("is someone else's text, with its sender, id and time", () => {
        expect(messageRow(message(), "sent", ctx)).toMatchObject({
            side: "received",
            senderName: "Alice",
            color: senderColor("alice"),
            message: { id: "42", kind: "text", text: "hi", time: "t7", status: "sent" },
        });
    });

    test("is the reader's own as sent, by You", () => {
        expect(messageRow(message({ sender: "me" }), "sending", ctx)).toMatchObject({
            side: "sent",
            senderName: "You",
            message: { status: "sending" },
        });
    });

    test("shows other kinds as their text, and a deleted message as deleted", () => {
        const image = message({ content: { kind: "image_content" } as Message["content"] });
        expect(messageRow(image, "sent", ctx).message.text).toBe("[image_content]");
        const deleted = message({ content: { kind: "deleted_content" } as Message["content"] });
        expect(messageRow(deleted, "sent", ctx).message.deleted).toBe(true);
    });

    test("counts reactions, marking the reader's own", () => {
        const reacted = message({
            reactions: [
                { reaction: "👍", userIds: new Set(["me", "bob"]) },
                { reaction: "🎉", userIds: new Set(["bob"]) },
            ],
        });
        expect(messageRow(reacted, "sent", ctx).message.reactions).toEqual([
            { emoji: "👍", count: 2, mine: true },
            { emoji: "🎉", count: 1, mine: false },
        ]);
    });

    test("quotes the message it replies to, the reader's own as You", () => {
        const reply = (senderId: string) =>
            message({
                repliesTo: {
                    kind: "rehydrated_reply_context",
                    senderId,
                    content: { kind: "text_content", text: "earlier" },
                } as Message["repliesTo"],
            });
        expect(messageRow(reply("bob"), "sent", ctx).message).toMatchObject({
            quoteName: "Bob",
            quoteText: "earlier",
        });
        expect(messageRow(reply("me"), "sent", ctx).message.quoteName).toBe("You");
    });

    test("has its thread's reply count and last reply", () => {
        const threaded = message({
            thread: { numberOfReplies: 4, latestEventTimestamp: 9n } as Message["thread"],
        });
        expect(messageRow(threaded, "sent", ctx).message).toMatchObject({
            threadCount: 4,
            threadLastAt: "d9",
        });
    });

    test("isn't edited when a bot finalises its message", () => {
        const edited = (senderContext?: Message["senderContext"]) =>
            messageRow(message({ edited: true, senderContext }), "sent", ctx).message.edited;
        expect(edited()).toBe(true);
        expect(edited({ kind: "bot", finalised: true } as Message["senderContext"])).toBe(false);
    });
});

describe("an event's lines", () => {
    const events: EventContext = {
        me: "me",
        you: "you",
        userName: ctx.userName,
        members: (ids) => ids.map(ctx.userName).join(", "),
        t: (key, values) => `${key}${values ? JSON.stringify(values) : ""}`,
        level: "group",
    };
    const lines = (event: Partial<ChatEvent>) => eventLines(event as ChatEvent, events);

    test("say who created the group", () => {
        expect(lines({ kind: "group_chat_created", created_by: "me" } as never)).toEqual([
            'groupCreatedBy{"username":"you","level":"group"}',
        ]);
    });

    test("say who was added, and by whom", () => {
        expect(
            lines({ kind: "members_added", userIds: ["alice", "bob"], addedBy: "me" } as never),
        ).toEqual(['addedBy{"changed":"Alice, Bob","changedBy":"you","level":"group"}']);
    });

    test("fold joins and deletions into a line each", () => {
        const aggregate = {
            kind: "aggregate_common_events",
            usersJoined: new Set(["alice"]),
            usersLeft: new Set(),
            rolesChanged: new Map(),
            messagesDeleted: [4, 5],
        };
        expect(lines(aggregate as never)).toEqual([
            'userJoined{"username":"Alice","level":"group"}',
            'nMessagesDeleted{"number":2}',
        ]);
    });

    test("count joins past ten", () => {
        const many = new Set(Array.from({ length: 11 }, (_, i) => `u${i}`));
        const aggregate = {
            kind: "aggregate_common_events",
            usersJoined: many,
            usersLeft: new Set(),
            rolesChanged: new Map(),
            messagesDeleted: [],
        };
        expect(lines(aggregate as never)).toEqual(['nUsersJoined{"number":11,"level":"group"}']);
    });

    test("are none for the kinds left out so far", () => {
        expect(lines({ kind: "chat_frozen" } as never)).toEqual([]);
    });
});

describe("the rows kept per event", () => {
    test("are the same row while the event, its status and its names are", () => {
        const rows = new MessageRows();
        const evt = message();
        const first = rows.row("k", evt, "sent", ctx);
        expect(rows.row("k", evt, "sent", { ...ctx })).toBe(first);
    });

    test("are made again for a new event, status or name", () => {
        const rows = new MessageRows();
        const evt = message();
        const first = rows.row("k", evt, "sent", ctx);
        expect(rows.row("k", message(), "sent", ctx)).not.toBe(first);
        const second = rows.row("k", evt, "sent", ctx);
        expect(rows.row("k", evt, "delivered", ctx)).not.toBe(second);
        const renamed = { ...ctx, userName: () => "Alicia" };
        expect(rows.row("k", evt, "delivered", renamed).senderName).toBe("Alicia");
    });

    test("are made again once cleared", () => {
        const rows = new MessageRows();
        const evt = message();
        const first = rows.row("k", evt, "sent", ctx);
        rows.clear();
        expect(rows.row("k", evt, "sent", ctx)).not.toBe(first);
    });
});

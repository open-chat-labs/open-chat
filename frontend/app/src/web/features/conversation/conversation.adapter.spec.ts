import type { EventWrapper, Message } from "@client";
import {
    mediaHeld,
    messageRow,
    messageStatus,
    senderColor,
    untilNextDay,
    type ConversationContext,
} from "./conversation.adapter";

const ctx: ConversationContext = {
    me: "me",
    you: "You",
    userName: (id) => ({ alice: "Alice", bob: "Bob" })[id] ?? id,
    contentText: (content) => `[${content.kind}]`,
    time: (timestamp) => `t${timestamp}`,
    date: (timestamp) => `d${timestamp}`,
    media: { lowBandwidth: false, revealed: () => false, url: (u) => u },
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
    const state = { failed: false, accepted: true, readByThem: false };

    test("is failed before anything else", () => {
        expect(messageStatus({ ...state, failed: true, accepted: false })).toBe("failed");
    });

    test("is sending until it's accepted, as the old ticks", () => {
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
        // a kind not built yet
        const poll = message({ content: { kind: "poll_content" } as Message["content"] });
        expect(messageRow(poll, "sent", ctx).message).toMatchObject({ text: "[poll_content]" });
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
        expect(messageRow(reply("me"), "sent", ctx).message).toMatchObject({ quoteName: "You" });
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
            (
                messageRow(message({ edited: true, senderContext }), "sent", ctx).message as {
                    edited?: boolean;
                }
            ).edited;
        expect(edited()).toBe(true);
        expect(edited({ kind: "bot", finalised: true } as Message["senderContext"])).toBe(false);
    });
});

describe("the time until the next day", () => {
    test("runs to the coming local midnight", () => {
        expect(untilNextDay(new Date(2026, 9, 20, 23, 59, 30))).toBe(30_000);
        expect(untilNextDay(new Date(2026, 9, 20, 0, 0, 0))).toBe(24 * 60 * 60 * 1000);
    });
});

describe("media", () => {
    const image = {
        kind: "image_content",
        width: 400,
        height: 300,
        thumbnailData: "data:image/jpeg;base64,THUMB",
        blobUrl: "https://blob/full.jpg",
        mimeType: "image/jpeg",
    } as const;
    const gif = {
        kind: "giphy_content",
        title: "cat",
        desktop: { url: "https://g/full.mp4", width: 480, height: 270, mimeType: "video/mp4" },
        mobile: { url: "https://g/full.gif", width: 240, height: 135, mimeType: "image/gif" },
    } as const;
    const urls = (lowBandwidth: boolean, revealed: boolean, content: unknown) => {
        const row = messageRow(message({ content: content as Message["content"] }), "sent", {
            ...ctx,
            media: { lowBandwidth, revealed: () => revealed, url: (u) => u },
        });
        return JSON.stringify(row.message);
    };

    // 5a invariant 1: in low bandwidth a full-size image or GIF isn't handed to the view until the
    // reader asks for it
    test("in low bandwidth the full-size image or GIF is held back until revealed", () => {
        expect(urls(true, false, image)).not.toContain("https://blob/full.jpg");
        expect(urls(true, false, image)).toContain("THUMB");
        expect(urls(true, false, gif)).not.toContain("https://g/full");
        expect(urls(true, true, image)).toContain("https://blob/full.jpg");
        expect(urls(false, false, gif)).toContain("https://g/full.gif");
    });

    // 5a invariant 1: a click on a held tile reveals it rather than opening the full-size viewer
    test("an image or GIF is held in low bandwidth until revealed", () => {
        const media = (lowBandwidth: boolean, revealed: boolean) => ({
            lowBandwidth,
            revealed: () => revealed,
            url: (u: string | undefined) => u,
        });
        expect(mediaHeld(image, 42n, media(true, false))).toBe(true);
        expect(mediaHeld(gif, 42n, media(true, false))).toBe(true);
        expect(mediaHeld(gif, 42n, media(true, true))).toBe(false);
        expect(mediaHeld(image, 42n, media(false, false))).toBe(false);
    });
});

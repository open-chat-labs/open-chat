import type { ChatSummary, EventWrapper, Message } from "@client";
import {
    conversationContext,
    mediaHeld,
    messageRow,
    messageStatus,
    senderColor,
    untilNextDay,
    withFields,
    type ConversationContext,
} from "./messageRow";

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
    openThread: undefined,
    face: (userId) => `face:${userId}`,
    unreadInThread: () => 0,
    threads: true,
    token: (ledger) =>
        ledger === "icp"
            ? {
                  symbol: "ICP",
                  logo: "icp.svg",
                  amount: (e8s) => String(Number(e8s) / 1e8),
                  usd: () => "$1",
              }
            : undefined,
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
        const proposal = message({ content: { kind: "proposal_content" } as Message["content"] });
        expect(messageRow(proposal, "sent", ctx).message).toMatchObject({
            text: "[proposal_content]",
        });
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

    test("has its thread's reply count, last reply and the faces of those in it", () => {
        const threaded = message({
            thread: {
                numberOfReplies: 4,
                latestEventTimestamp: 9n,
                participantIds: new Set(["alice", "bob"]),
            } as Message["thread"],
        });
        expect(messageRow(threaded, "sent", ctx).message).toMatchObject({
            threadCount: 4,
            threadLastAt: "d9",
            threadFaces: ["face:alice", "face:bob"],
            threadNew: 0,
            threadActive: false,
        });
    });

    test("has no thread without one", () => {
        expect(messageRow(message(), "sent", ctx).message).toMatchObject({
            threadCount: 0,
            threadLastAt: undefined,
            threadFaces: [],
            threadActive: false,
        });
    });

    test("has up to three faces, and its unread replies as the thread's root (pass 8)", () => {
        const threaded = message({
            messageIndex: 7,
            thread: {
                numberOfReplies: 9,
                latestEventTimestamp: 9n,
                participantIds: new Set(["a", "b", "c", "d"]),
            } as Message["thread"],
        });
        const unreadInThread = (root: number) => (root === 7 ? 2 : 0);
        expect(messageRow(threaded, "sent", { ...ctx, unreadInThread }).message).toMatchObject({
            threadFaces: ["face:a", "face:b", "face:c"],
            threadNew: 2,
        });
        // a message without a thread has nothing new, whatever its index
        expect(
            messageRow(message({ messageIndex: 7 }), "sent", { ...ctx, unreadInThread }).message,
        ).toMatchObject({ threadNew: 0 });
    });

    test("has no thread link in a view without threads (the native tree, for now)", () => {
        const threaded = message({
            messageIndex: 2,
            thread: {
                numberOfReplies: 3,
                latestEventTimestamp: 9n,
                participantIds: new Set(["bob"]),
            } as Message["thread"],
        });
        const off = { ...ctx, threads: false, openThread: 2, unreadInThread: () => 1 };
        expect(messageRow(threaded, "sent", off).message).toMatchObject({
            threadCount: 0,
            threadLastAt: undefined,
            threadFaces: [],
            threadNew: 0,
            threadActive: false,
        });
    });

    test("marks its thread active while it's the one open beside the conversation", () => {
        const threaded = message({
            messageIndex: 2,
            thread: {
                numberOfReplies: 1,
                latestEventTimestamp: 9n,
                participantIds: new Set(["bob"]),
            } as Message["thread"],
        });
        const active = (openThread: number | undefined) =>
            messageRow(threaded, "sent", { ...ctx, openThread }).message.threadActive;
        expect(active(2)).toBe(true);
        expect(active(3)).toBe(false);
        expect(active(undefined)).toBe(false);
        // a message with no thread isn't, even at the open thread's index (a thread just started)
        expect(messageRow(message(), "sent", { ...ctx, openThread: 2 }).message.threadActive).toBe(
            false,
        );
    });

    test('has its thread whatever its kind (4c: "N replies" under every kind)', () => {
        const file = message({
            content: {
                kind: "file_content",
                name: "a.pdf",
                mimeType: "application/pdf",
                fileSize: 10,
                blobUrl: "u",
            } as Message["content"],
            thread: {
                numberOfReplies: 2,
                latestEventTimestamp: 5n,
                participantIds: new Set(["bob"]),
            } as Message["thread"],
        });
        expect(messageRow(file, "sent", { ...ctx, openThread: 2 }).message).toMatchObject({
            kind: "file",
            threadCount: 2,
            threadLastAt: "d5",
            threadFaces: ["face:bob"],
            threadActive: true,
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

describe("link previews", () => {
    const preview = (url: string) => ({
        kind: "opengraph" as const,
        url,
        title: "T",
        description: "",
    });
    const cards = (...urls: string[]) => {
        const row = messageRow(message({ ogPreviews: urls.map(preview) }), "sent", ctx).message;
        return (row as { previews: { url: string }[] }).previews.map((c) => c.url);
    };

    // invariant 6
    test("a link preview whose URL isn't http(s) is never rendered as a link", () => {
        expect(cards("javascript:alert(1)", "data:text/html,x", "https://a.com/x")).toEqual([
            "",
            "",
            "https://a.com/x",
        ]);
    });
});

describe("transfers", () => {
    const transfer = (sender: string, recipient: string, ledger = "icp") =>
        message({
            sender,
            content: {
                kind: "crypto_content",
                transfer: {
                    kind: "completed",
                    ledger,
                    recipient,
                    sender,
                    amountE8s: 500_000_000n,
                    feeE8s: 10_000n,
                    memo: 0n,
                    blockIndex: 1n,
                },
            },
        } as Partial<Message>);

    test("go the reader's way: in for theirs, out for their own, other between two others, naming who got it", () => {
        expect(messageRow(transfer("bob", "me"), "sent", ctx).message).toMatchObject({
            kind: "transfer",
            amount: "5",
            symbol: "ICP",
            direction: "in",
            recipient: undefined,
        });
        expect(messageRow(transfer("me", "bob"), "sent", ctx).message).toMatchObject({
            direction: "out",
            recipient: "Bob",
        });
        expect(messageRow(transfer("alice", "bob"), "sent", ctx).message).toMatchObject({
            direction: "other",
            recipient: "Bob",
        });
        expect(
            messageRow(transfer("me", "bob"), "sent", { ...ctx, direct: true }).message,
        ).toMatchObject({ direction: "out", recipient: undefined });
    });

    test("in a ledger the registry doesn't carry, show as text", () => {
        expect(messageRow(transfer("bob", "me", "unknown"), "sent", ctx).message).toMatchObject({
            kind: "text",
            text: "[crypto_content]",
        });
    });
});

describe("prizes", () => {
    const prize = (ledger: string) =>
        message({
            content: {
                kind: "prize_content",
                prizesRemaining: 1,
                prizesPending: 0,
                diamondOnly: false,
                lifetimeDiamondOnly: false,
                uniquePersonOnly: false,
                streakOnly: 0,
                winnerCount: 0,
                userIsWinner: false,
                token: "ICP",
                ledger,
                endDate: 1n,
                minChitEarned: 0,
            },
        } as Partial<Message>);

    // several ledgers can share a symbol
    test("look their token up by ledger, not symbol", () => {
        expect(messageRow(prize("icp"), "sent", ctx).message).toMatchObject({
            kind: "prize",
            token: { symbol: "ICP", gradient: 'url("icp.svg") center / cover' },
        });
    });

    test("in a ledger the registry doesn't carry, show as text", () => {
        expect(messageRow(prize("unknown"), "sent", ctx).message).toMatchObject({
            kind: "text",
            text: "[prize_content]",
        });
    });

    const sending = () =>
        message({
            content: {
                kind: "prize_content_initial",
                diamondOnly: true,
                lifetimeDiamondOnly: false,
                uniquePersonOnly: false,
                streakOnly: 0,
                minChitEarned: 0,
                endDate: BigInt(Date.now() + 86_400_000),
                caption: "Good luck",
                transfer: {
                    kind: "pending",
                    ledger: "icp",
                    token: "ICP",
                    recipient: "escrow",
                    amountE8s: 30_000n,
                    createdAtNanos: 0n,
                },
                prizes: [10_000n, 10_000n, 10_000n],
                fees: 0n,
                amount: 30_000n,
            },
        } as Partial<Message>);

    // until it lands, the card as it will be, with nothing to claim yet
    test("still being sent, show as the card it will be", () => {
        expect(messageRow(sending(), "sending", ctx).message).toMatchObject({
            kind: "prize",
            sending: true,
            canClaim: false,
            winners: 3,
            claimed: 0,
            state: "open",
            note: "Good luck",
            token: { symbol: "ICP" },
            gates: [{ label: expect.any(String) }],
        });
    });

    test("that failed to send, show as text, which says so", () => {
        expect(messageRow(sending(), "failed", ctx).message).toMatchObject({ kind: "text" });
    });
});

describe("swap offers", () => {
    const swap = (sender: string, ledger1 = "icp") =>
        message({
            sender,
            content: {
                kind: "p2p_swap_content",
                token0: { symbol: "ICP", ledger: "icp", decimals: 8, fee: 10_000n },
                token1: { symbol: "ICP", ledger: ledger1, decimals: 8, fee: 10_000n },
                token0Amount: 100_000_000n,
                token1Amount: 300_000_000n,
                expiresAt: 1000n,
                status: { kind: "p2p_swap_open" },
                swapId: 1,
                token0TxnIn: 1n,
            },
        } as Partial<Message>);

    // the sender pays token0 and gets token1; anyone accepting pays token1 and gets token0
    test("read from the reader's side", () => {
        expect(messageRow(swap("me"), "sent", ctx).message).toMatchObject({
            kind: "swap",
            give: { amount: "1.00" },
            get: { amount: "3.00" },
            state: "open",
        });
        expect(messageRow(swap("bob"), "sent", ctx).message).toMatchObject({
            give: { amount: "3.00" },
            get: { amount: "1.00" },
        });
    });

    test("stay open to a reader previewing the chat, with nothing to do", () => {
        expect(messageRow(swap("bob"), "sent", { ...ctx, readonly: true }).message).toMatchObject({
            state: "open",
            canAct: false,
        });
    });

    test("with a token the registry doesn't carry, show as text", () => {
        expect(messageRow(swap("bob", "unknown"), "sent", ctx).message).toMatchObject({
            kind: "text",
            text: "[p2p_swap_content]",
        });
    });

    const sending = () =>
        message({
            sender: "me",
            content: {
                kind: "p2p_swap_content_initial",
                token0: { symbol: "ICP", ledger: "icp", decimals: 8, fee: 10_000n },
                token1: { symbol: "ICP", ledger: "icp", decimals: 8, fee: 10_000n },
                token0Amount: 100_000_000n,
                token1Amount: 300_000_000n,
                caption: "Anyone?",
                expiresIn: 86_400_000n,
            },
        } as Partial<Message>);

    // until it lands, the card as it will be, with nothing to do yet
    test("still being sent, show as the card it will be", () => {
        expect(messageRow(sending(), "sending", ctx).message).toMatchObject({
            kind: "swap",
            sending: true,
            canAct: false,
            state: "open",
            give: { amount: "1.00" },
            get: { amount: "3.00" },
            caption: "Anyone?",
        });
    });

    test("that failed to send, show as text, which says so", () => {
        expect(messageRow(sending(), "failed", ctx).message).toMatchObject({ kind: "text" });
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

describe("composing a message with more fields", () => {
    test("keeps its getters live, and adds the fields", () => {
        let seconds = 0;
        const voice = {
            id: "m1",
            get progress() {
                return seconds / 10;
            },
        };

        const composed = withFields(voice, { id: "m2" });
        expect(composed.id).toBe("m2");
        expect(composed.progress).toBe(0);
        seconds = 5;
        expect(composed.progress).toBe(0.5);
    });

    test("doesn't change the message it's given", () => {
        const message = { id: "m1", menu: false };
        const composed = withFields(message, { menu: true });

        expect(composed.menu).toBe(true);
        expect(message.menu).toBe(false);
    });
});

describe("a conversation's context", () => {
    test("counts a thread's unread replies as the list of threads does, none unfollowed (pass 8)", () => {
        const chat = {
            kind: "channel",
            id: { kind: "channel", communityId: "c", channelId: 1 },
            membership: { latestThreads: [{ threadRootMessageIndex: 4, latestMessageIndex: 6 }] },
        } as unknown as ChatSummary;
        const asked: [number, number][] = [];
        const ctx = conversationContext({
            client: {
                displayName: () => "",
                getContentAsText: () => "",
                toShortTimeString: () => "",
                formatMessageDate: () => "",
                isChatReadOnly: () => false,
                unreadThreadMessageCount: (_, root, latest) => {
                    asked.push([root, latest]);
                    return latest - 4;
                },
            },
            chat,
            me: "me",
            formatter: (key) => String(key),
            users: new Map(),
            webhooks: new Map(),
            webhookIds: new Set<string>(),
            detailsLoaded: true,
            lowBandwidth: false,
            revealed: () => false,
            claimant: {
                previewingOrLapsed: false,
                diamond: false,
                lifetimeDiamond: false,
                streak: 0,
                chitEarned: 0,
            },
            tokens: new Map(),
            rates: () => new Map(),
            face: (userId) => userId,
            threads: true,
        });
        expect(ctx.unreadInThread(4)).toBe(2);
        expect(asked).toEqual([[4, 6]]);
        // a thread the chat doesn't list as followed
        expect(ctx.unreadInThread(5)).toBe(0);
    });
});

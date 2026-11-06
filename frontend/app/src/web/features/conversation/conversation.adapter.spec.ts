import type { EventWrapper, Message, MessageMenuAction } from "@client";
import {
    composerAttachment,
    composerContext,
    composerMention,
    composerStartText,
    mediaHeld,
    messageMenuItems,
    messageRow,
    messageStatus,
    senderColor,
    untilNextDay,
    withFields,
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

describe("the composer's reply or edit strip", () => {
    const quoted = message().event;
    const replyingTo = {
        kind: "rehydrated_reply_context" as const,
        senderId: "alice",
        eventIndex: 3,
        content: quoted.content,
        messageId: 42n,
        messageIndex: 2,
        edited: false,
        isThreadRoot: false,
        sourceContext: { chatId: { kind: "group_chat" as const, groupId: "g" } },
    };

    test("is none without a reply or an edit", () => {
        expect(composerContext(undefined, ctx, undefined)).toBeNull();
        expect(composerContext({}, ctx, undefined)).toBeNull();
    });

    test("quotes the message replied to, with who wrote it", () => {
        expect(composerContext({ replyingTo }, ctx, undefined)).toEqual({
            key: "reply:42",
            mode: "reply",
            name: "Alice",
            quote: "hi",
        });
        expect(
            composerContext({ replyingTo: { ...replyingTo, senderId: "me" } }, ctx, undefined)
                ?.name,
        ).toBe("You");
    });

    test("an edit starts from the text it's given and takes the place of the message's own reply", () => {
        const editing = message({
            sender: "me",
            content: { kind: "text_content", text: "hi @UserId(alice)" },
        });
        expect(composerContext({ editingEvent: editing, replyingTo }, ctx, "hi @alice")).toEqual({
            key: "edit:42",
            mode: "edit",
            quote: "hi @UserId(alice)",
            text: "hi @alice",
        });
    });
});

describe("someone the composer offers to mention", () => {
    const avatar = (u: { userId: string }) => `https://avatar/${u.userId}`;
    const alice = {
        kind: "user" as const,
        userId: "a",
        username: "alice",
        displayName: "Ally",
        updated: 0n,
        suspended: false,
        diamondStatus: "inactive" as const,
        chitBalance: 0,
        totalChitEarned: 0,
        streak: 0,
        maxStreak: 0,
        isUniquePerson: false,
        hideOnlineStatus: false,
    };

    test("is picked by the name typed to mention them, and shown by their display name", () => {
        expect(composerMention(alice, avatar)).toEqual({
            key: "a",
            handle: "alice",
            name: "Ally",
            avatar: "https://avatar/a",
        });
        expect(composerMention({ ...alice, displayName: undefined }, avatar).name).toBe("alice");
    });

    test("a group, or everyone, is its name with the group icon", () => {
        expect(
            composerMention({ kind: "user_group", id: 3, name: "devs", memberCount: 2 }, avatar),
        ).toEqual({ key: "3", handle: "devs", name: "devs", group: true });
        expect(composerMention({ kind: "everyone" }, avatar)).toEqual({
            key: "everyone",
            handle: "everyone",
            name: "everyone",
            group: true,
        });
    });
});

describe("the composer's staged attachment", () => {
    const data = { blobData: new Uint8Array(2048), blobUrl: "blob:x" };

    test("a photo, video or GIF goes in the media tray, one to a message", () => {
        expect(
            composerAttachment(
                {
                    kind: "image_content",
                    ...data,
                    height: 1,
                    width: 1,
                    thumbnailData: "THUMB",
                    mimeType: "image/jpeg",
                },
                ctx,
            ),
        ).toEqual({ type: "media", items: [{ kind: "image", src: "blob:x" }] });
        expect(
            composerAttachment(
                {
                    kind: "video_content",
                    height: 1,
                    width: 1,
                    thumbnailData: "THUMB",
                    mimeType: "video/mp4",
                    imageData: {},
                    videoData: { blobUrl: "blob:v" },
                },
                ctx,
            ),
        ).toEqual({ type: "media", items: [{ kind: "video", src: "blob:v" }] });
        expect(
            composerAttachment(
                {
                    kind: "giphy_content",
                    title: "cat",
                    desktop: {
                        url: "https://g/full.mp4",
                        width: 4,
                        height: 3,
                        mimeType: "video/mp4",
                    },
                    mobile: {
                        url: "https://g/full.gif",
                        width: 4,
                        height: 3,
                        mimeType: "image/gif",
                    },
                },
                ctx,
            ),
        ).toEqual({ type: "media", items: [{ kind: "image", src: "https://g/full.gif" }] });
    });

    test("a file or an audio clip is a chip with its size", () => {
        expect(
            composerAttachment(
                {
                    kind: "file_content",
                    ...data,
                    name: "notes.pdf",
                    mimeType: "application/pdf",
                    fileSize: 2048,
                },
                ctx,
            ),
        ).toEqual({ type: "file", title: "notes.pdf", summary: "2.0 KB" });
        expect(
            composerAttachment(
                {
                    kind: "audio_content",
                    ...data,
                    mimeType: "audio/mp4",
                    samples: new Uint8Array(),
                    durationMs: 1000n,
                },
                ctx,
            ),
        ).toMatchObject({ type: "file", summary: "2.0 KB" });
    });

    test("is none without one, or for what the composer doesn't stage yet", () => {
        expect(composerAttachment(undefined, ctx)).toBeNull();
        expect(
            composerAttachment(
                {
                    kind: "daily_result",
                    gameId: "g",
                    number: 1,
                    userId: "me",
                    solveTimeMs: 1,
                    hintsUsed: 0,
                    streak: 1,
                    layout: "",
                },
                ctx,
            ),
        ).toBeNull();
    });
});

describe("a message's menu", () => {
    const offers = (...actions: MessageMenuAction[]) => new Set<MessageMenuAction>(actions);

    test("lists what the message offers in the menu's order, with what removes it last, apart", () => {
        const items = messageMenuItems(
            offers("delete", "copy", "forward", "reply", "pin", "report", "remind", "block_user"),
        );
        expect(items.map((i) => i.action)).toEqual([
            "reply",
            "forward",
            "copy",
            "pin",
            "remind",
            "separator",
            "block_user",
            "report",
            "delete",
        ]);
        expect(items.find((i) => i.action === "delete")).toEqual({
            action: "delete",
            label: "deleteMessage",
            mask: "var(--icon-trash)",
            variant: "danger",
        });
    });

    test("has no separator when only one side has anything", () => {
        expect(messageMenuItems(offers("copy")).map((i) => i.action)).toEqual(["copy"]);
        expect(messageMenuItems(offers("delete_for_me")).map((i) => i.action)).toEqual([
            "delete_for_me",
        ]);
    });

    test("leaves out what this screen doesn't carry out", () => {
        expect(messageMenuItems(offers("start_thread", "collapse_proposal"))).toEqual([]);
    });
});

describe("the text the composer starts from", () => {
    test("is the chat's draft", () => {
        expect(composerStartText(undefined)).toBe("");
        expect(composerStartText({ textContent: "hello" })).toBe("hello");
    });

    test("mid-edit, is what was being written before the edit, not the edited message", () => {
        const editing = message({ sender: "me", content: { kind: "text_content", text: "old" } });
        expect(
            composerStartText({
                editingEvent: editing,
                textContent: "old",
                beforeEdit: { textContent: "hello" },
            }),
        ).toBe("hello");
        expect(composerStartText({ editingEvent: editing, textContent: "old" })).toBe("");
    });
});

// a row's messages are kept between renders: a voice message's playback must stay live in them
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

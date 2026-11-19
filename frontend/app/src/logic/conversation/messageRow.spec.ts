import {
    OPENCHAT_BOT_AVATAR_URL,
    ProposalDecisionStatus,
    type ProposalContent,
    OPENCHAT_BOT_USER_ID,
    type ResourceKey,
    type ChatSummary,
    type EventWrapper,
    type Message,
    type UserGroupDetails,
    type UserSummary,
    type WebhookDetails,
} from "@client";
import {
    conversationContext,
    hasProposals,
    proposalVoting,
    mediaHeld,
    messageRow,
    messageStatus,
    senderColor,
    showsSenderName,
    untilNextDay,
    withFields,
    type ConversationContext,
    type PlayerProps,
} from "./messageRow";

const ctx: ConversationContext = {
    me: "me",
    you: "You",
    userName: (id) => ({ alice: "Alice", bob: "Bob" })[id] ?? id,
    contentText: (content) => `[${content.kind}]`,
    mentionsAsTyped: (text) => text.replace(/@UserId\((\w+)\)/g, "@$1"),
    time: (timestamp) => `t${timestamp}`,
    date: (timestamp) => `d${timestamp}`,
    longDate: (timestamp) => `L${timestamp}`,
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
    proposalTopics: new Map(),
    proposalVote: () => undefined,
    undeleting: () => false,
    referralLink: "https://oc.app/?ref=me",
    twitchParent: "oc.app",
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

describe("a run's sender name", () => {
    test("shows once, at the run's start, for own runs and others' alike, outside a DM", () => {
        expect(showsSenderName(true, false)).toBe(true);
        expect(showsSenderName(false, false)).toBe(false);
    });

    test("never shows in a DM", () => {
        expect(showsSenderName(true, true)).toBe(false);
        expect(showsSenderName(false, true)).toBe(false);
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

    test("has its sender's own picture, none without one", () => {
        const pictured = { ...ctx, avatar: (id: string) => `https://blobs/${id}` };
        expect(messageRow(message(), "sent", pictured).avatarUrl).toBe("https://blobs/alice");
        expect(messageRow(message(), "sent", ctx).avatarUrl).toBeUndefined();
    });

    test("is the reader's own as sent, under their own name", () => {
        const named = { ...ctx, userName: (id: string) => (id === "me" ? "Ivan" : id) };
        expect(messageRow(message({ sender: "me" }), "sending", named)).toMatchObject({
            side: "sent",
            senderName: "Ivan",
            message: { status: "sending" },
        });
    });

    test("shows other kinds as their text, and a deleted message as deleted", () => {
        // a kind with no bubble of its own
        const encrypted = message({ content: { kind: "encrypted_content" } as Message["content"] });
        expect(messageRow(encrypted, "sent", ctx).message).toMatchObject({
            text: "[encrypted_content]",
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

    test("a quote shows its mentions as the @names typed, not as @UserId(…)", () => {
        const reply = message({
            repliesTo: {
                kind: "rehydrated_reply_context",
                senderId: "bob",
                content: { kind: "text_content", text: "ask @UserId(alice)" },
            } as Message["repliesTo"],
        });
        expect(messageRow(reply, "sent", ctx).message).toMatchObject({ quoteText: "ask @alice" });
    });

    test("quotes the message it replies to whatever its kind (a GIF, a voice message, a file …)", () => {
        const repliesTo = {
            kind: "rehydrated_reply_context",
            senderId: "bob",
            content: { kind: "text_content", text: "ask @UserId(alice)" },
        } as Message["repliesTo"];
        const kinds = {
            gif: {
                kind: "giphy_content",
                title: "cat",
                desktop: { url: "d", width: 480, height: 270, mimeType: "video/mp4" },
                mobile: { url: "m", width: 240, height: 135, mimeType: "image/gif" },
            },
            image: { kind: "image_content", width: 4, height: 3, blobUrl: "u", mimeType: "x" },
            voice: {
                kind: "audio_content",
                mimeType: "audio/webm",
                durationMs: 2000n,
                samples: new Uint8Array([128]),
            },
            file: {
                kind: "file_content",
                name: "a.pdf",
                mimeType: "application/pdf",
                fileSize: 10,
                blobUrl: "u",
            },
        };
        for (const [kind, content] of Object.entries(kinds)) {
            const row = messageRow(
                message({ content: content as Message["content"], repliesTo }),
                "sent",
                ctx,
            );
            expect(row.message).toMatchObject({ kind, quoteName: "Bob", quoteText: "ask @alice" });
        }
        // not a reply: no quote
        const gif = messageRow(message({ content: kinds.gif as Message["content"] }), "sent", ctx);
        expect(gif.message).toMatchObject({ kind: "gif", quoteName: undefined });
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

    const players = (text: string, ogPreviews: Message["ogPreviews"] = []) =>
        (
            messageRow(message({ content: { kind: "text_content", text }, ogPreviews }), "sent", ctx)
                .message as { players: PlayerProps[] }
        ).players;

    test("a Twitch link plays in the bubble: its preview titles the poster, the others stay cards", () => {
        const row = messageRow(
            message({
                content: { kind: "text_content", text: "live now https://twitch.tv/ann" },
                ogPreviews: [preview("https://www.twitch.tv/ann"), preview("https://a.com/x")],
            }),
            "sent",
            ctx,
        ).message as { previews: { url: string }[]; players: PlayerProps[] };
        expect(row.previews.map((c) => c.url)).toEqual(["https://a.com/x"]);
        expect(row.players).toEqual([
            {
                title: "T",
                image: "https://static-cdn.jtvnw.net/previews-ttv/live_user_ann-640x360.jpg",
                src: "https://player.twitch.tv/?channel=ann&parent=oc.app&autoplay=true",
                href: "https://www.twitch.tv/ann",
                logo: "/assets/twitch.svg",
                playLabel: "twitch.play",
                watchLabel: "twitch.watchOnTwitch",
            },
        ]);
    });

    test("a channel's poster is what it's streaming now, with or without a preview", () => {
        // no preview: the sender's preview fetch failed (or was never made)
        expect(players("https://www.twitch.tv/Aztecross")).toMatchObject([
            {
                title: "twitch.tv/aztecross",
                image: "https://static-cdn.jtvnw.net/previews-ttv/live_user_aztecross-640x360.jpg",
                src: "https://player.twitch.tv/?channel=aztecross&parent=oc.app&autoplay=true",
            },
        ]);
        // its preview's image is the channel's avatar, not the stream
        expect(
            players("https://twitch.tv/ann", [
                {
                    ...preview("https://twitch.tv/ann"),
                    image: { url: "https://cdn/avatar.png", width: 300, height: 300 },
                },
            ]),
        ).toMatchObject([
            { image: "https://static-cdn.jtvnw.net/previews-ttv/live_user_ann-640x360.jpg" },
        ]);
    });

    test("a video or clip shows a poster with where it's to, and plays on its own player", () => {
        expect(players("https://www.twitch.tv/videos/2500000000?t=1h2m3s")).toEqual([
            expect.objectContaining({
                title: "twitch.tv/videos/2500000000?t=1h2m3s",
                image: undefined,
                src: "https://player.twitch.tv/?video=v2500000000&time=1h2m3s&parent=oc.app&autoplay=true",
                href: "https://www.twitch.tv/videos/2500000000?t=1h2m3s",
            }),
        ]);
        // Twitch's generic preview (its logo) says nothing about the clip
        expect(
            players("https://clips.twitch.tv/AwkwardHelplessSalamander", [
                {
                    ...preview("https://clips.twitch.tv/AwkwardHelplessSalamander"),
                    title: "Twitch",
                    image: { url: "https://cdn/twitch_logo3.jpg", width: 262, height: 200 },
                },
            ]),
        ).toEqual([
            expect.objectContaining({
                title: "clips.twitch.tv/AwkwardHelplessSalamander",
                image: undefined,
                src: "https://clips.twitch.tv/embed?clip=AwkwardHelplessSalamander&parent=oc.app&autoplay=true",
            }),
        ]);
    });

    test("where Twitch won't play (the native apps, a framed page), a Twitch link links to Twitch", () => {
        const row = messageRow(
            message({ content: { kind: "text_content", text: "https://twitch.tv/ann" } }),
            "sent",
            { ...ctx, twitchParent: undefined },
        ).message as { players: PlayerProps[] };
        expect(row.players).toMatchObject([{ src: "", href: "https://www.twitch.tv/ann" }]);
    });

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

describe("deleted messages", () => {
    const words = {
        ...ctx,
        text: (key: ResourceKey) => `${key.key} ${JSON.stringify(key.params)}`,
    };
    const deleted = (deletedBy: string) =>
        message({
            content: { kind: "deleted_content", deletedBy, timestamp: 9n },
        } as Partial<Message>);

    test("say who deleted them and when, as the old trees do", () => {
        expect(messageRow(deleted("bob"), "sent", words).message).toMatchObject({
            deleted: true,
            deletedText: 'messageDeleted {"username":"Bob","timestamp":"L9"}',
        });
    });

    test("say while they're being undeleted", () => {
        const undeleting = { ...words, undeleting: (id: bigint) => id === 42n };
        expect(messageRow(deleted("bob"), "sent", undeleting).message).toMatchObject({
            deletedText: 'undeletingMessage {"username":"Bob","timestamp":"L9"}',
        });
    });

    test("removed by the OpenChat bot, keep the rule link's words only (the tombstone is plain text)", () => {
        const bot = {
            ...ctx,
            userName: () => "OpenChat Bot",
            text: () => "Removed by OpenChat Bot for breaking a [platform rule]() on L9",
        };
        expect(messageRow(deleted(OPENCHAT_BOT_USER_ID), "sent", bot).message).toMatchObject({
            deletedText: "Removed by OpenChat Bot for breaking a platform rule on L9",
        });
    });
});

describe("kinds without a bubble of their own", () => {
    const words = { ...ctx, text: (key: ResourceKey) => key.key };
    const row = (content: object) =>
        messageRow(message({ content } as Partial<Message>), "sent", words).message;

    test("say what they are in the app's words, not the content's English", () => {
        expect(row({ kind: "blocked_content" })).toMatchObject({
            kind: "text",
            text: "messageBlocked",
        });
        expect(row({ kind: "restricted_content" })).toMatchObject({
            text: "appStore.messageNotAvailable",
        });
        expect(row({ kind: "unsupported_content" })).toMatchObject({ text: "messageUnsupported" });
        expect(row({ kind: "placeholder_content" })).toMatchObject({ text: "placeholderContent" });
    });

    test("a reminder says when, or that it's due, with its notes", () => {
        expect(
            row({
                kind: "message_reminder_created_content",
                remindAt: 5,
                reminderId: 1n,
                hidden: false,
                notes: "call mum",
            }),
        ).toMatchObject({ text: "⏰ reminders.remindAt\n\ncall mum" });
        expect(row({ kind: "message_reminder_content", reminderId: 1n })).toMatchObject({
            text: "⏰ reminders.youAsked",
        });
    });

    test("a cancelled reminder promises nothing: its notes alone", () => {
        const cancelled = {
            kind: "message_reminder_created_content",
            remindAt: 5,
            reminderId: 1n,
            hidden: true,
        };
        expect(row({ ...cancelled, notes: "call mum" })).toMatchObject({ text: "call mum" });
        expect(row(cancelled)).toMatchObject({ text: "" });
    });

    test("the referral card gives the reader their own link", () => {
        expect(row({ kind: "user_referral_card" })).toMatchObject({
            text: "referralHeader\n\nuserReferralMessage\n\nhttps://oc.app/?ref=me",
        });
    });

    test("other kinds still show their content's text", () => {
        expect(row({ kind: "encrypted_content" })).toMatchObject({ text: "[encrypted_content]" });
    });
});

describe("tips", () => {
    test("show a chip per token with its total, the reader's own marked, and who tipped", () => {
        const tipped = message({
            tips: { icp: { alice: 100_000_000n, me: 50_000_000n }, unknown: { bob: 1n } },
        });
        expect(messageRow(tipped, "sent", ctx).message.tips).toEqual([
            {
                amount: "1.5",
                symbol: "ICP",
                logo: 'url("icp.svg") center / cover',
                mine: true,
                label: "Alice, You",
            },
        ]);
    });

    test("show on every kind", () => {
        const file = message({
            content: { kind: "file_content", name: "a.txt", mimeType: "text/plain", fileSize: 1 },
            tips: { icp: { bob: 100_000_000n } },
        } as Partial<Message>);
        expect(messageRow(file, "sent", ctx).message).toMatchObject({
            kind: "file",
            tips: [{ amount: "1", mine: false, label: "Bob" }],
        });
    });
});

describe("prize wins", () => {
    const win = (recipient: string, ledger = "icp") =>
        message({
            content: {
                kind: "prize_winner_content",
                prizeMessageIndex: 1,
                transaction: {
                    kind: "completed",
                    ledger,
                    recipient,
                    sender: "alice",
                    amountE8s: 200_000_000n,
                    feeE8s: 10_000n,
                    memo: 0n,
                    blockIndex: 1n,
                },
            },
        } as Partial<Message>);
    const words = {
        ...ctx,
        text: (key: ResourceKey) => `**${String(key.params?.recipient)}** won`,
    };

    test("show as a transfer to the winner: in for the reader's own, saying who won", () => {
        expect(messageRow(win("me"), "sent", words).message).toMatchObject({
            kind: "transfer",
            amount: "2",
            symbol: "ICP",
            direction: "in",
            caption: "You won",
        });
        expect(messageRow(win("bob"), "sent", words).message).toMatchObject({
            direction: "other",
            caption: "Bob won",
        });
    });

    test("in a ledger the registry doesn't carry, show as text", () => {
        expect(messageRow(win("me", "unknown"), "sent", ctx).message).toMatchObject({
            kind: "text",
        });
    });
});

describe("proposals", () => {
    const HOUR = 3_600_000;
    const proposal = (fields: Partial<ProposalContent["proposal"]> = {}, myVote?: boolean) =>
        message({
            content: {
                kind: "proposal_content",
                governanceCanisterId: "gov",
                myVote,
                proposal: {
                    kind: "sns",
                    id: 7n,
                    action: 9,
                    title: "Fund the design work",
                    proposer: "0123456789abcdef",
                    status: ProposalDecisionStatus.Open,
                    tally: { yes: 40, no: 10, total: 100, timestamp: 0n },
                    deadline: 50 * HOUR,
                    minYesPercentageOfTotal: 20,
                    minYesPercentageOfExercised: 67,
                    ...fields,
                } as ProposalContent["proposal"],
            },
        } as Partial<Message>);
    const words = {
        ...ctx,
        now: 2 * HOUR,
        text: (key: ResourceKey) => key.key,
        proposalTopics: new Map([[9, "Transfer treasury funds"]]),
    };

    test("show their type, proposer, tally and thresholds, and how long voting has left", () => {
        expect(messageRow(proposal(), "sent", words).message).toMatchObject({
            kind: "proposal",
            title: "Fund the design work",
            topic: "Transfer treasury funds",
            proposer: "0123..cdef",
            critical: true,
            state: "open",
            adopt: 40,
            reject: 10,
            softThreshold: 20,
            hardThreshold: 67,
            when: "proposal.votingPeriodRemaining: 2d",
            myVote: null,
            canVote: true,
        });
    });

    test("can't be voted on once voted, once voting has ended, or read-only", () => {
        const row = (p: EventWrapper<Message>, c = words) =>
            messageRow(p, "sent", c).message as { canVote: boolean; myVote: string | null };
        expect(row(proposal({}, true))).toMatchObject({ canVote: false, myVote: "adopt" });
        expect(row(proposal(), { ...words, proposalVote: () => "rejecting" })).toMatchObject({
            canVote: false,
            myVote: "reject",
        });
        expect(row(proposal({ deadline: HOUR }))).toMatchObject({ canVote: false });
        expect(row(proposal({ deadline: 2 * HOUR }))).toMatchObject({ canVote: false });
        expect(row(proposal(), { ...words, readonly: true })).toMatchObject({ canVote: false });
    });

    test("decided early, can still be voted on until the deadline, as the NNS allows", () => {
        for (const status of [ProposalDecisionStatus.Adopted, ProposalDecisionStatus.Executed]) {
            expect(messageRow(proposal({ status }), "sent", words).message).toMatchObject({
                state: status === ProposalDecisionStatus.Adopted ? "adopted" : "executed",
                canVote: true,
                when: "proposal.votingPeriodRemaining: 2d",
            });
        }
    });

    test("once the deadline passes, say how it was decided and that voting has ended", () => {
        expect(
            messageRow(
                proposal({ status: ProposalDecisionStatus.Failed, deadline: HOUR }),
                "sent",
                words,
            ).message,
        ).toMatchObject({ state: "failed", when: "proposal.votingPeriodEnded", canVote: false });
    });

    test("count down by the context's time, made again as the screen's clock moves on", () => {
        const later = { ...words, now: 50 * HOUR - 5 * 60_000 };
        expect(messageRow(proposal(), "sent", later).message).toMatchObject({
            when: "proposal.votingPeriodRemaining: 5m",
            canVote: true,
        });
        const after = { ...words, now: 50 * HOUR };
        expect(messageRow(proposal(), "sent", after).message).toMatchObject({
            when: "proposal.votingPeriodEnded",
            canVote: false,
        });
    });
});

describe("a proposal's voting", () => {
    test("is open until the deadline, with the time left in its largest unit", () => {
        expect(proposalVoting(100 * 60_000, 0)).toEqual({ open: true, left: "1h" });
        expect(proposalVoting(60_001, 60_000)).toEqual({ open: true, left: "1m" });
        expect(proposalVoting(60_000, 60_000)).toEqual({ open: false, left: "" });
        expect(proposalVoting(0, 60_000)).toEqual({ open: false, left: "" });
    });
});

describe("a proposals chat", () => {
    test("is a group or channel of the governance proposals subtype", () => {
        const subtype = { kind: "governance_proposals" } as const;
        expect(hasProposals({ kind: "group_chat", subtype } as ChatSummary)).toBe(true);
        expect(hasProposals({ kind: "channel", subtype } as ChatSummary)).toBe(true);
        expect(hasProposals({ kind: "group_chat", subtype: undefined } as ChatSummary)).toBe(false);
        expect(hasProposals({ kind: "direct_chat" } as ChatSummary)).toBe(false);
        expect(hasProposals(undefined)).toBe(false);
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
        } as ChatSummary;
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
                canonicalOrigin: () => "https://oc.app",
            },
            chat,
            me: "me",
            formatter: (key) => String(key),
            users: new Map(),
            userGroups: new Map(),
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
                accountCreated: 0,
            },
            tokens: new Map(),
            rates: () => new Map(),
            face: (userId) => userId,
            threads: true,
            locale: "en",
            undeleting: () => false,
            twitchParent: undefined,
            proposalTopics: new Map(),
            proposalVotes: new Map(),
        });
        expect(ctx.unreadInThread(4)).toBe(2);
        expect(asked).toEqual([[4, 6]]);
        // a thread the chat doesn't list as followed
        expect(ctx.unreadInThread(5)).toBe(0);
    });

    test("shows a quote's mentions as the users' and user groups' @names", () => {
        const ctx = conversationContext({
            client: {
                displayName: () => "",
                getContentAsText: () => "",
                toShortTimeString: () => "",
                formatMessageDate: () => "",
                isChatReadOnly: () => false,
                unreadThreadMessageCount: () => 0,
                canonicalOrigin: () => "https://oc.app",
            },
            chat: undefined,
            me: "me",
            formatter: (key) => String(key),
            users: new Map([["a1", { userId: "a1", username: "alice" } as UserSummary]]),
            userGroups: new Map([[7, { id: 7, name: "mods" } as UserGroupDetails]]),
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
                accountCreated: 0,
            },
            tokens: new Map(),
            rates: () => new Map(),
            face: (userId) => userId,
            threads: true,
            locale: "en",
            undeleting: () => false,
            twitchParent: undefined,
            proposalTopics: new Map(),
            proposalVotes: new Map(),
        });
        expect(ctx.mentionsAsTyped("hi @UserId(a1), @UserGroup(7) and @UserId(zz)")).toBe(
            "hi @alice, @mods and @UserId(zz)",
        );
    });

    test("gives a sender's own picture: an avatar, a bot's, a webhook's; none for a generated one", () => {
        const user = (userId: string, blobUrl?: string) =>
            ({ kind: "user", userId, username: userId, blobUrl }) as UserSummary;
        const users = new Map([
            ["alice", user("alice", "https://blobs/alice")],
            ["bob", user("bob", "data:image/svg+xml;base64,PHN2Zz4=")],
            ["bot", { ...user("bot", OPENCHAT_BOT_AVATAR_URL), kind: "bot" } as UserSummary],
        ]);
        const webhooks = new Map([
            [
                "hook",
                { id: "hook", name: "Hook", avatarUrl: "https://blobs/hook" } as WebhookDetails,
            ],
        ]);
        const ctx = conversationContext({
            client: {
                displayName: () => "",
                getContentAsText: () => "",
                toShortTimeString: () => "",
                formatMessageDate: () => "",
                isChatReadOnly: () => false,
                unreadThreadMessageCount: () => 0,
                canonicalOrigin: () => "https://oc.app",
            },
            chat: undefined,
            me: "me",
            formatter: (key) => String(key),
            users,
            userGroups: new Map(),
            webhooks,
            webhookIds: new Set<string>(["hook"]),
            detailsLoaded: true,
            lowBandwidth: false,
            revealed: () => false,
            claimant: {
                previewingOrLapsed: false,
                diamond: false,
                lifetimeDiamond: false,
                streak: 0,
                chitEarned: 0,
                accountCreated: 0,
            },
            tokens: new Map(),
            rates: () => new Map(),
            face: (userId) => userId,
            threads: true,
            locale: "en",
            undeleting: () => false,
            twitchParent: undefined,
            proposalTopics: new Map(),
            proposalVotes: new Map(),
        });
        expect(ctx.avatar("alice")).toBe("https://blobs/alice");
        expect(ctx.avatar("bob")).toBeUndefined();
        expect(ctx.avatar("bot")).toBe(OPENCHAT_BOT_AVATAR_URL);
        expect(ctx.avatar("hook")).toBe("https://blobs/hook");
        expect(ctx.avatar("nobody")).toBeUndefined();
    });
});

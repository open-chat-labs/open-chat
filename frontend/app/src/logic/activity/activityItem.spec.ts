import type { Message, MessageActivityEvent } from "@client";
import { activityItem, activityLink, readUpTo, type ActivityContext } from "./activityItem";

const ctx: ActivityContext = {
    me: "me",
    you: "you",
    anon: "An anonymous user",
    missing: "Message content unavailable",
    userName: (id) => ({ alice: "Alice", bob: "Bob", carol: "Carol" })[id] ?? id,
    avatar: (id) => (id === "alice" ? "https://blobs/alice" : undefined),
    token: (ledger) =>
        ledger === "chat-ledger"
            ? { symbol: "CHAT", logo: "chat.svg", amount: (e8s) => (Number(e8s) / 1e8).toString() }
            : undefined,
    author: (message) => (message.sender === "me" ? "you" : `author of ${message.sender}`),
    chatName: () => "Group",
    contentText: (content) => (content as { text: string }).text,
    mentionsAsTyped: (text) => text.replace(/@UserId\((\w+)\)/g, "@$1"),
    text: ({ key, params }) => `${key}${params ? JSON.stringify(params) : ""}`,
    day: (ts) => `day${ts}`,
    time: (ts) => `t${ts}`,
    readUpTo: 5n,
};

function event(fields: Partial<MessageActivityEvent> = {}, message: Partial<Message> = {}) {
    return {
        messageContext: { chatId: { kind: "group_chat", groupId: "g1" } },
        eventIndex: 7,
        messageId: 42n,
        messageIndex: 3,
        activity: "mention",
        timestamp: 9n,
        userId: "alice",
        message: {
            sender: "me",
            content: { kind: "text_content", text: "hello" },
            reactions: [],
            tips: {},
            ...message,
        },
        ...fields,
    } as unknown as MessageActivityEvent;
}

describe("an activity item", () => {
    test("says what happened, where, and to which message", () => {
        expect(activityItem(event(), ctx)).toMatchObject({
            id: '{"chatId":{"kind":"group_chat","groupId":"g1"}}_7_mention',
            day: "day9",
            title: 'activity.mention{"username":"Alice"}',
            context: "Group",
            preview: "you: hello",
            time: "t9",
            type: "mention",
            chatId: "g1",
            messageId: "42",
        });
    });

    test("shows its message's mentions as the @names typed", () => {
        const mention = {
            content: { kind: "text_content", text: "hi @UserId(me)" },
        } as Partial<Message>;
        expect(activityItem(event({}, mention), ctx).preview).toBe("you: hi @me");
    });

    test("shows its message after whoever it's shown as from, not its sender", () => {
        expect(activityItem(event({}, { sender: "bridge-bot" }), ctx).preview).toBe(
            "author of bridge-bot: hello",
        );
    });

    test("names a relayed reply's author, not the bridge bot which relayed it", () => {
        const relayed = {
            sender: "bridge-bot",
            senderContext: {
                kind: "bot",
                finalised: true,
                bridgedFrom: { kind: "telegram", id: "1234" },
            },
        } as Partial<Message>;
        expect(
            activityItem(event({ activity: "quote_reply", userId: "bridge-bot" }, relayed), ctx)
                .title,
        ).toBe('activity.quoteReply{"username":"author of bridge-bot"}');
        // A reaction's message is the reader's, so whoever reacted is named as usual
        expect(
            activityItem(event({ activity: "reaction", userId: "bridge-bot" }, relayed), ctx).title,
        ).toBe('activity.reactionOne{"username":"bridge-bot"}');
    });

    test("names an anonymous user", () => {
        expect(activityItem(event({ userId: undefined }), ctx).title).toBe(
            'activity.mention{"username":"An anonymous user"}',
        );
    });

    test("is unread after the feed's read-up-to time", () => {
        expect(activityItem(event({ timestamp: 9n }), ctx).unread).toBe(true);
        expect(activityItem(event({ timestamp: 5n }), ctx).unread).toBe(false);
    });

    test("files tips, crypto and swaps under payments, and quote replies under replies", () => {
        const type = (activity: MessageActivityEvent["activity"]) =>
            activityItem(event({ activity }), ctx).type;
        expect(type("tip")).toBe("payment");
        expect(type("crypto")).toBe("payment");
        expect(type("p2p_swap_accepted")).toBe("payment");
        expect(type("quote_reply")).toBe("reply");
    });

    test("gives a poll vote no tab of its own, so it's under All only", () => {
        expect(activityItem(event({ activity: "poll_vote" }), ctx).type).toBeUndefined();
    });

    test("shows the person's own picture, and none for one without or for an anonymous user", () => {
        expect(activityItem(event(), ctx).avatarUrl).toBe("https://blobs/alice");
        expect(activityItem(event({ userId: "bob" }), ctx).avatarUrl).toBeUndefined();
        expect(activityItem(event({ userId: undefined }), ctx).avatarUrl).toBeUndefined();
    });

    test("shows a reaction's emoji, and says when the message is gone", () => {
        const reacted = event(
            { activity: "reaction" },
            { reactions: [{ reaction: "👍", userIds: new Set(["alice"]) }] },
        );
        expect(activityItem(reacted, ctx).reactions).toEqual(["👍"]);
        const gone = { ...event(), message: undefined } as MessageActivityEvent;
        expect(activityItem(gone, ctx).preview).toBe("Message content unavailable");
    });
});

describe("a tip's tips", () => {
    const tipped = (activity: MessageActivityEvent["activity"]) =>
        event(
            { activity },
            {
                tips: {
                    "chat-ledger": { alice: 50_000_000n, bob: 100_000_000n, me: 25_000_000n },
                    "unknown-ledger": { carol: 1n },
                },
            },
        );

    test("a tip event's chips list exactly the ledgers the registry knows, with who tipped", () => {
        const tips = activityItem(tipped("tip"), ctx).tips;
        expect(tips).toHaveLength(1);
        expect(tips?.[0]).toMatchObject({
            symbol: "CHAT",
            logo: 'url("chat.svg") center / cover',
            mine: true,
            label: "Alice, Bob, you",
        });
    });

    test("a tip chip's total is the sum of its tippers' amounts, in that ledger's decimals", () => {
        expect(activityItem(tipped("tip"), ctx).tips?.[0].amount).toBe("1.75");
    });

    test("only tip events carry tips: a reaction or mention on a tipped message shows none", () => {
        expect(activityItem(tipped("reaction"), ctx).tips).toEqual([]);
        expect(activityItem(tipped("mention"), ctx).tips).toEqual([]);
        const gone = { ...tipped("tip"), message: undefined } as MessageActivityEvent;
        expect(activityItem(gone, ctx).tips).toEqual([]);
    });
});

describe("opening an activity", () => {
    test("goes to its message with the feed still open", () => {
        expect(activityLink(event())).toBe("/chats/group/g1/3?panel=activity");
    });

    test("on a narrow screen, goes to the message alone", () => {
        expect(activityLink(event(), false)).toBe("/chats/group/g1/3");
    });

    test("keeps a thread open", () => {
        const inThread = event({
            messageContext: {
                chatId: { kind: "group_chat", groupId: "g1" },
                threadRootMessageIndex: 2,
            },
        });
        expect(activityLink(inThread)).toBe("/chats/group/g1/2/3?open=true&panel=activity");
    });
});

describe("marking activities read", () => {
    test("marks up to the newest of them", () => {
        expect(readUpTo([event({ timestamp: 3n }), event({ timestamp: 8n })])).toBe(8n);
        expect(readUpTo([])).toBeUndefined();
    });
});

import type { Message, MessageActivityEvent } from "@client";
import { activityItem, activityLink, readUpTo, type ActivityContext } from "./activity.adapter";

const ctx: ActivityContext = {
    me: "me",
    you: "you",
    anon: "An anonymous user",
    missing: "Message content unavailable",
    userName: (id) => ({ alice: "Alice", bob: "Bob", carol: "Carol" })[id] ?? id,
    chatName: () => "Group",
    contentText: (content) => (content as { text: string }).text,
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
        expect(type("poll_vote")).toBeUndefined();
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

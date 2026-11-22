import {
    MessageContextMap,
    type ChatSummary,
    type EventWrapper,
    type Message,
    type MessageContext,
} from "@client";
import { chatRow, type RowContext } from "./chatRow";
import {
    latestUnsentByChat,
    orderWithUnsent,
    unsentFor,
    type UnsentMessage,
} from "./unsentMessages";

const membership = { notificationsMuted: false, archived: false, joined: 0n };

function dm(userId: string, latestAt?: bigint, text = "theirs"): ChatSummary {
    return {
        kind: "direct_chat",
        id: { kind: "direct_chat", userId },
        them: { kind: "direct_chat", userId },
        dateCreated: 1n,
        eventsTtlLastUpdated: 0n,
        membership,
        latestMessage: latestAt && {
            timestamp: latestAt,
            event: { sender: userId, content: { kind: "text_content", text }, messageIndex: 4 },
        },
    } as unknown as ChatSummary;
}

function mine(id: bigint, at: bigint, text: string): EventWrapper<Message> {
    return {
        index: 9,
        timestamp: at,
        event: { messageId: id, sender: "me", content: { kind: "text_content", text } },
    } as unknown as EventWrapper<Message>;
}

function byContext<V>(...entries: [MessageContext, V][]): MessageContextMap<V> {
    const map = new MessageContextMap<V>();
    for (const [k, v] of entries) map.set(k, v);
    return map;
}

const alice: MessageContext = { chatId: { kind: "direct_chat", userId: "alice" } };
const bob: MessageContext = { chatId: { kind: "direct_chat", userId: "bob" } };
const aliceThread: MessageContext = { ...alice, threadRootMessageIndex: 2 };

const ctx: RowContext = {
    userName: (id) => id,
    userSuspended: () => false,
    userLoading: () => false,
    preview: (chat) =>
        (chat.latestMessage?.event.content as { text: string } | undefined)?.text ?? "",
    date: (timestamp) => `t${timestamp}`,
    unread: (chat) => chat.latestMessage?.event.messageIndex ?? 0,
    readOnly: () => false,
    pinned: new Set<string>(),
};

describe("each chat's latest unsent message", () => {
    test("is the newest of those on their way and those failed, by chat", () => {
        const unsent = latestUnsentByChat(
            byContext([alice, new Map([[1n, mine(1n, 10n, "sending")]])]),
            byContext(
                [alice, new Map([[2n, mine(2n, 20n, "failed")]])],
                [bob, new Map([[3n, mine(3n, 5n, "bob's")]])],
            ),
            byContext<Set<bigint>>(),
        );
        expect(unsent.get("alice")).toMatchObject({ status: "failed", event: { timestamp: 20n } });
        expect(unsent.get("bob")?.status).toBe("failed");
    });

    test("a queued one (waiting for the connection) is sending, not failed", () => {
        const unsent = latestUnsentByChat(
            byContext(),
            byContext([alice, new Map([[2n, mine(2n, 20n, "queued")]])]),
            byContext([alice, new Set([2n])]),
        );
        expect(unsent.get("alice")?.status).toBe("sending");
    });

    test("a thread's isn't its chat's (a row shows no thread replies)", () => {
        const unsent = latestUnsentByChat(
            byContext([aliceThread, new Map([[1n, mine(1n, 10n, "reply")]])]),
            byContext(),
            byContext(),
        );
        expect(unsent.size).toBe(0);
    });

    test("counts only when newer than the chat's latest", () => {
        const unsent = new Map<string, UnsentMessage>([
            ["alice", { event: mine(1n, 10n, "mine"), status: "sending" }],
        ]);
        expect(unsentFor(dm("alice", 5n), unsent)).toBeDefined();
        expect(unsentFor(dm("alice"), unsent)).toBeDefined();
        expect(unsentFor(dm("alice", 15n), unsent)).toBeUndefined();
        expect(unsentFor(dm("bob", 1n), unsent)).toBeUndefined();
    });
});

describe("a message on its way the client has put in the chat's summary", () => {
    test("is the chat's unsent message still, so its row has the clock", () => {
        const onItsWay = mine(1n, 10n, "on its way");
        const chat = { ...dm("alice", 5n), latestMessage: onItsWay } as ChatSummary;
        const unsent = new Map<string, UnsentMessage>([
            ["alice", { event: onItsWay, status: "sending" }],
        ]);
        expect(unsentFor(chat, unsent)?.status).toBe("sending");
    });
});

describe("a row with an unsent latest message (#10591)", () => {
    const sending: UnsentMessage = { event: mine(1n, 10n, "on its way"), status: "sending" };
    const failed: UnsentMessage = { event: mine(1n, 10n, "not delivered"), status: "failed" };

    test("previews it with the sending clock, at its time", () => {
        expect(chatRow(dm("alice", 5n), ctx, 0, sending)).toMatchObject({
            preview: "on its way",
            previewIcon: "clock",
            time: "t10",
        });
    });

    test("a failed one with the failed mark", () => {
        expect(chatRow(dm("alice", 5n), ctx, 0, failed).previewIcon).toBe("failed");
    });

    test("keeps the chat's unread count, from its latest confirmed message", () => {
        expect(chatRow(dm("alice", 5n), ctx, 0, sending).unreadCount).toBe(4);
    });

    test("without one, is the chat's latest as before", () => {
        expect(chatRow(dm("alice", 5n), ctx, 0)).toMatchObject({
            preview: "theirs",
            previewIcon: undefined,
            time: "t5",
        });
    });
});

describe("the list's order with unsent messages", () => {
    const a = dm("alice", 5n);
    const b = dm("bob", 8n);
    const c = dm("carol", 3n);

    test("a chat with a newer unsent message moves up by it", () => {
        const unsent = new Map<string, UnsentMessage>([
            ["carol", { event: mine(1n, 9n, "mine"), status: "sending" }],
        ]);
        expect(orderWithUnsent([b, a, c], new Set<string>(), unsent)).toEqual([c, b, a]);
    });

    test("pinned chats stay first, as they were", () => {
        const unsent = new Map<string, UnsentMessage>([
            ["carol", { event: mine(1n, 9n, "mine"), status: "failed" }],
        ]);
        expect(orderWithUnsent([a, b, c], new Set(["alice"]), unsent)).toEqual([a, c, b]);
    });

    test("with none, the order is as it was", () => {
        expect(orderWithUnsent([b, a, c], new Set<string>(), new Map())).toEqual([b, a, c]);
    });
});

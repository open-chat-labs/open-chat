import type { DirectChatSummary, GroupChatSummary } from "./chat";
import { mergeChats, userIdsFromChatSummaries } from "./chat.utils";

const defaultDirectChat: DirectChatSummary = {
    kind: "direct_chat",
    them: "a",
    chatId: BigInt(123),
    lastUpdated: BigInt(0),
    displayDate: BigInt(0),
    lastReadByUs: 0,
    lastReadByThem: 0,
    lastestMessageId: 5,
    latestMessage: undefined,
};

const defaultGroupChat: GroupChatSummary = {
    kind: "group_chat",
    subject: "whatever",
    participants: [],
    chatId: BigInt(123),
    lastUpdated: BigInt(0),
    displayDate: BigInt(0),
    lastReadByUs: 0,
    lastReadByThem: 0,
    lastestMessageId: 5,
    latestMessage: undefined,
};

function directChatId(id: number): DirectChatSummary {
    return {
        ...defaultDirectChat,
        chatId: BigInt(id),
    };
}

function directChatWith(them: string): DirectChatSummary {
    return {
        ...defaultDirectChat,
        them,
    };
}

function groupChatWith(id: string): GroupChatSummary {
    return {
        ...defaultGroupChat,
        participants: [id, id, id],
    };
}

describe("extract userids from chat summaries", () => {
    test("when there are no chats", () => {
        const userIds = userIdsFromChatSummaries([], false);
        expect(userIds.size).toEqual(0);
    });
    test("when excluding group chat summaries", () => {
        const chats = [directChatWith("a"), directChatWith("b"), groupChatWith("c")];
        const userIds = userIdsFromChatSummaries(chats, false);
        expect(userIds.size).toEqual(2);
        expect(userIds.has("a")).toBe(true);
        expect(userIds.has("b")).toBe(true);
        expect(userIds.has("c")).toBe(false);
    });
    test("when including group chat summaries", () => {
        const chats = [directChatWith("a"), directChatWith("b"), groupChatWith("c")];
        const userIds = userIdsFromChatSummaries(chats, true);
        expect(userIds.size).toEqual(3);
        expect(userIds.has("a")).toBe(true);
        expect(userIds.has("b")).toBe(true);
        expect(userIds.has("c")).toBe(true);
    });
});

describe("merging chat summaries", () => {
    test("it works", () => {
        const existing = [directChatId(0), directChatId(1), directChatId(2)];
        const incoming = [directChatId(2), directChatId(3), directChatId(4)];
        const merged = mergeChats(existing, incoming);
        [0, 1, 2, 3, 4].forEach((n) =>
            expect(merged.find((c) => c.chatId === BigInt(n))).not.toBe(undefined)
        );
        expect(merged.length).toEqual(5);
    });
});

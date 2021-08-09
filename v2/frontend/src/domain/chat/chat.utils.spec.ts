import type { UserLookup } from "../user/user";
import type {
    DirectChatSummary,
    GroupChatSummary,
    Participant,
    UpdatedDirectChatSummary,
    UpdatedGroupChatSummary,
} from "./chat";
import { getParticipantsString, mergeChatUpdates, userIdsFromChatSummaries } from "./chat.utils";

const defaultDirectChat: DirectChatSummary = {
    kind: "direct_chat",
    them: "a",
    chatId: "abc",
    lastUpdated: BigInt(0),
    latestReadByMe: 0,
    latestReadByThem: 0,
    latestMessage: undefined,
    latestEventIndex: 0,
};

const defaultGroupChat: GroupChatSummary = {
    kind: "group_chat",
    name: "whatever",
    description: "whatever",
    participants: [participant("1"), participant("2"), participant("3")],
    chatId: "abc",
    lastUpdated: BigInt(0),
    latestReadByMe: 0,
    latestMessage: undefined,
    public: true,
    joined: BigInt(0),
    minVisibleMessageIndex: 0,
    latestEventIndex: 0,
};

function directChatId(id: number): DirectChatSummary {
    return {
        ...defaultDirectChat,
        chatId: String(id),
    };
}

function groupChatId(id: number): GroupChatSummary {
    return {
        ...defaultGroupChat,
        chatId: String(id),
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
        participants: [participant(id), participant(id), participant(id)],
    };
}

function participant(id: string): Participant {
    return {
        role: "admin",
        userId: id,
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

describe("get participants string for group chat", () => {
    const withFewerThanSix = {
        ...defaultGroupChat,
        participants: [
            participant("a"),
            participant("b"),
            participant("c"),
            participant("d"),
            participant("e"),
        ],
    };
    const withUnknown = {
        ...defaultGroupChat,
        participants: [
            participant("a"),
            participant("b"),
            participant("z"),
            participant("d"),
            participant("e"),
        ],
    };
    const withMoreThanSix = {
        ...defaultGroupChat,
        participants: [
            participant("a"),
            participant("b"),
            participant("c"),
            participant("d"),
            participant("e"),
            participant("f"),
            participant("g"),
        ],
    };
    const lookup: UserLookup = {
        a: { userId: "a", username: "Mr A", secondsSinceLastOnline: 200 },
        b: { userId: "b", username: "Mr B", secondsSinceLastOnline: 20 },
        c: { userId: "c", username: "Mr C", secondsSinceLastOnline: 20 },
        d: { userId: "d", username: "Mr D", secondsSinceLastOnline: 20 },
        e: { userId: "e", username: "Mr E", secondsSinceLastOnline: 10 },
        f: { userId: "f", username: "Mr F", secondsSinceLastOnline: 10 },
        g: { userId: "g", username: "Mr G", secondsSinceLastOnline: 10 },
    };
    test("up to five participants get listed", () => {
        const participants = getParticipantsString(lookup, withFewerThanSix, "Unknown User", "You");
        expect(participants).toEqual("Mr B, Mr C, Mr D, Mr E, Mr A, You");
    });
    test("with unknown users", () => {
        const participants = getParticipantsString(lookup, withUnknown, "Unknown User", "You");
        expect(participants).toEqual("Mr B, Mr D, Mr E, Mr A, Unknown User, You");
    });
    test("with more than 5 participants", () => {
        const participants = getParticipantsString(lookup, withMoreThanSix, "Unknown User", "You");
        expect(participants).toEqual("8 members (7 online)");
    });
});

describe("merging updates", () => {
    const initialChats = [
        groupChatId(1),
        groupChatId(2),
        groupChatId(3),
        directChatId(4),
        directChatId(5),
    ];

    test("removed chats get removed", () => {
        const updatesResponse = {
            chatsUpdated: [],
            chatsRemoved: new Set(["1", "3", "5"]),
            chatsAdded: [],
            timestamp: BigInt(0),
        };
        const merged = mergeChatUpdates(initialChats, updatesResponse);
        expect(merged.length).toEqual(2);
        expect(merged[0].chatId).toEqual("2");
        expect(merged[1].chatId).toEqual("4");
    });

    test("added chats get added", () => {
        const updatesResponse = {
            chatsUpdated: [],
            chatsRemoved: new Set([]),
            chatsAdded: [directChatId(6), directChatId(7)],
            timestamp: BigInt(0),
        };
        const merged = mergeChatUpdates(initialChats, updatesResponse);
        expect(merged.length).toEqual(7);
        expect(merged[6].chatId).toEqual("7");
    });

    describe("updated chats get merged correctly", () => {
        const updatedDirect: UpdatedDirectChatSummary = {
            kind: "direct_chat",
            latestReadByThem: 100,
            chatId: "4",
            lastUpdated: BigInt(1000),
            latestReadByMe: 200,
            latestEventIndex: 300,
            latestMessage: {
                event: {
                    kind: "message",
                    content: {
                        kind: "text_content",
                        text: "test message",
                    },
                    sender: "2",
                    repliesTo: undefined,
                },
                index: 300,
                timestamp: BigInt(400),
            },
        };

        const updatedGroup: UpdatedGroupChatSummary = {
            kind: "group_chat",
            chatId: "2",
            lastUpdated: BigInt(1000),
            latestReadByMe: 200,
            latestMessage: {
                event: {
                    kind: "message",
                    content: {
                        kind: "text_content",
                        text: "test message",
                    },
                    sender: "2",
                    repliesTo: undefined,
                },
                index: 300,
                timestamp: BigInt(400),
            },
            latestEventIndex: 300,
            participantsAdded: [participant("4"), participant("5")],
            participantsRemoved: new Set(["2"]),
            participantsUpdated: [{ ...participant("1"), role: "standard" }],
            name: "stuff",
            description: "stuff",
        };

        test("attempting to update with a mismatched kind throws error", () => {
            const updatesResponse = {
                chatsUpdated: [{ ...updatedDirect, chatId: "1" }],
                chatsRemoved: new Set([]),
                chatsAdded: [],
                timestamp: BigInt(0),
            };
            expect(() => mergeChatUpdates(initialChats, updatesResponse)).toThrow();
        });

        test("direct chats get merged correctly", () => {
            const updatesResponse = {
                chatsUpdated: [updatedDirect],
                chatsRemoved: new Set([]),
                chatsAdded: [],
                timestamp: BigInt(0),
            };
            const merged = mergeChatUpdates(initialChats, updatesResponse);
            const updated = merged.find((c) => c.chatId === "4");
            if (updated && updated.kind === "direct_chat") {
                expect(merged.length).toEqual(5);
                expect(updated?.latestReadByThem).toEqual(100);
                expect(updated?.latestReadByMe).toEqual(200);
                expect(updated?.lastUpdated).toEqual(BigInt(1000));
                expect(updated?.latestMessage).not.toBe(undefined);
            } else {
                fail("updated chat not found or was not a direct chat");
            }
        });

        test("updated group chats get merged correctly", () => {
            const updatesResponse = {
                chatsUpdated: [updatedGroup],
                chatsRemoved: new Set([]),
                chatsAdded: [],
                timestamp: BigInt(0),
            };
            const merged = mergeChatUpdates(initialChats, updatesResponse);
            const updated = merged.find((c) => c.chatId === "2");
            if (updated && updated.kind === "group_chat") {
                expect(merged.length).toEqual(5);
                expect(updated?.latestReadByMe).toEqual(200);
                expect(updated?.lastUpdated).toEqual(BigInt(1000));
                expect(updated?.latestMessage).not.toBe(undefined);
                expect(updated.participants.length).toEqual(4);
                expect(updated.participants[0].userId).toEqual("1");
                expect(updated.participants[1].userId).toEqual("3");
                expect(updated.participants[2].userId).toEqual("4");
                expect(updated.participants[3].userId).toEqual("5");
                expect(updated.participants[0].role).toEqual("standard");
            } else {
                fail("updated chat not found or was not a group chat");
            }
        });
    });

    test.todo("chats end up in the right order");
});

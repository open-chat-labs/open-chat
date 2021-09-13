import type { UserLookup, UserSummary } from "../user/user";
import type {
    DirectChatSummary,
    GroupChatSummary,
    Participant,
    DirectChatSummaryUpdates,
    GroupChatSummaryUpdates,
} from "./chat";
import {
    getParticipantsString,
    mergeChatUpdates,
    newMessageId,
    userIdsFromChatSummaries,
} from "./chat.utils";

const defaultDirectChat: DirectChatSummary = {
    kind: "direct_chat",
    them: "a",
    chatId: "abc",
    unreadByMe: [],
    readByThem: [],
    latestMessage: {
        event: {
            kind: "direct_message",
            sentByMe: true,
            messageId: newMessageId(),
            messageIndex: 0,
            content: {
                kind: "text_content",
                text: "some message",
            },
        },
        timestamp: BigInt(0),
        index: 0,
    },
    latestEventIndex: 0,
    dateCreated: BigInt(0),
};

const defaultGroupChat: GroupChatSummary = {
    kind: "group_chat",
    name: "whatever",
    description: "whatever",
    participants: [participant("1"), participant("2"), participant("3")],
    chatId: "abc",
    lastUpdated: BigInt(0),
    unreadByMe: [],
    latestMessage: undefined,
    public: true,
    joined: BigInt(0),
    minVisibleEventIndex: 0,
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
    const withFewerThanSix = ["a", "b", "c", "d", "z"];
    const withUnknown = ["a", "b", "x", "d", "z"];
    const withMoreThanSix = ["a", "b", "c", "d", "e", "f", "g", "z"];
    const lookup: UserLookup = {
        a: { userId: "a", username: "Mr A", secondsSinceLastOnline: 200 },
        b: { userId: "b", username: "Mr B", secondsSinceLastOnline: 20 },
        c: { userId: "c", username: "Mr C", secondsSinceLastOnline: 20 },
        d: { userId: "d", username: "Mr D", secondsSinceLastOnline: 20 },
        e: { userId: "e", username: "Mr E", secondsSinceLastOnline: 10 },
        f: { userId: "f", username: "Mr F", secondsSinceLastOnline: 10 },
        g: { userId: "g", username: "Mr G", secondsSinceLastOnline: 10 },
        z: { userId: "z", username: "Mr Z", secondsSinceLastOnline: 10 },
    };

    const user = lookup.z as UserSummary;

    test("up to five participants get listed", () => {
        const participants = getParticipantsString(
            user,
            lookup,
            withFewerThanSix,
            "Unknown User",
            "You"
        );
        expect(participants).toEqual("Mr B, Mr C, Mr D, You, Mr A");
    });
    test("with unknown users", () => {
        const participants = getParticipantsString(
            user,
            lookup,
            withUnknown,
            "Unknown User",
            "You"
        );
        expect(participants).toEqual("Mr B, Mr D, You, Mr A, Unknown User");
    });
    test("with more than 5 participants", () => {
        const participants = getParticipantsString(
            user,
            lookup,
            withMoreThanSix,
            "Unknown User",
            "You"
        );
        expect(participants).toEqual("8 members (8 online)");
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
            blockedUsers: new Set<string>(),
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
            blockedUsers: new Set<string>(),
        };
        const merged = mergeChatUpdates(initialChats, updatesResponse);
        expect(merged.length).toEqual(7);
        expect(merged[6].chatId).toEqual("7");
    });

    describe("updated chats get merged correctly", () => {
        const updatedDirect: DirectChatSummaryUpdates = {
            kind: "direct_chat",
            unreadByMe: [],
            chatId: "4",
            readByThem: [],
            latestEventIndex: 300,
            latestMessage: {
                event: {
                    kind: "direct_message",
                    content: {
                        kind: "text_content",
                        text: "test message",
                    },
                    sentByMe: true,
                    repliesTo: undefined,
                    messageId: newMessageId(),
                    messageIndex: 300,
                },
                index: 300,
                timestamp: BigInt(400),
            },
        };

        const updatedGroup: GroupChatSummaryUpdates = {
            kind: "group_chat",
            chatId: "2",
            lastUpdated: BigInt(1000),
            unreadByMe: [],
            latestMessage: {
                event: {
                    kind: "group_message",
                    content: {
                        kind: "text_content",
                        text: "test message",
                    },
                    sender: "2",
                    repliesTo: undefined,
                    messageId: newMessageId(),
                    messageIndex: 300,
                },
                index: 300,
                timestamp: BigInt(400),
            },
            latestEventIndex: 300,
            participantsAddedOrUpdated: [
                participant("4"),
                participant("5"),
                { ...participant("1"), role: "standard" },
            ],
            participantsRemoved: new Set(["2"]),
            name: "stuff",
            description: "stuff",
        };

        test("attempting to update with a mismatched kind throws error", () => {
            const updatesResponse = {
                chatsUpdated: [{ ...updatedDirect, chatId: "1" }],
                chatsRemoved: new Set([]),
                chatsAdded: [],
                timestamp: BigInt(0),
                blockedUsers: new Set<string>(),
            };
            expect(() => mergeChatUpdates(initialChats, updatesResponse)).toThrow();
        });

        test("direct chats get merged correctly", () => {
            const updatesResponse = {
                chatsUpdated: [updatedDirect],
                chatsRemoved: new Set([]),
                chatsAdded: [],
                timestamp: BigInt(0),
                blockedUsers: new Set<string>(),
            };
            const merged = mergeChatUpdates(initialChats, updatesResponse);
            const updated = merged.find((c) => c.chatId === "4");
            if (updated && updated.kind === "direct_chat") {
                expect(merged.length).toEqual(5);
                expect(updated.readByThem).toEqual([]);
                expect(updated.unreadByMe).toEqual([]);
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
                blockedUsers: new Set<string>(),
            };
            const merged = mergeChatUpdates(initialChats, updatesResponse);
            const updated = merged.find((c) => c.chatId === "2");
            if (updated && updated.kind === "group_chat") {
                expect(merged.length).toEqual(5);
                expect(updated.unreadByMe).toEqual([]);
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

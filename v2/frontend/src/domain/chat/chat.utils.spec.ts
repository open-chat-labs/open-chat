import DRange from "drange";
import type { PartialUserSummary, UserLookup, UserSummary } from "../user/user";
import type {
    DirectChatSummary,
    GroupChatSummary,
    DirectChatSummaryUpdates,
    GroupChatSummaryUpdates,
    UpdatesResponse,
} from "./chat";
import {
    getParticipantsString,
    indexIsInRanges,
    mergeChatUpdates,
    newMessageId,
    rangesAreEqual,
} from "./chat.utils";

const defaultDirectChat: DirectChatSummary = {
    kind: "direct_chat",
    them: "a",
    chatId: "abc",
    readByMe: new DRange(),
    readByThem: new DRange(),
    latestMessage: {
        event: {
            kind: "message",
            sender: "abcdefg",
            messageId: newMessageId(),
            messageIndex: 100,
            content: {
                kind: "text_content",
                text: "some message",
            },
            reactions: [],
            edited: false,
        },
        timestamp: BigInt(0),
        index: 0,
    },
    latestEventIndex: 0,
    dateCreated: BigInt(0),
    notificationsMuted: false,
};

const defaultGroupChat: GroupChatSummary = {
    kind: "group_chat",
    name: "whatever",
    description: "whatever",
    chatId: "abc",
    lastUpdated: BigInt(0),
    readByMe: new DRange(),
    latestMessage: undefined,
    public: true,
    joined: BigInt(0),
    minVisibleEventIndex: 0,
    minVisibleMessageIndex: 0,
    latestEventIndex: 0,
    notificationsMuted: false,
    participantCount: 10,
    myRole: "admin",
    mentions: [],
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

function createUser(userId: string, username: string, seconds: number): PartialUserSummary {
    const now = Date.now();
    return {
        userId,
        username,
        lastOnline: now - seconds * 1000,
        updated: BigInt(0),
    };
}

describe("get participants string for group chat", () => {
    const withFewerThanSix = ["a", "b", "c", "d", "z"];
    const withUnknown = ["a", "b", "x", "d", "z"];
    const withMoreThanSix = ["a", "b", "c", "d", "e", "f", "g", "z"];
    const lookup: UserLookup = {
        a: createUser("a", "Mr A", 200),
        b: createUser("b", "Mr B", 20),
        c: createUser("c", "Mr C", 20),
        d: createUser("d", "Mr D", 20),
        e: createUser("e", "Mr E", 10),
        f: createUser("f", "Mr F", 10),
        g: createUser("g", "Mr G", 10),
        z: createUser("z", "Mr Z", 10),
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
        expect(participants).toEqual("Mr B, Mr C, Mr D, You and Mr A");
    });
    test("with unknown users", () => {
        const participants = getParticipantsString(
            user,
            lookup,
            withUnknown,
            "Unknown User",
            "You"
        );
        expect(participants).toEqual("Mr B, Mr D, You, Mr A and Unknown User");
    });
    test("with more than 5 participants", () => {
        const participants = getParticipantsString(
            user,
            lookup,
            withMoreThanSix,
            "Unknown User",
            "You"
        );
        expect(participants).toEqual("8 members");
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
        const updatesResponse: UpdatesResponse = {
            chatsUpdated: [],
            chatsRemoved: new Set(["1", "3", "5"]),
            chatsAdded: [],
            timestamp: BigInt(0),
            blockedUsers: new Set<string>(),
            transactions: [],
            alerts: [],
        };
        const merged = mergeChatUpdates(initialChats, updatesResponse);
        expect(merged.length).toEqual(2);
        expect(merged[0].chatId).toEqual("2");
        expect(merged[1].chatId).toEqual("4");
    });

    test("added chats get added", () => {
        const updatesResponse: UpdatesResponse = {
            chatsUpdated: [],
            chatsRemoved: new Set([]),
            chatsAdded: [directChatId(6), directChatId(7)],
            timestamp: BigInt(0),
            blockedUsers: new Set<string>(),
            transactions: [],
            alerts: [],
        };
        const merged = mergeChatUpdates(initialChats, updatesResponse);
        expect(merged.length).toEqual(7);
        expect(merged[6].chatId).toEqual("7");
    });

    describe("updated chats get merged correctly", () => {
        const updatedDirect: DirectChatSummaryUpdates = {
            kind: "direct_chat",
            readByMe: new DRange(),
            chatId: "4",
            readByThem: new DRange(),
            latestEventIndex: 300,
            latestMessage: {
                event: {
                    kind: "message",
                    content: {
                        kind: "text_content",
                        text: "test message",
                    },
                    sender: "abcdefg",
                    repliesTo: undefined,
                    messageId: newMessageId(),
                    messageIndex: 300,
                    reactions: [],
                    edited: false,
                },
                index: 300,
                timestamp: BigInt(400),
            },
        };

        const updatedGroup: GroupChatSummaryUpdates = {
            kind: "group_chat",
            chatId: "2",
            lastUpdated: BigInt(1000),
            readByMe: new DRange(),
            latestMessage: {
                event: {
                    kind: "message",
                    content: {
                        kind: "text_content",
                        text: "test message",
                    },
                    sender: "2",
                    repliesTo: undefined,
                    messageId: newMessageId(),
                    messageIndex: 300,
                    reactions: [],
                    edited: false,
                },
                index: 300,
                timestamp: BigInt(400),
            },
            latestEventIndex: 300,
            name: "stuff",
            description: "stuff",
            mentions: [],
        };

        test("attempting to update with a mismatched kind throws error", () => {
            const updatesResponse: UpdatesResponse = {
                chatsUpdated: [{ ...updatedDirect, chatId: "1" }],
                chatsRemoved: new Set([]),
                chatsAdded: [],
                timestamp: BigInt(0),
                blockedUsers: new Set<string>(),
                transactions: [],
                alerts: [],
            };
            expect(() => mergeChatUpdates(initialChats, updatesResponse)).toThrow();
        });

        test("direct chats get merged correctly", () => {
            const updatesResponse: UpdatesResponse = {
                chatsUpdated: [updatedDirect],
                chatsRemoved: new Set([]),
                chatsAdded: [],
                timestamp: BigInt(0),
                blockedUsers: new Set<string>(),
                transactions: [],
                alerts: [],
            };
            const merged = mergeChatUpdates(initialChats, updatesResponse);
            const updated = merged.find((c) => c.chatId === "4");
            if (updated && updated.kind === "direct_chat") {
                expect(merged.length).toEqual(5);
                expect(updated.readByThem.length).toEqual(0);
                expect(updated.readByMe.length).toEqual(0);
                expect(updated?.latestMessage).not.toBe(undefined);
            } else {
                fail("updated chat not found or was not a direct chat");
            }
        });

        test("updated group chats get merged correctly", () => {
            const updatesResponse: UpdatesResponse = {
                chatsUpdated: [updatedGroup],
                chatsRemoved: new Set([]),
                chatsAdded: [],
                timestamp: BigInt(0),
                blockedUsers: new Set<string>(),
                transactions: [],
                alerts: [],
            };
            const merged = mergeChatUpdates(initialChats, updatesResponse);
            const updated = merged.find((c) => c.chatId === "2");
            if (updated && updated.kind === "group_chat") {
                expect(merged.length).toEqual(5);
                expect(updated.readByMe.length).toEqual(0);
                expect(updated?.lastUpdated).toEqual(BigInt(1000));
                expect(updated?.latestMessage).not.toBe(undefined);
            } else {
                fail("updated chat not found or was not a group chat");
            }
        });
    });

    test.todo("chats end up in the right order");
});

describe("message ranges are equal", () => {
    test("ranges are not equal length", () => {
        const a = new DRange(0, 10);
        const b = new DRange(0, 10).add(12, 20);
        expect(rangesAreEqual(a, b)).toBe(false);
    });
    test("ranges are equal length but not equal", () => {
        const a = new DRange(0, 10).add(12, 20);
        const b = new DRange(0, 10).add(12, 21);
        expect(rangesAreEqual(a, b)).toBe(false);
    });
    test("ranges are equal", () => {
        const a = new DRange(0, 10).add(12, 20);
        const b = new DRange(0, 10).add(12, 20);
        expect(rangesAreEqual(a, b)).toBe(true);
    });
    test("ranges are equal again", () => {
        const a = new DRange(0, 10).add(12, 20).add(100, 250);
        const b = new DRange(0, 10).add(12, 20).add(100, 250);
        expect(rangesAreEqual(a, b)).toBe(true);
    });
    test("ranges differ only in the 'to' property", () => {
        const a = new DRange(0, 10).add(12, 20).add(100, 250);
        const b = new DRange(0, 10).add(12, 20).add(100, 260);
        expect(rangesAreEqual(a, b)).toBe(false);
    });
});

describe("index is in ranges", () => {
    test("where index is not in ranges", () => {
        expect(indexIsInRanges(15, new DRange(11, 13))).toEqual(false);
    });
    test("where index is in ranges", () => {
        expect(indexIsInRanges(15, new DRange(11, 13).add(15, 20))).toEqual(true);
    });
    test("where there are no ranges", () => {
        expect(indexIsInRanges(15, new DRange())).toEqual(false);
    });
});

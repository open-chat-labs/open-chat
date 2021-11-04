import type { PartialUserSummary, UserLookup, UserSummary } from "../user/user";
import type {
    DirectChatSummary,
    GroupChatSummary,
    DirectChatSummaryUpdates,
    GroupChatSummaryUpdates,
    MessageIndexRange,
    UpdatesResponse,
} from "./chat";
import {
    compareMessageRange,
    getFirstUnreadMessageIndex,
    getParticipantsString,
    indexIsInRanges,
    insertIndexIntoRanges,
    mergeChatUpdates,
    mergeMessageIndexRanges,
    messageIndexRangesAreEqual,
    newMessageId,
} from "./chat.utils";

const defaultDirectChat: DirectChatSummary = {
    kind: "direct_chat",
    them: "a",
    chatId: "abc",
    readByMe: [],
    readByThem: [],
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
    readByMe: [],
    latestMessage: undefined,
    public: true,
    joined: BigInt(0),
    minVisibleEventIndex: 0,
    minVisibleMessageIndex: 0,
    latestEventIndex: 0,
    notificationsMuted: false,
    participantCount: 10,
    myRole: "admin",
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

describe("inserting into index ranges", () => {
    test("real example which wasn't working", () => {
        let ranges: MessageIndexRange[] = [];
        ranges = insertIndexIntoRanges(313, ranges);
        ranges = insertIndexIntoRanges(312, ranges);
        ranges = insertIndexIntoRanges(311, ranges);
        ranges = insertIndexIntoRanges(305, ranges);
        ranges = insertIndexIntoRanges(306, ranges);
        ranges = insertIndexIntoRanges(307, ranges);
        ranges = insertIndexIntoRanges(308, ranges);
        ranges = insertIndexIntoRanges(310, ranges);
        expect(ranges.length).toEqual(2);
        expect(ranges).toEqual([
            { from: 305, to: 308 },
            { from: 310, to: 313 },
        ]);
    });
});

describe("sorting message index ranges", () => {
    test("sort by from first", () => {
        expect(
            [
                { from: 10, to: 100 },
                { from: 5, to: 100 },
                { from: 3, to: 100 },
            ].sort(compareMessageRange)
        ).toEqual([
            { from: 3, to: 100 },
            { from: 5, to: 100 },
            { from: 10, to: 100 },
        ]);
    });
    test("sort by to if from are equal", () => {
        expect(
            [
                { from: 10, to: 80 },
                { from: 10, to: 60 },
                { from: 10, to: 40 },
            ].sort(compareMessageRange)
        ).toEqual([
            { from: 10, to: 40 },
            { from: 10, to: 60 },
            { from: 10, to: 80 },
        ]);
    });
});

describe("merging message index ranges", () => {
    test("with no ranges", () => {
        expect(mergeMessageIndexRanges([], [])).toEqual([]);
    });
    test("a single value range", () => {
        expect(mergeMessageIndexRanges([{ from: 10, to: 10 }], [{ from: 11, to: 11 }])).toEqual([
            { from: 10, to: 11 },
        ]);
    });
    test("with no overlaps", () => {
        expect(
            mergeMessageIndexRanges(
                [
                    { from: 25, to: 30 },
                    { from: 0, to: 20 },
                ],
                [{ from: 40, to: 50 }]
            )
        ).toEqual([
            { from: 0, to: 20 },
            { from: 25, to: 30 },
            { from: 40, to: 50 },
        ]);
    });
    test("with overlaps", () => {
        expect(
            mergeMessageIndexRanges(
                [
                    { from: 25, to: 30 },
                    { from: 0, to: 20 },
                ],
                [
                    { from: 40, to: 50 },
                    { from: 10, to: 28 },
                    { from: 29, to: 35 },
                ]
            )
        ).toEqual([
            { from: 0, to: 35 },
            { from: 40, to: 50 },
        ]);
    });
});

describe("message ranges are equal", () => {
    test("ranges are not equal length", () => {
        const a = [{ from: 0, to: 10 }];
        const b = [
            { from: 0, to: 10 },
            { from: 11, to: 20 },
        ];
        expect(messageIndexRangesAreEqual(a, b)).toBe(false);
    });
    test("ranges are equal length but not equal", () => {
        const a = [
            { from: 0, to: 10 },
            { from: 11, to: 20 },
        ];
        const b = [
            { from: 0, to: 10 },
            { from: 11, to: 21 },
        ];
        expect(messageIndexRangesAreEqual(a, b)).toBe(false);
    });
    test("ranges are equal", () => {
        const a = [
            { from: 0, to: 10 },
            { from: 11, to: 20 },
        ];
        const b = [
            { from: 0, to: 10 },
            { from: 11, to: 20 },
        ];
        expect(messageIndexRangesAreEqual(a, b)).toBe(true);
    });
    test("ranges are equal again", () => {
        const a = [
            { from: 0, to: 10 },
            { from: 11, to: 20 },
            { from: 100, to: 250 },
        ];
        const b = [
            { from: 0, to: 10 },
            { from: 11, to: 20 },
            { from: 100, to: 250 },
        ];
        expect(messageIndexRangesAreEqual(a, b)).toBe(true);
    });
    test("ranges differ only in the 'to' property", () => {
        const a = [
            { from: 0, to: 10 },
            { from: 11, to: 20 },
            { from: 100, to: 250 },
        ];
        const b = [
            { from: 0, to: 10 },
            { from: 11, to: 20 },
            { from: 100, to: 260 },
        ];
        expect(messageIndexRangesAreEqual(a, b)).toBe(false);
    });
});

describe("index is in ranges", () => {
    test("where index is not in ranges", () => {
        expect(indexIsInRanges(16, [{ from: 11, to: 13 }])).toEqual(false);
    });
    test("where index is in ranges", () => {
        expect(
            indexIsInRanges(16, [
                { from: 11, to: 13 },
                { from: 15, to: 20 },
            ])
        ).toEqual(true);
    });
    test("where there are no ranges", () => {
        expect(indexIsInRanges(16, [])).toEqual(false);
    });
});

describe("getting first unread message index", () => {
    test("where we have read everything", () => {
        expect(
            getFirstUnreadMessageIndex({
                ...defaultDirectChat,
                readByMe: [{ from: 0, to: 100 }],
            })
        ).toEqual(101);
    });
    test("where we have no messages", () => {
        expect(
            getFirstUnreadMessageIndex({
                ...defaultDirectChat,
                latestMessage: undefined,
                readByMe: [],
            })
        ).toEqual(Number.MAX_VALUE);
    });
    test("where we have read nothing", () => {
        expect(
            getFirstUnreadMessageIndex({
                ...defaultDirectChat,
                readByMe: [],
            })
        ).toEqual(0);
    });
    test("where we are missing messages at the end", () => {
        expect(
            getFirstUnreadMessageIndex({
                ...defaultDirectChat,
                readByMe: [{ from: 0, to: 80 }],
            })
        ).toEqual(81);
    });
    test("where we are missing messages at the beginning", () => {
        expect(
            getFirstUnreadMessageIndex({
                ...defaultDirectChat,
                readByMe: [{ from: 20, to: 80 }],
            })
        ).toEqual(0);
    });
    test("where we have multiple gaps including the beginning", () => {
        expect(
            getFirstUnreadMessageIndex({
                ...defaultDirectChat,
                readByMe: [
                    { from: 20, to: 40 },
                    { from: 50, to: 60 },
                    { from: 70, to: 80 },
                ],
            })
        ).toEqual(0);
    });
    test("where we have multiple gaps after the beginning", () => {
        expect(
            getFirstUnreadMessageIndex({
                ...defaultDirectChat,
                readByMe: [
                    { from: 0, to: 40 },
                    { from: 50, to: 60 },
                    { from: 70, to: 80 },
                ],
            })
        ).toEqual(41);
    });
});

function createUser(userId: string, username: string, seconds: number): PartialUserSummary {
    const now = Date.now();
    return {
        userId,
        username,
        lastOnline: now - seconds * 1000,
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
            readByMe: [],
            chatId: "4",
            readByThem: [],
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
            readByMe: [],
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
                expect(updated.readByThem).toEqual([]);
                expect(updated.readByMe).toEqual([]);
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
                expect(updated.readByMe).toEqual([]);
                expect(updated?.lastUpdated).toEqual(BigInt(1000));
                expect(updated?.latestMessage).not.toBe(undefined);
            } else {
                fail("updated chat not found or was not a group chat");
            }
        });
    });

    test.todo("chats end up in the right order");
});

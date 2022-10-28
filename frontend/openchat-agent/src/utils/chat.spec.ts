import type {
    DirectChatSummary,
    DirectChatSummaryUpdates,
    GroupChatSummary,
    GroupChatSummaryUpdates,
    UpdatesResponse,
} from "openchat-shared";
import { enoughVisibleMessages, mergeChatUpdates, emptyChatMetrics } from "./chat";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
BigInt.prototype.toJSON = function () {
    return this.toString();
};

const defaultDirectChat: DirectChatSummary = {
    kind: "direct_chat",
    them: "a",
    chatId: "abc",
    readByMeUpTo: undefined,
    readByThemUpTo: undefined,
    latestMessage: {
        event: {
            kind: "message",
            sender: "abcdefg",
            messageId: BigInt(1),
            messageIndex: 100,
            content: {
                kind: "text_content",
                text: "some message",
            },
            reactions: [],
            edited: false,
            forwarded: false,
        },
        timestamp: BigInt(0),
        index: 0,
    },
    latestEventIndex: 0,
    dateCreated: BigInt(0),
    notificationsMuted: false,
    metrics: emptyChatMetrics(),
    myMetrics: emptyChatMetrics(),
    archived: false,
};

const defaultGroupChat: GroupChatSummary = {
    kind: "group_chat",
    name: "whatever",
    description: "whatever",
    chatId: "abc",
    lastUpdated: BigInt(0),
    readByMeUpTo: undefined,
    latestMessage: undefined,
    public: true,
    historyVisibleToNewJoiners: false,
    joined: BigInt(0),
    minVisibleEventIndex: 0,
    minVisibleMessageIndex: 0,
    latestEventIndex: 0,
    notificationsMuted: false,
    memberCount: 10,
    myRole: "admin",
    mentions: [],
    ownerId: "some_owner",
    permissions: {
        changePermissions: "admins",
        changeRoles: "admins",
        addMembers: "admins",
        removeMembers: "admins",
        blockUsers: "admins",
        deleteMessages: "admins",
        updateGroup: "admins",
        pinMessages: "admins",
        inviteUsers: "admins",
        createPolls: "members",
        sendMessages: "members",
        reactToMessages: "members",
        replyInThread: "members",
    },
    metrics: emptyChatMetrics(),
    myMetrics: emptyChatMetrics(),
    latestThreads: [
        {
            threadRootMessageIndex: 1,
            lastUpdated: BigInt(0),
            latestEventIndex: 3,
            latestMessageIndex: 3,
        },
    ],
    subtype: undefined,
    archived: false,
    previewed: false,
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

describe("enough visible messages", () => {
    test("returns false when there are no messages", () => {
        expect(enoughVisibleMessages(true, [0, 1000], [])).toBe(false);
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
            avatarIdUpdate: undefined,
            timestamp: BigInt(0),
            blockedUsers: undefined,
            pinnedChats: undefined,
            transactions: [],
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
            avatarIdUpdate: undefined,
            timestamp: BigInt(0),
            blockedUsers: undefined,
            pinnedChats: undefined,
            transactions: [],
        };
        const merged = mergeChatUpdates(initialChats, updatesResponse);
        expect(merged.length).toEqual(7);
        expect(merged[6].chatId).toEqual("7");
    });

    describe("updated chats get merged correctly", () => {
        const updatedDirect: DirectChatSummaryUpdates = {
            kind: "direct_chat",
            readByMeUpTo: 100,
            chatId: "4",
            readByThemUpTo: 200,
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
                    messageId: BigInt(2),
                    messageIndex: 300,
                    reactions: [],
                    edited: false,
                    forwarded: false,
                },
                index: 300,
                timestamp: BigInt(400),
            },
            affectedEvents: [],
            metrics: emptyChatMetrics(),
            myMetrics: emptyChatMetrics(),
        };

        const updatedGroup: GroupChatSummaryUpdates = {
            kind: "group_chat",
            chatId: "2",
            lastUpdated: BigInt(1000),
            readByMeUpTo: 250,
            latestMessage: {
                event: {
                    kind: "message",
                    content: {
                        kind: "text_content",
                        text: "test message",
                    },
                    sender: "2",
                    repliesTo: undefined,
                    messageId: BigInt(3),
                    messageIndex: 300,
                    reactions: [],
                    edited: false,
                    forwarded: false,
                },
                index: 300,
                timestamp: BigInt(400),
            },
            latestEventIndex: 300,
            name: "stuff",
            description: "stuff",
            mentions: [],
            affectedEvents: [],
            metrics: emptyChatMetrics(),
            myMetrics: emptyChatMetrics(),
            subtype: { kind: "no_change" },
        };

        test("attempting to update with a mismatched kind throws error", () => {
            const updatesResponse: UpdatesResponse = {
                chatsUpdated: [{ ...updatedDirect, chatId: "1" }],
                chatsRemoved: new Set([]),
                chatsAdded: [],
                avatarIdUpdate: undefined,
                timestamp: BigInt(0),
                blockedUsers: undefined,
                pinnedChats: undefined,
                transactions: [],
            };
            expect(() => mergeChatUpdates(initialChats, updatesResponse)).toThrow();
        });

        test("direct chats get merged correctly", () => {
            const updatesResponse: UpdatesResponse = {
                chatsUpdated: [updatedDirect],
                chatsRemoved: new Set([]),
                chatsAdded: [],
                avatarIdUpdate: undefined,
                timestamp: BigInt(0),
                blockedUsers: undefined,
                pinnedChats: undefined,
                transactions: [],
            };
            const merged = mergeChatUpdates(initialChats, updatesResponse);
            const updated = merged.find((c) => c.chatId === "4");
            if (updated && updated.kind === "direct_chat") {
                expect(merged.length).toEqual(5);
                expect(updated.readByMeUpTo).toEqual(100);
                expect(updated.readByThemUpTo).toEqual(200);
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
                avatarIdUpdate: undefined,
                timestamp: BigInt(0),
                blockedUsers: undefined,
                pinnedChats: undefined,
                transactions: [],
            };
            const merged = mergeChatUpdates(initialChats, updatesResponse);
            const updated = merged.find((c) => c.chatId === "2");
            if (updated && updated.kind === "group_chat") {
                expect(merged.length).toEqual(5);
                expect(updated.readByMeUpTo).toBe(250);
                expect(updated?.lastUpdated).toEqual(BigInt(1000));
                expect(updated?.latestMessage).not.toBe(undefined);
            } else {
                fail("updated chat not found or was not a group chat");
            }
        });
    });

    test.todo("chats end up in the right order");
});

import {
    CommunityMap,
    emptyChatMetrics,
    emptyRules,
    nullMembership,
    type ChatIdentifier,
    type CommunityIdentifier,
    type CommunityPermissions,
    type CommunitySummary,
    type EventWrapper,
    type GroupChatIdentifier,
    type GroupChatSummary,
    type Member,
    type Message,
} from "openchat-shared";
import { vi } from "vitest";
import { app } from "./app.svelte";
import { chatDetailsLocalUpdates } from "./chat_details";
import { communityLocalUpdates } from "./community_details/local.svelte";
import { localUpdates } from "./global";
import { pathState } from "./path.svelte";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
const mockContext: PageJS.Context = {
    save: vi.fn(),
    pushState: vi.fn(),
    handled: false,
    canonicalPath: "",
    path: "",
    querystring: "",
    hash: "",
    pathname: "",
    state: {},
    title: "",
    params: {},
};

describe("app state", () => {
    beforeEach(() => {
        localUpdates.clearAll();
        pathState.setRouteParams(mockContext, {
            kind: "home_route",
            scope: { kind: "group_chat" },
        });
    });

    describe("chat state", () => {
        const communityId: CommunityIdentifier = { kind: "community", communityId: "123456" };
        const chatId: ChatIdentifier = {
            kind: "channel",
            communityId: "123456",
            channelId: 123456,
        };
        beforeEach(() => {
            pathState.setRouteParams(mockContext, {
                kind: "selected_channel_route",
                chatId,
                communityId,
                messageIndex: 0,
                open: false,
                scope: { kind: "community", id: communityId },
            });
            app.setSelectedChat(chatId);
        });

        test("chat list scope is set", () => {
            expect(app.chatListScope).toMatchObject({ kind: "community", id: communityId });
            pathState.setRouteParams(mockContext, {
                kind: "explore_groups_route",
                scope: { kind: "group_chat" },
            });
            expect(app.chatListScope).toMatchObject({ kind: "group_chat" });
        });

        test("selected chat id is set", () => {
            expect(app.selectedChatId).toEqual(chatId);
        });

        function setChatDetails(chatId: ChatIdentifier) {
            app.setSelectedChat(chatId);
            app.setChatDetailsFromServer(
                chatId,
                new Map([
                    [
                        "user_one",
                        {
                            role: "member",
                            userId: "user_one",
                            displayName: "User One",
                            lapsed: false,
                        },
                    ],
                ]),
                new Set(),
                new Set(["a", "b", "c"]),
                new Set(),
                new Set(),
                emptyRules(),
                new Map(),
                new Map(),
                new Map(),
            );
            app.updateServerEvents(chatId, () => {
                return [chatMessage()];
            });
        }

        describe("setting chat details", () => {
            beforeEach(() => setChatDetails(chatId));

            test("make sure local updates are merged", () => {
                expect(app.selectedChat.members.has("user_one")).toBe(true);
                const undo = localUpdates.removeChatMember(chatId, "user_one");
                expect(app.selectedChat.members.has("user_one")).toBe(false);
                undo();
                expect(app.selectedChat.members.has("user_one")).toBe(true);
            });

            test("make sure that only server state is overwritten if chatId doesn't change", () => {
                app.selectedChat.expandDeletedMessages(new Set([1, 2, 3]));
                expect(app.selectedChat.expandedDeletedMessages.has(3)).toBe(true);
                setChatDetails(chatId); // reset the server state for the *same* chatId
                expect(app.selectedChat.expandedDeletedMessages.has(3)).toBe(true);
            });

            test("make sure that all state is overwritten if the chatId *does* change", () => {
                app.selectedChat.expandDeletedMessages(new Set([1, 2, 3]));
                expect(app.selectedChat.expandedDeletedMessages.has(3)).toBe(true);
                setChatDetails({ ...chatId, channelId: 654321 }); // reset the server state for a different chatId
                expect(app.selectedChat.expandedDeletedMessages.has(3)).toBe(false);
            });
        });

        describe("chat summary local updates", () => {
            const groupId: GroupChatIdentifier = { kind: "group_chat", groupId: "123456" };

            beforeEach(() => {
                initialiseGlobalState();
            });

            describe("direct chat bots", () => {
                test("bots correctly initialised", () => {
                    expect(app.directChatBots.has("123456")).toBe(true);
                });

                test("install a bot works", () => {
                    localUpdates.installDirectChatBot("654321", {
                        chatPermissions: [],
                        communityPermissions: [],
                        messagePermissions: [],
                    });
                    expect(app.directChatBots.has("654321")).toBe(true);
                    expect(app.directChatBots.has("123456")).toBe(true);
                });

                test("uninstall a bot works", () => {
                    localUpdates.removeDirectChatBot("123456");
                    expect(app.directChatBots.has("123456")).toBe(false);
                });
            });

            describe("last message updates", () => {
                beforeEach(() => {
                    pathState.setRouteParams(mockContext, {
                        kind: "home_route",
                        scope: { kind: "group_chat" },
                    });
                    localUpdates.addChat(groupChat("654321", chatMessage()));
                });
                test("tips", () => {
                    localUpdates.markTip(123456n, "ledger1", "user2", 123n);
                    const chat = app.chatSummaries.get({
                        kind: "group_chat",
                        groupId: "654321",
                    });
                    expect(chat).not.toBeUndefined();
                    expect(chat?.latestMessage?.event.tips).toMatchObject({
                        ledger1: {
                            user2: 123n,
                        },
                    });
                });
            });

            describe("chat properties", () => {
                beforeEach(() => {
                    localUpdates.clearAll();
                });

                test("chat found in all chats", () => {
                    groupChatExpectation(groupId, (g) => {
                        expect(g.name).toEqual("group chat one");
                    });
                });

                test("notifications muted", () => {
                    expect(app.allChats.get(groupId)?.membership.notificationsMuted).toEqual(false);
                    localUpdates.updateNotificationsMuted(groupId, true);
                    expect(app.allChats.get(groupId)?.membership.notificationsMuted).toEqual(true);
                });

                test("archived", () => {
                    expect(app.allChats.get(groupId)?.membership.archived).toEqual(false);
                    localUpdates.updateArchived(groupId, true);
                    expect(app.allChats.get(groupId)?.membership.archived).toEqual(true);
                });

                test("name", () => {
                    groupChatExpectation(groupId, (g) => {
                        expect(g.name).toEqual("group chat one");
                        localUpdates.updateChatProperties(groupId, "name updated");
                        groupChatExpectation(groupId, (g) => {
                            expect(g.name).toEqual("name updated");
                        });
                    });
                });

                test("when no updates, the server chat is returned", () => {
                    const g = app.allChats.get(groupId);
                    const s = app.allServerChats.get(groupId);
                    expect(g === s).toBe(true);
                });

                test("when there are updates, the server chat is not mutated", () => {
                    localUpdates.updateChatProperties(groupId, "name updated");
                    const client = app.allChats.get(groupId);
                    const server = app.allServerChats.get(groupId);
                    expect(client === server).toBe(false);
                    expect(client?.kind === "group_chat" && client.name === "name updated").toBe(
                        true,
                    );
                    expect(server?.kind === "group_chat" && server.name === "group chat one").toBe(
                        true,
                    );
                });

                test("scoping works as expected", () => {
                    pathState.setRouteParams(mockContext, {
                        kind: "home_route",
                        scope: { kind: "group_chat" },
                    });
                    expect(app.allChats.get(groupId)).not.toBeUndefined();
                    expect(app.chatSummaries.get(groupId)).not.toBeUndefined();
                    pathState.setRouteParams(mockContext, {
                        kind: "home_route",
                        scope: { kind: "direct_chat" },
                    });
                    expect(app.chatSummaries.get(groupId)).toBeUndefined();
                });
            });

            describe("add or remove chats", () => {
                test("remove a chat", () => {
                    localUpdates.removeChat(groupId);
                    expect(app.allChats.get(groupId)).toBeUndefined();
                });
                test("add a chat", () => {
                    expect(
                        app.allChats.get({ kind: "group_chat", groupId: "654321" }),
                    ).toBeUndefined();
                    localUpdates.addChat(groupChat("654321"));
                    expect(
                        app.allChats.get({ kind: "group_chat", groupId: "654321" }),
                    ).not.toBeUndefined();
                });
                test("preview a chat", () => {
                    localUpdates.addGroupPreview(groupChat("654321"));
                    expect(
                        app.allChats.get({ kind: "group_chat", groupId: "654321" }),
                    ).not.toBeUndefined();
                });
            });
        });

        describe("chat events", () => {
            beforeEach(() => setChatDetails(chatId));

            test("server events are returned when there are no updates", () => {
                const client = app.selectedChat.events[0];
                const server = app.selectedChat.serverEvents[0];
                expect(client === server).toBe(true);
            });

            test("server object should not be mutated if there are updates", () => {
                app.translate(123456n, "whatever");
                const client = app.selectedChat.events[0];
                const server = app.selectedChat.serverEvents[0];
                expect(client === server).toBe(false);
                expect(
                    client.event.kind === "message" &&
                        client.event.content.kind === "text_content" &&
                        client.event.content.text === "whatever",
                ).toBe(true);
            });
        });
    });

    describe("community state", () => {
        const communityId: CommunityIdentifier = { kind: "community", communityId: "123456" };
        beforeEach(() => {
            pathState.setRouteParams(mockContext, {
                kind: "selected_community_route",
                communityId,
                scope: { kind: "community", id: communityId },
            });
            app.setSelectedCommunity(communityId);
        });

        test("selected community id is set", () => {
            expect(app.selectedCommunityId).toMatchObject(communityId);

            pathState.setRouteParams(mockContext, {
                kind: "home_route",
                scope: { kind: "group_chat" },
            });

            expect(app.selectedCommunityId).toBeUndefined();
        });

        describe("setting community details", () => {
            beforeEach(() => {
                app.setCommunityDetailsFromServer(
                    communityId,
                    new Map(),
                    new Map([
                        [
                            "user_one",
                            {
                                role: "member",
                                userId: "user_one",
                                displayName: "User One",
                                lapsed: false,
                            },
                        ],
                    ]),
                    new Set(["a", "b", "c"]),
                    new Set(),
                    new Set(),
                    new Set(),
                    new Map(),
                    new Map(),
                );
            });

            test("local map updates - remove member", () => {
                expect(app.selectedCommunity.members.has("user_one")).toBe(true);
                const undo = communityLocalUpdates.removeMember(communityId, "user_one");
                expect(app.selectedCommunity.members.has("user_one")).toBe(false);
                undo();
                expect(app.selectedCommunity.members.has("user_one")).toBe(true);
            });

            test("local map updates - update member", () => {
                const updated: Member = {
                    role: "admin",
                    userId: "user_one",
                    displayName: "Mr One",
                    lapsed: false,
                };
                expect(app.selectedCommunity.members.has("user_two")).toBe(false);
                const undo = communityLocalUpdates.updateMember(communityId, "user_one", updated);
                expect(app.selectedCommunity.members.get("user_one")?.displayName).toEqual(
                    "Mr One",
                );
                undo();
                expect(app.selectedCommunity.members.get("user_one")?.displayName).toEqual(
                    "User One",
                );
            });

            test("local set updates", () => {
                expect(app.selectedCommunity.blockedUsers.has("a")).toBe(true);
                expect(app.selectedCommunity.blockedUsers.has("d")).toBe(false);

                // check that local updates work and are correctly merged with server state
                const undo = communityLocalUpdates.blockUser(communityId, "d");
                expect(app.selectedCommunity.blockedUsers.has("d")).toBe(true);

                // undo the local update
                undo();
                expect(app.selectedCommunity.blockedUsers.has("d")).toBe(false);

                // try unblock
                communityLocalUpdates.unblockUser(communityId, "a");
                expect(app.selectedCommunity.blockedUsers.has("a")).toBe(false);
            });
        });
    });

    describe("CommunityMap from list", () => {
        test("it works", () => {
            const map = CommunityMap.fromList([
                createCommunitySummary("123456", 1),
                createCommunitySummary("654321", 2),
            ]);
            expect(map.size).toEqual(2);
        });
    });

    describe("global state", () => {
        beforeEach(() => {
            app.serverCommunities = CommunityMap.fromList([
                createCommunitySummary("123456", 1),
                createCommunitySummary("654321", 2),
            ]);
        });
        test("communities list", () => {
            expect(app.serverCommunities.size).toEqual(2);
        });
        test("community indexes", () => {
            const id: CommunityIdentifier = { kind: "community", communityId: "123456" };
            expect(app.communities.size).toEqual(2);
            expect(app.communities.get(id)?.membership.index).toEqual(1);
            localUpdates.updateCommunityIndex(id, 3);
            expect(app.communities.get(id)?.membership.index).toEqual(3);
        });

        test("should get the server object if there are no updates", () => {
            const server = app.serverCommunities.get({ kind: "community", communityId: "123456" });
            const client = app.communities.get({ kind: "community", communityId: "123456" });
            expect(client === server).toBe(true);
        });

        test("should not mutate the server object if there are local updates", () => {
            const id: CommunityIdentifier = { kind: "community", communityId: "123456" };
            localUpdates.updateCommunityDisplayName(id, "Mr. OpenChat");
            const server = app.serverCommunities.get(id);
            const client = app.communities.get(id);
            expect(client === server).toBe(false);
        });

        test("community display name", () => {
            const id: CommunityIdentifier = { kind: "community", communityId: "123456" };
            expect(app.communities.get(id)?.membership.displayName).toBeUndefined();
            localUpdates.updateCommunityDisplayName(id, "Mr. OpenChat");
            expect(app.communities.get(id)?.membership.displayName).toEqual("Mr. OpenChat");
        });

        describe("pinned chats", () => {
            beforeEach(() => {
                chatDetailsLocalUpdates.clearAll();
                app.serverPinnedChats = new Map([
                    [
                        "direct_chat",
                        [
                            { kind: "direct_chat", userId: "123456" },
                            { kind: "direct_chat", userId: "888888" },
                        ],
                    ],
                    ["group_chat", [{ kind: "direct_chat", userId: "654321" }]],
                ]);
            });

            test("add a pinned chat", () => {
                const chatId: ChatIdentifier = { kind: "direct_chat", userId: "7777777" };
                localUpdates.pinToScope(chatId, "favourite");
                const favs = app.pinnedChats.get("favourite");
                expect(favs).not.toBeUndefined();
                expect(favs?.length).toEqual(1);
                expect(favs?.[0]).toEqual(chatId);
            });

            test("added chat goes first", () => {
                const chatId: ChatIdentifier = { kind: "direct_chat", userId: "7777777" };
                localUpdates.pinToScope(chatId, "direct_chat");
                const directs = app.pinnedChats.get("direct_chat");
                expect(directs).not.toBeUndefined();
                expect(directs?.length).toEqual(3);
                expect(directs?.[0]).toEqual(chatId);
            });

            test("remove pinned chat", () => {
                const chatId: ChatIdentifier = { kind: "direct_chat", userId: "123456" };
                localUpdates.unpinFromScope(chatId, "direct_chat");
                const directs = app.pinnedChats.get("direct_chat");
                expect(directs).not.toBeUndefined();
                expect(directs?.length).toEqual(1);
                expect(directs?.[0]).toEqual({ kind: "direct_chat", userId: "888888" });
            });
        });
    });
});

function createCommunitySummary(id: string, index: number): CommunitySummary {
    return {
        kind: "community",
        id: { kind: "community", communityId: id },
        name: "",
        description: "",
        memberCount: 0,
        avatar: {},
        banner: {},
        gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
        public: true,
        permissions: defaultPermissions,
        historyVisible: true,
        frozen: false,
        level: "community",
        lastUpdated: BigInt(0),
        latestEventIndex: 0,
        channels: [],
        membership: {
            role: "owner",
            joined: BigInt(0),
            archived: false,
            pinned: [],
            index,
            displayName: undefined,
            rulesAccepted: false,
            lapsed: false,
        },
        primaryLanguage: "en",
        metrics: emptyChatMetrics(),
        userGroups: new Map(),
        localUserIndex: "",
        isInvited: false,
        verified: false,
        latestSuccessfulUpdatesCheck: BigInt(0),
    };
}

const defaultPermissions: CommunityPermissions = {
    changeRoles: "admin",
    updateDetails: "admin",
    inviteUsers: "admin",
    removeMembers: "admin",
    createPublicChannel: "admin",
    createPrivateChannel: "admin",
    manageUserGroups: "admin",
};

function initialiseGlobalState() {
    app.setGlobalState(
        [],
        [groupChat("123456")],
        [],
        new Map(),
        new Set(),
        chitState(),
        [],
        { kind: "auto_wallet", minDollarValue: 100 },
        {
            readUpToTimestamp: BigInt(Date.now() - 10_000),
            latestTimestamp: BigInt(Date.now()),
            unreadCount: 10,
        },
        new Map([
            [
                "123456",
                { chatPermissions: [], messagePermissions: ["text"], communityPermissions: [] },
            ],
        ]),
        new Map(),
        undefined,
    );
}

function groupChat(groupId: string, lastMessage?: EventWrapper<Message>): GroupChatSummary {
    return {
        id: { kind: "group_chat", groupId },
        kind: "group_chat",
        name: "group chat one",
        description: "this is the first group chat",
        historyVisible: true,
        public: false,
        frozen: false,
        permissions: {
            changeRoles: "admin",
            removeMembers: "moderator",
            deleteMessages: "moderator",
            updateGroup: "admin",
            pinMessages: "admin",
            inviteUsers: "admin",
            addMembers: "admin",
            mentionAllMembers: "member",
            reactToMessages: "member",
            startVideoCall: "member",
            messagePermissions: {
                default: "member",
                p2pSwap: "none",
            },
            threadPermissions: undefined,
        },
        gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
        level: "group",
        membership: {
            ...nullMembership(),
            role: "owner",
        },
        messagesVisibleToNonMembers: false,
        verified: false,
        lastUpdated: 1000n,
        latestMessage: lastMessage,
        latestEventIndex: lastMessage?.index ?? 0,
        latestMessageIndex: lastMessage?.event?.messageIndex ?? 0,
        metrics: emptyChatMetrics(),
        eventsTTL: undefined,
        eventsTtlLastUpdated: 0n,
        videoCallInProgress: undefined,
        minVisibleEventIndex: 0,
        minVisibleMessageIndex: 0,
        memberCount: 1000,
        subtype: undefined,
        previewed: false,
        localUserIndex: "",
        isInvited: false,
        dateLastPinned: undefined,
        dateReadPinned: undefined,
        latestSuccessfulUpdatesCheck: BigInt(0),
    };
}

function groupChatExpectation(id: GroupChatIdentifier, fn: (g: GroupChatSummary) => void) {
    const g = app.allChats.get(id);
    if (g && g.kind === "group_chat") {
        fn(g);
    } else {
        fail("Could not find expected group chat");
    }
}

function chitState() {
    return {
        streak: 10,
        streakEnds: BigInt(Date.now() + 1000 * 60 * 60 * 24),
        nextDailyChitClaim: BigInt(Date.now() + 1000 * 60 * 60 * 24),
        chitBalance: 10_000,
        totalChitEarned: 50_000,
    };
}

function chatMessage(): EventWrapper<Message> {
    return {
        index: 0,
        timestamp: BigInt(Date.now()),
        expiresAt: undefined,
        event: {
            kind: "message",
            messageId: 123456n,
            messageIndex: 0,
            content: { kind: "text_content", text: "hello there" },
            sender: "user1",
            reactions: [],
            deleted: false,
            edited: false,
            forwarded: false,
            blockLevelMarkdown: false,
            tips: {},
        },
    };
}

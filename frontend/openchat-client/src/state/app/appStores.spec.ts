import DRange from "drange";
import {
    CommunityMap,
    emptyChatMetrics,
    emptyRules,
    nullMembership,
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_MODERATOR,
    ROLE_NONE,
    ROLE_OWNER,
    type ChatIdentifier,
    type CommunityIdentifier,
    type CommunityPermissions,
    type CommunitySummary,
    type EventWrapper,
    type GroupChatIdentifier,
    type GroupChatSummary,
    type Member,
    type Message,
    type RouteParams,
} from "openchat-shared";
import { get } from "svelte/store";
import { vi } from "vitest";
import { OpenChat } from "../../openchat";
import { chatDetailsLocalUpdates } from "../chat/detailsUpdates";
import { ChatDetailsState } from "../chat/serverDetails";
import { communityLocalUpdates } from "../community/detailUpdates";
import { CommunityDetailsState } from "../community/server";
import { localUpdates } from "../localUpdates";
import {
    notFoundStore,
    pathContextStore,
    routeStore,
    selectedCommunityIdStore,
} from "../path/stores";
import { addToWritableMap } from "../utils";
import {
    allChatsStore,
    allServerChatsStore,
    chatListScopeStore,
    chatSummariesStore,
    communitiesStore,
    directChatBotsStore,
    eventsStore,
    expiredServerEventRanges,
    messageFiltersStore,
    pinnedChatsStore,
    selectedChatExpandedDeletedMessageStore,
    selectedChatIdStore,
    selectedChatMembersStore,
    selectedChatUserGroupKeysStore,
    selectedChatUserIdsStore,
    selectedCommunityBlockedUsersStore,
    selectedCommunityMembersStore,
    selectedServerChatStore,
    selectedServerCommunityStore,
    serverCommunitiesStore,
    serverEventsStore,
    serverPinnedChatsStore,
    translationsStore,
} from "./stores";

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

function setSelectedChat() {
    serverEventsStore.set([]);
    expiredServerEventRanges.set(new DRange());
    selectedChatUserIdsStore.set(new Set());
    selectedChatUserGroupKeysStore.set(new Set());
    selectedChatExpandedDeletedMessageStore.set(new Set());
}

function setRouteParams(ctx: PageJS.Context, p: RouteParams) {
    routeStore.set(p);
    pathContextStore.set(ctx);
    notFoundStore.set(false);
}

describe("app state", () => {
    beforeEach(() => {
        localUpdates.clearAll();
        setRouteParams(mockContext, {
            kind: "home_route",
            scope: { kind: "group_chat" },
        });
    });

    describe("clearing selected chat", () => {
        test("unselected a chat and make sure id store is undefined", () => {
            routeStore.set({
                kind: "global_chat_selected_route",
                chatId: { kind: "group_chat", groupId: "123456" },
                chatType: "group_chat",
                open: false,
                scope: { kind: "group_chat" },
            });

            expect(selectedChatIdStore.value).toEqual({ kind: "group_chat", groupId: "123456" });

            routeStore.set({
                kind: "chat_list_route",
                scope: { kind: "group_chat" },
            });

            expect(selectedChatIdStore.value).toBeUndefined();
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
            setRouteParams(mockContext, {
                kind: "selected_channel_route",
                chatId,
                communityId,
                messageIndex: 0,
                open: false,
                scope: { kind: "community", id: communityId },
            });
            setSelectedChat();
        });

        test("chat list scope is set", () => {
            expect(chatListScopeStore.value).toMatchObject({ kind: "community", id: communityId });
            setRouteParams(mockContext, {
                kind: "explore_groups_route",
                scope: { kind: "group_chat" },
            });
            expect(get(chatListScopeStore)).toMatchObject({ kind: "group_chat" });
            expect(chatListScopeStore.value).toMatchObject({ kind: "group_chat" });
        });

        test("selected chat id is set", () => {
            expect(get(selectedChatIdStore)).toEqual(chatId);
            expect(selectedChatIdStore.value).toEqual(chatId);
        });

        function setChatDetails(chatId: ChatIdentifier) {
            setSelectedChat();
            selectedServerChatStore.set(
                new ChatDetailsState(
                    chatId,
                    BigInt(0),
                    new Map([
                        [
                            "user_one",
                            {
                                role: ROLE_MEMBER,
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
                    new Map(),
                    new Map(),
                    emptyRules(),
                ),
            );
            serverEventsStore.update(() => {
                return [chatMessage()];
            });
        }

        describe("setting chat details", () => {
            beforeEach(() => setChatDetails(chatId));

            test("make sure local updates are merged", () => {
                expect(get(messageFiltersStore)).toEqual([]);
                expect(get(selectedChatMembersStore).has("user_one")).toBe(true);
                const undo = localUpdates.removeChatMember(chatId, "user_one");
                expect(get(selectedChatMembersStore).has("user_one")).toBe(false);
                undo();
                expect(get(selectedChatMembersStore).has("user_one")).toBe(true);
            });

            test("make sure that all state is overwritten if the chatId *does* change", () => {
                selectedChatExpandedDeletedMessageStore.set(new Set([1, 2, 3]));
                expect(selectedChatExpandedDeletedMessageStore.value.has(3)).toBe(true);
                setChatDetails({ ...chatId, channelId: 654321 }); // reset the server state for a different chatId
                expect(selectedChatExpandedDeletedMessageStore.value.has(3)).toBe(false);
            });
        });

        describe("chat summary local updates", () => {
            const groupId: GroupChatIdentifier = { kind: "group_chat", groupId: "123456" };

            beforeEach(() => {
                initialiseGlobalState();
            });

            describe("direct chat bots", () => {
                test("bots correctly initialised", () => {
                    expect(directChatBotsStore.value.has("123456")).toBe(true);
                });

                test("install a bot works", () => {
                    localUpdates.installDirectChatBot("654321", {
                        command: {
                            chatPermissions: [],
                            communityPermissions: [],
                            messagePermissions: [],
                        },
                        autonomous: undefined,
                    });
                    expect(directChatBotsStore.value.has("654321")).toBe(true);
                    expect(directChatBotsStore.value.has("123456")).toBe(true);
                });

                test("uninstall a bot works", () => {
                    localUpdates.removeDirectChatBot("123456");
                    expect(directChatBotsStore.value.has("123456")).toBe(false);
                });
            });

            describe("last message updates", () => {
                beforeEach(() => {
                    setRouteParams(mockContext, {
                        kind: "home_route",
                        scope: { kind: "group_chat" },
                    });
                    localUpdates.addChat(groupChat("654321", chatMessage()));
                });
                test("tips", () => {
                    localUpdates.markTip(123456n, "ledger1", "user2", 123n);
                    const chat = chatSummariesStore.value.get({
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
                    expect(get(allChatsStore).get(groupId)?.membership.notificationsMuted).toEqual(
                        false,
                    );
                    localUpdates.updateNotificationsMuted(groupId, true);
                    expect(get(allChatsStore).get(groupId)?.membership.notificationsMuted).toEqual(
                        true,
                    );
                });

                test("archived", () => {
                    expect(get(allChatsStore).get(groupId)?.membership.archived).toEqual(false);
                    localUpdates.updateArchived(groupId, true);
                    expect(get(allChatsStore).get(groupId)?.membership.archived).toEqual(true);
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
                    const g = get(allChatsStore).get(groupId);
                    const s = get(allServerChatsStore).get(groupId);
                    expect(g === s).toBe(true);
                });

                test("when there are updates, the server chat is not mutated", () => {
                    localUpdates.updateChatProperties(groupId, "name updated");
                    const client = get(allChatsStore).get(groupId);
                    const server = get(allServerChatsStore).get(groupId);
                    expect(client === server).toBe(false);
                    expect(client?.kind === "group_chat" && client.name === "name updated").toBe(
                        true,
                    );
                    expect(server?.kind === "group_chat" && server.name === "group chat one").toBe(
                        true,
                    );
                });

                test("scoping works as expected", () => {
                    setRouteParams(mockContext, {
                        kind: "home_route",
                        scope: { kind: "group_chat" },
                    });
                    expect(get(allChatsStore).get(groupId)).not.toBeUndefined();
                    expect(chatSummariesStore.value.get(groupId)).not.toBeUndefined();
                    setRouteParams(mockContext, {
                        kind: "home_route",
                        scope: { kind: "direct_chat" },
                    });
                    expect(chatSummariesStore.value.get(groupId)).toBeUndefined();
                });
            });

            describe("add or remove chats", () => {
                test("remove a chat", () => {
                    localUpdates.removeChat(groupId);
                    expect(get(allChatsStore).get(groupId)).toBeUndefined();
                });
                test("add a chat", () => {
                    expect(
                        get(allChatsStore).get({ kind: "group_chat", groupId: "654321" }),
                    ).toBeUndefined();
                    localUpdates.addChat(groupChat("654321"));
                    expect(
                        get(allChatsStore).get({ kind: "group_chat", groupId: "654321" }),
                    ).not.toBeUndefined();
                });
                test("preview a chat", () => {
                    localUpdates.addGroupPreview(groupChat("654321"));
                    expect(
                        get(allChatsStore).get({ kind: "group_chat", groupId: "654321" }),
                    ).not.toBeUndefined();
                });
            });
        });

        describe("chat events", () => {
            beforeEach(() => setChatDetails(chatId));

            test("server events are returned when there are no updates", () => {
                const client = get(eventsStore)[0];
                const server = get(serverEventsStore)[0];
                expect(client === server).toBe(true);
            });

            test("server object should not be mutated if there are updates", () => {
                addToWritableMap(123456n, "whatever", translationsStore);
                const client = get(eventsStore)[0];
                const server = get(serverEventsStore)[0];
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
            setRouteParams(mockContext, {
                kind: "selected_community_route",
                communityId,
                scope: { kind: "community", id: communityId },
            });
        });

        test("selected community id is set", () => {
            expect(get(selectedCommunityIdStore)).toMatchObject(communityId);

            setRouteParams(mockContext, {
                kind: "home_route",
                scope: { kind: "group_chat" },
            });

            expect(get(selectedCommunityIdStore)).toBeUndefined();
        });

        describe("setting community details", () => {
            beforeEach(() => {
                selectedServerCommunityStore.set(
                    new CommunityDetailsState(
                        communityId,
                        BigInt(0),
                        new Map(),
                        new Map([
                            [
                                "user_one",
                                {
                                    role: ROLE_MEMBER,
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
                    ),
                );
            });

            test("local map updates - remove member", () => {
                expect(selectedCommunityMembersStore.value.has("user_one")).toBe(true);
                const undo = communityLocalUpdates.removeMember(communityId, "user_one");
                expect(selectedCommunityMembersStore.value.has("user_one")).toBe(false);
                undo();
                expect(selectedCommunityMembersStore.value.has("user_one")).toBe(true);
            });

            test("local map updates - update member", () => {
                const updated: Member = {
                    role: ROLE_ADMIN,
                    userId: "user_one",
                    displayName: "Mr One",
                    lapsed: false,
                };
                expect(selectedCommunityMembersStore.value.has("user_two")).toBe(false);
                const undo = communityLocalUpdates.updateMember(communityId, "user_one", updated);
                expect(selectedCommunityMembersStore.value.get("user_one")?.displayName).toEqual(
                    "Mr One",
                );
                undo();
                expect(selectedCommunityMembersStore.value.get("user_one")?.displayName).toEqual(
                    "User One",
                );
            });

            test("local set updates", () => {
                expect(selectedCommunityBlockedUsersStore.value.has("a")).toBe(true);
                expect(selectedCommunityBlockedUsersStore.value.has("d")).toBe(false);

                // check that local updates work and are correctly merged with server state
                const undo = communityLocalUpdates.blockUser(communityId, "d");
                expect(selectedCommunityBlockedUsersStore.value.has("d")).toBe(true);

                // undo the local update
                undo();
                expect(selectedCommunityBlockedUsersStore.value.has("d")).toBe(false);

                // try unblock
                communityLocalUpdates.unblockUser(communityId, "a");
                expect(selectedCommunityBlockedUsersStore.value.has("a")).toBe(false);
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
            serverCommunitiesStore.set(
                CommunityMap.fromList([
                    createCommunitySummary("123456", 1),
                    createCommunitySummary("654321", 2),
                ]),
            );
        });
        test("communities list", () => {
            expect(get(serverCommunitiesStore).size).toEqual(2);
        });
        test("community indexes", () => {
            const id: CommunityIdentifier = { kind: "community", communityId: "123456" };
            expect(get(communitiesStore).size).toEqual(2);
            expect(get(communitiesStore).get(id)?.membership.index).toEqual(1);
            localUpdates.updateCommunityIndex(id, 3);
            expect(get(communitiesStore).get(id)?.membership.index).toEqual(3);
        });

        test("should get the server object if there are no updates", () => {
            const server = get(serverCommunitiesStore).get({
                kind: "community",
                communityId: "123456",
            });
            const client = get(communitiesStore).get({ kind: "community", communityId: "123456" });
            expect(client === server).toBe(true);
        });

        test("should not mutate the server object if there are local updates", () => {
            const id: CommunityIdentifier = { kind: "community", communityId: "123456" };
            localUpdates.updateCommunityDisplayName(id, "Mr. OpenChat");
            const server = get(serverCommunitiesStore).get(id);
            const client = get(communitiesStore).get(id);
            expect(client === server).toBe(false);
        });

        test("community display name", () => {
            const id: CommunityIdentifier = { kind: "community", communityId: "123456" };
            expect(get(communitiesStore).get(id)?.membership.displayName).toBeUndefined();
            localUpdates.updateCommunityDisplayName(id, "Mr. OpenChat");
            expect(get(communitiesStore).get(id)?.membership.displayName).toEqual("Mr. OpenChat");
        });

        describe("pinned chats", () => {
            beforeEach(() => {
                chatDetailsLocalUpdates.clearAll();
                serverPinnedChatsStore.set(
                    new Map([
                        [
                            "direct_chat",
                            [
                                { kind: "direct_chat", userId: "123456" },
                                { kind: "direct_chat", userId: "888888" },
                            ],
                        ],
                        ["group_chat", [{ kind: "direct_chat", userId: "654321" }]],
                    ]),
                );
            });

            test("add a pinned chat", () => {
                const chatId: ChatIdentifier = { kind: "direct_chat", userId: "7777777" };
                localUpdates.pinToScope(chatId, "favourite");
                const favs = get(pinnedChatsStore).get("favourite");
                expect(favs).not.toBeUndefined();
                expect(favs?.length).toEqual(1);
                expect(favs?.[0]).toEqual(chatId);
            });

            test("added chat goes first", () => {
                const chatId: ChatIdentifier = { kind: "direct_chat", userId: "7777777" };
                localUpdates.pinToScope(chatId, "direct_chat");
                const directs = get(pinnedChatsStore).get("direct_chat");
                expect(directs).not.toBeUndefined();
                expect(directs?.length).toEqual(3);
                expect(directs?.[0]).toEqual(chatId);
            });

            test("remove pinned chat", () => {
                const chatId: ChatIdentifier = { kind: "direct_chat", userId: "123456" };
                localUpdates.unpinFromScope(chatId, "direct_chat");
                const directs = get(pinnedChatsStore).get("direct_chat");
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
            role: ROLE_OWNER,
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
    };
}

const defaultPermissions: CommunityPermissions = {
    changeRoles: ROLE_ADMIN,
    updateDetails: ROLE_ADMIN,
    inviteUsers: ROLE_ADMIN,
    removeMembers: ROLE_ADMIN,
    createPublicChannel: ROLE_ADMIN,
    createPrivateChannel: ROLE_ADMIN,
    manageUserGroups: ROLE_ADMIN,
};

function initialiseGlobalState() {
    OpenChat.setGlobalStateStores(
        [],
        [groupChat("123456")],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
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
                {
                    command: {
                        chatPermissions: [],
                        messagePermissions: ["text"],
                        communityPermissions: [],
                    },
                    autonomous: undefined,
                },
            ],
        ]),
        undefined,
        new Set(),
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
            changeRoles: ROLE_ADMIN,
            removeMembers: ROLE_MODERATOR,
            deleteMessages: ROLE_MODERATOR,
            updateGroup: ROLE_ADMIN,
            pinMessages: ROLE_ADMIN,
            inviteUsers: ROLE_ADMIN,
            addMembers: ROLE_ADMIN,
            mentionAllMembers: ROLE_MEMBER,
            reactToMessages: ROLE_MEMBER,
            startVideoCall: ROLE_MEMBER,
            messagePermissions: {
                default: ROLE_MEMBER,
                p2pSwap: ROLE_NONE,
            },
            threadPermissions: undefined,
        },
        gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
        level: "group",
        membership: {
            ...nullMembership(),
            role: ROLE_OWNER,
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
    };
}

function groupChatExpectation(id: GroupChatIdentifier, fn: (g: GroupChatSummary) => void) {
    const g = get(allChatsStore).get(id);
    if (g && g.kind === "group_chat") {
        fn(g);
    } else {
        fail("Could not find expected group chat");
    }
}

function chitState() {
    return {
        streak: 10,
        maxStreak: 10,
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

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
} from "@shared";
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
    cryptoBalanceStore,
    allServerChatsStore,
    chatListScopeStore,
    chatSummariesListStore,
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
            scope: { kind: "chats" },
        });
    });

    describe("clearing selected chat", () => {
        test("unselected a chat and make sure id store is undefined", () => {
            routeStore.set({
                kind: "global_chat_selected_route",
                chatId: { kind: "group_chat", groupId: "123456" },
                chatType: "group_chat",
                open: false,
                scope: { kind: "chats" },
            });

            expect(selectedChatIdStore.value).toEqual({ kind: "group_chat", groupId: "123456" });

            routeStore.set({
                kind: "chat_list_route",
                scope: { kind: "chats" },
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
                scope: { kind: "chats" },
            });
            expect(get(chatListScopeStore)).toMatchObject({ kind: "chats" });
            expect(chatListScopeStore.value).toMatchObject({ kind: "chats" });
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
                        scope: { kind: "chats" },
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
                    localUpdates.updateNotificationsMuted(groupId, true, undefined);
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

                test("undoing a local update restores the server chat values", () => {
                    const server = get(allServerChatsStore).get(groupId);
                    const undo = localUpdates.updateChatProperties(groupId, "name updated");
                    groupChatExpectation(groupId, (g) => expect(g.name).toEqual("name updated"));
                    undo();
                    groupChatExpectation(groupId, (g) => {
                        expect(g.name).toEqual("group chat one");
                        expect(g.membership).toEqual(server?.membership);
                    });
                    // once every local update has been undone the server chat is returned as-is
                    expect(get(allChatsStore).get(groupId) === server).toBe(true);
                });

                test("undoing a latest message update restores the server chat values", () => {
                    const server = get(allServerChatsStore).get(groupId);
                    const undo = localUpdates.updateLatestMessage(groupId, chatMessage());
                    expect(get(allChatsStore).get(groupId)?.latestMessage).not.toBeUndefined();
                    undo();
                    const client = get(allChatsStore).get(groupId);
                    expect(client?.latestMessage).toBeUndefined();
                    expect(client?.latestEventIndex).toEqual(server?.latestEventIndex);
                    expect(client?.membership).toEqual(server?.membership);
                    expect(client === server).toBe(true);
                });

                test("a local update does not mutate the server chat's membership", () => {
                    const server = get(allServerChatsStore).get(groupId);
                    localUpdates.updateNotificationsMuted(groupId, true, true);
                    const client = get(allChatsStore).get(groupId);
                    expect(client?.membership.notificationsMuted).toBe(true);
                    expect(client?.membership.atEveryoneMuted).toBe(true);
                    expect(server?.membership.notificationsMuted).toBe(false);
                    expect(server?.membership.atEveryoneMuted).toBe(false);
                    expect(client?.membership === server?.membership).toBe(false);
                });

                test("local updates to permissions and gate do not mutate the server chat", () => {
                    const server = get(allServerChatsStore).get(groupId);
                    localUpdates.updateChatProperties(
                        groupId,
                        undefined,
                        undefined,
                        { changeRoles: ROLE_OWNER },
                        { gate: { kind: "diamond_gate" }, expiry: undefined },
                    );
                    const client = get(allChatsStore).get(groupId);
                    if (client?.kind !== "group_chat" || server?.kind !== "group_chat") {
                        fail("expected group chats");
                    }
                    expect(client.permissions.changeRoles).toEqual(ROLE_OWNER);
                    expect(server.permissions.changeRoles).toEqual(ROLE_ADMIN);
                    expect(client.gateConfig.gate.kind).toEqual("diamond_gate");
                    expect(server.gateConfig.gate.kind).toEqual("no_gate");
                });

                test("scoping works as expected", () => {
                    setRouteParams(mockContext, {
                        kind: "home_route",
                        scope: { kind: "chats" },
                    });
                    expect(get(allChatsStore).get(groupId)).not.toBeUndefined();
                    expect(chatSummariesStore.value.get(groupId)).not.toBeUndefined();
                    setRouteParams(mockContext, {
                        kind: "home_route",
                        scope: { kind: "favourite" },
                    });
                    expect(chatSummariesStore.value.get(groupId)).toBeUndefined();
                });
            });

            describe("chat summaries list", () => {
                const a: GroupChatIdentifier = { kind: "group_chat", groupId: "a" };
                const b: GroupChatIdentifier = { kind: "group_chat", groupId: "b" };
                const c: GroupChatIdentifier = { kind: "group_chat", groupId: "c" };

                beforeEach(() => {
                    chatDetailsLocalUpdates.clearAll();
                    setRouteParams(mockContext, {
                        kind: "home_route",
                        scope: { kind: "chats" },
                    });
                    localUpdates.addChat({ ...groupChat("a"), eventsTtlLastUpdated: 10n });
                    localUpdates.addChat({ ...groupChat("b"), eventsTtlLastUpdated: 30n });
                    localUpdates.addChat({ ...groupChat("c"), eventsTtlLastUpdated: 20n });
                });

                test("unpinned chats are sorted by display date descending", () => {
                    serverPinnedChatsStore.set(new Map());
                    const ids = get(chatSummariesListStore).map((c) => c.id);
                    expect(ids).toEqual([b, c, a, groupId]);
                });

                test("pinned chats come first in pinned order, then the rest by date", () => {
                    serverPinnedChatsStore.set(
                        new Map([["chats", [a, { kind: "group_chat", groupId: "missing" }, c]]]),
                    );
                    const ids = get(chatSummariesListStore).map((c) => c.id);
                    expect(ids).toEqual([a, c, b, groupId]);
                });

                test("pins in another scope are ignored", () => {
                    serverPinnedChatsStore.set(new Map([["favourite", [a]]]));
                    const ids = get(chatSummariesListStore).map((c) => c.id);
                    expect(ids).toEqual([b, c, a, groupId]);
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
                scope: { kind: "chats" },
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

        test("local updates only change the membership of the client copy", () => {
            const id: CommunityIdentifier = { kind: "community", communityId: "123456" };
            localUpdates.updateCommunityIndex(id, 7);
            localUpdates.updateCommunityDisplayName(id, "Mr. OpenChat");
            localUpdates.updateCommunityRulesAccepted(id, true);
            const server = get(serverCommunitiesStore).get(id);
            const client = get(communitiesStore).get(id);
            expect(client?.membership).toEqual({
                ...server?.membership,
                index: 7,
                displayName: "Mr. OpenChat",
                rulesAccepted: true,
            });
            expect(server?.membership.index).toEqual(1);
            expect(server?.membership.displayName).toBeUndefined();
            expect(server?.membership.rulesAccepted).toBe(false);
            expect(client?.membership === server?.membership).toBe(false);
            expect({ ...client, membership: undefined }).toEqual({
                ...server,
                membership: undefined,
            });
            // everything other than membership is shared with the server object
            expect(client?.channels === server?.channels).toBe(true);
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
                            "chats",
                            [
                                { kind: "direct_chat", userId: "123456" },
                                { kind: "direct_chat", userId: "888888" },
                                { kind: "direct_chat", userId: "654321" },
                            ],
                        ],
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
                localUpdates.pinToScope(chatId, "chats");
                const directs = get(pinnedChatsStore).get("chats");
                expect(directs).not.toBeUndefined();
                expect(directs?.length).toEqual(4);
                expect(directs?.[0]).toEqual(chatId);
            });

            test("remove pinned chat", () => {
                const chatId: ChatIdentifier = { kind: "direct_chat", userId: "123456" };
                localUpdates.unpinFromScope(chatId, "chats");
                const directs = get(pinnedChatsStore).get("chats");
                expect(directs).not.toBeUndefined();
                expect(directs?.length).toEqual(2);
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
        moderationFlags: 0,
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
            ogPreviews: [],
            messagePreviews: [],
        },
    };
}

describe("cryptoBalanceStore", () => {
    test("setBalance only publishes when the balance changes", () => {
        let publishes = 0;
        const unsub = cryptoBalanceStore.subscribe(() => publishes++);
        publishes = 0;
        cryptoBalanceStore.setBalance("ledger1", 100n);
        expect(publishes).toBe(1);
        cryptoBalanceStore.setBalance("ledger1", 100n);
        expect(publishes).toBe(1);
        cryptoBalanceStore.setBalance("ledger1", 200n);
        expect(publishes).toBe(2);
        expect(cryptoBalanceStore.value.get("ledger1")).toBe(200n);
        expect(cryptoBalanceStore.valueIfUpdatedRecently("ledger1")).toBe(200n);
        unsub();
    });
});

import {
    CommunityMap,
    emptyChatMetrics,
    emptyRules,
    SafeMap,
    type ChatIdentifier,
    type CommunityIdentifier,
    type CommunityPermissions,
    type CommunitySummary,
    type ExternalBotPermissions,
    type Member,
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
        });

        test("selected message context is set", () => {
            expect(app.selectedMessageContext).toMatchObject({
                chatId: chatId,
                threadRootMessageIndex: undefined,
            });

            pathState.setRouteParams(mockContext, {
                kind: "selected_channel_route",
                chatId,
                communityId,
                messageIndex: 10,
                open: true, // simulate opening the thread
                scope: { kind: "community", id: communityId },
            });

            expect(app.selectedMessageContext).toMatchObject({
                chatId: chatId,
                threadRootMessageIndex: 10,
            });
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
                [],
            );
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
    });

    describe("community state", () => {
        const communityId: CommunityIdentifier = { kind: "community", communityId: "123456" };
        beforeEach(() => {
            pathState.setRouteParams(mockContext, {
                kind: "selected_community_route",
                communityId,
                scope: { kind: "community", id: communityId },
            });
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

        describe("direct chat bots", () => {
            beforeEach(() => {
                app.directChatBots = someBots([
                    [
                        "123456",
                        { chatPermissions: [], communityPermissions: [], messagePermissions: [] },
                    ],
                ]);
            });

            test("install a bot works", () => {
                localUpdates.installDirectChatBot("654321", {
                    chatPermissions: [],
                    communityPermissions: [],
                    messagePermissions: [],
                });
                expect(app.directChatBots.has("654321")).toBe(true);
            });

            test("uninstall a bot works", () => {
                localUpdates.removeDirectChatBot("123456");
                expect(app.directChatBots.has("123456")).toBe(false);
            });
        });
    });
});

function someBots(
    entries: [[string, ExternalBotPermissions]],
): SafeMap<string, ExternalBotPermissions> {
    const m = new Map<string, ExternalBotPermissions>(entries);
    return SafeMap.fromEntries(m.entries());
}

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

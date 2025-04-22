import {
    emptyRules,
    type ChatIdentifier,
    type CommunityIdentifier,
    type Member,
} from "openchat-shared";
import { vi } from "vitest";
import { app } from "./app.svelte";
import { chatDetailsLocalUpdates } from "./chat_details";
import { communityLocalUpdates } from "./community_details/local.svelte";
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
            );
        }

        describe("setting chat details", () => {
            beforeEach(() => setChatDetails(chatId));

            test("make sure local updates are merged", () => {
                expect(app.selectedChat.members.has("user_one")).toBe(true);
                const undo = chatDetailsLocalUpdates.removeMember(chatId, "user_one");
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
});

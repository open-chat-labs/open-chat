import type { CommunityIdentifier, Member } from "openchat-shared";
import { vi } from "vitest";
import { app } from "./app.svelte";
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

import type { CommunityIdentifier } from "openchat-shared";
import { vi } from "vitest";
import { app } from "./app.svelte";
import { communityLocalUpdates } from "./community.svelte";
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

        test("setting community details", () => {
            app.setSelectedCommunityDetails(
                communityId,
                new Map(),
                new Map(),
                new Set(["a", "b", "c"]),
                new Set(),
                new Set(),
                new Set(),
                new Map(),
                new Map(),
            );
            expect(app.selectedCommunityDetails.blockedUsers.has("a")).toBe(true);
            expect(app.selectedCommunityDetails.blockedUsers.has("d")).toBe(false);

            console.log("before local update");
            communityLocalUpdates.blockUser(communityId, "d");
            console.log("after local update");

            // this doesn't fucking work
            expect(app.selectedCommunityDetails.blockedUsers.has("d")).toBe(true);
        });
    });
});

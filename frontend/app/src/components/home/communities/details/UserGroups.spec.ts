import { flushSync, mount, unmount } from "svelte";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// A store the client package builds at import time reads the screen width through matchMedia,
// and the search results sit in a virtual list which sizes itself from the layout, none of
// which jsdom provides; stub them before the component (and so the client) is imported
vi.hoisted(() => {
    window.matchMedia = ((query: string) =>
        ({
            matches: false,
            media: query,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            onchange: null,
            dispatchEvent: () => false,
        }) as unknown as MediaQueryList) as typeof window.matchMedia;
    window.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    } as unknown as typeof ResizeObserver;
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
        configurable: true,
        get: () => 80,
    });
});

import {
    allUsersStore,
    ErrorCode,
    localUpdates,
    ROLE_MEMBER,
    selectedServerCommunityStore,
    type CommunityIdentifier,
    type CommunitySummary,
    type Member,
    type OpenChat,
    type UpdateUserGroupResponse,
    type UserGroupDetails,
    type UserSummary,
} from "@client";
import { CommunityDetailsState } from "@client/state/community/server";
import UserGroups from "./UserGroups.svelte";

const communityId: CommunityIdentifier = { kind: "community", communityId: "community" };
const community = { id: communityId } as CommunitySummary;
const GROUP_ID = 1;
const USER_IDS = ["alice", "bob", "carol"];

function user(userId: string): UserSummary {
    return {
        kind: "user",
        userId,
        username: userId,
        displayName: undefined,
        updated: 0n,
        suspended: false,
        diamondStatus: "inactive",
        chitBalance: 0,
        totalChitEarned: 0,
        streak: 0,
        maxStreak: 0,
        isUniquePerson: false,
        hideOnlineStatus: false,
    };
}

function member(userId: string): Member {
    return { role: ROLE_MEMBER, userId, displayName: undefined, lapsed: false };
}

// The members of the group as the store holds them, which is what the list shows once any
// local updates have been applied
function serverMembers(): string[] {
    const group = selectedServerCommunityStore.value?.userGroups.get(GROUP_ID);
    return [...(group?.members ?? [])].sort();
}

type UpdateUserGroup = OpenChat["updateUserGroup"];

// `updateUserGroup` answers with whatever the test says the canister said, and on success
// records the local update just as `OpenChat.updateUserGroup` does
function fakeClient(response: UpdateUserGroupResponse) {
    const updateUserGroup = vi.fn<UpdateUserGroup>(async (id, userGroup) => {
        if (response.kind === "success") {
            localUpdates.addOrUpdateUserGroup(id, userGroup);
        }
        return response;
    });
    const known: Record<string, unknown> = {
        canManageUserGroups: () => true,
        getDisplayName: (userId: string) => userId,
        userAvatarUrl: () => "",
        updateUserGroup,
    };
    const client = new Proxy(known, {
        get: (target, prop) =>
            typeof prop === "symbol"
                ? undefined
                : prop in target
                  ? target[prop]
                  : () => Promise.resolve(undefined),
    }) as unknown as OpenChat;
    return { client, updateUserGroup };
}

describe("desktop user groups", () => {
    let app: ReturnType<typeof mount> | undefined;
    let target: HTMLElement;

    beforeEach(() => {
        allUsersStore.set(new Map(USER_IDS.map((u) => [u, user(u)])));
        selectedServerCommunityStore.set(
            new CommunityDetailsState(
                communityId,
                0n,
                new Map<number, UserGroupDetails>([
                    [
                        GROUP_ID,
                        {
                            kind: "user_group",
                            id: GROUP_ID,
                            name: "devs",
                            members: new Set(["alice", "bob"]),
                        },
                    ],
                ]),
                new Map(USER_IDS.map((u) => [u, member(u)])),
                new Set(),
                new Set(),
                new Set(),
                new Set(),
                new Map(),
            ),
        );
    });

    afterEach(() => {
        if (app !== undefined) unmount(app);
        app = undefined;
        document.body.innerHTML = "";
        localUpdates.clearAll();
        selectedServerCommunityStore.set(undefined);
    });

    function render(client: OpenChat) {
        target = document.createElement("div");
        document.body.appendChild(target);
        app = mount(UserGroups, {
            target,
            props: { community },
            context: new Map<string, unknown>([["client", client]]),
        });
        flushSync();
    }

    async function settle() {
        // lets the virtual list measure and render its rows, and a save's promise resolve
        for (let i = 0; i < 5; i++) {
            await new Promise((r) => setTimeout(r, 0));
            flushSync();
        }
    }

    function click(selector: string) {
        const el = target.querySelector(selector);
        expect(el, selector).not.toBeNull();
        el!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        flushSync();
    }

    // The number of members the list shows against the group
    function listedMemberCount(): string | undefined {
        return target.querySelector(".user-group-card .members .num")?.textContent?.trim();
    }

    // The usernames the editor shows as the group's members
    function editedMembers(): string[] {
        return [...target.querySelectorAll(".user-group .users .user .username")]
            .map((u) => u.textContent?.trim() ?? "")
            .sort();
    }

    function editing(): boolean {
        return target.querySelector(".user-group .buttons") !== null;
    }

    // Opens the group's editor, removes alice from it and adds carol to it
    async function editMembers() {
        click(".user-group-card .edit");
        expect(editedMembers()).toEqual(["@alice", "@bob"]);

        click(".user-group .users .user .delete");

        const search = target.querySelector(".user-group .search input") as HTMLInputElement;
        search.value = "car";
        search.dispatchEvent(new Event("input", { bubbles: true }));
        flushSync();
        await settle();
        click(".user-group .searched-users .member");

        expect(editedMembers()).toEqual(["@bob", "@carol"]);
    }

    test("cancelling an edit leaves the group's members as they were", async () => {
        render(fakeClient({ kind: "success" }).client);
        expect(listedMemberCount()).toEqual("2");

        await editMembers();
        expect(serverMembers()).toEqual(["alice", "bob"]);

        click(".user-group .buttons button:first-child");

        expect(editing()).toBe(false);
        expect(listedMemberCount()).toEqual("2");
        expect(serverMembers()).toEqual(["alice", "bob"]);

        // and the editor starts again from the group's real members
        click(".user-group-card .edit");
        expect(editedMembers()).toEqual(["@alice", "@bob"]);
    });

    test("a refused save leaves the group's members as they were", async () => {
        const { client, updateUserGroup } = fakeClient({
            kind: "error",
            code: ErrorCode.TooManyUsers,
            message: undefined,
        });
        render(client);

        await editMembers();
        click(".user-group .buttons button:last-child");
        await settle();

        expect(updateUserGroup).toHaveBeenCalledTimes(1);
        // the editor stays open on what was entered so that it can be corrected
        expect(editing()).toBe(true);
        expect(editedMembers()).toEqual(["@bob", "@carol"]);
        expect(serverMembers()).toEqual(["alice", "bob"]);

        click(".user-group .buttons button:first-child");

        expect(listedMemberCount()).toEqual("2");
        expect(serverMembers()).toEqual(["alice", "bob"]);
    });

    test("a save sends the changes, and the list shows them once it succeeds", async () => {
        const { client, updateUserGroup } = fakeClient({ kind: "success" });
        render(client);

        await editMembers();
        click(".user-group .buttons button:last-child");
        await settle();

        expect(updateUserGroup).toHaveBeenCalledTimes(1);
        const [id, userGroup, added, removed] = updateUserGroup.mock.calls[0];
        expect(id).toEqual(communityId);
        expect(userGroup.id).toEqual(GROUP_ID);
        expect(userGroup.name).toEqual("devs");
        expect([...userGroup.members].sort()).toEqual(["bob", "carol"]);
        expect([...added]).toEqual(["carol"]);
        expect([...removed]).toEqual(["alice"]);

        expect(editing()).toBe(false);
        expect(listedMemberCount()).toEqual("2");
        click(".user-group-card .edit");
        expect(editedMembers()).toEqual(["@bob", "@carol"]);

        // the list shows the local update until the community details are next loaded; what
        // the store holds for the group only changes then
        expect(serverMembers()).toEqual(["alice", "bob"]);
    });
});

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
const NEW_GROUP_ID = 2;
const USER_IDS = ["alice", "bob", "carol", "dave"];

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

// The members of the group as the store holds them, before any local updates are applied
function serverMembers(): string[] {
    const group = selectedServerCommunityStore.value?.userGroups.get(GROUP_ID);
    return [...(group?.members ?? [])].sort();
}

// `updateUserGroup` answers with whatever the test says the canister said. A successful
// create or update records the local update just as the real client does.
function fakeClient(updateResponse: UpdateUserGroupResponse = { kind: "success" }) {
    const updateUserGroup = vi.fn<OpenChat["updateUserGroup"]>(async (id, userGroup) => {
        if (updateResponse.kind === "success") {
            localUpdates.addOrUpdateUserGroup(id, userGroup);
        }
        return updateResponse;
    });
    const createUserGroup = vi.fn<OpenChat["createUserGroup"]>(async (id, userGroup) => {
        localUpdates.addOrUpdateUserGroup(id, { ...userGroup, id: NEW_GROUP_ID });
        return { kind: "success", userGroupId: NEW_GROUP_ID };
    });
    const known: Record<string, unknown> = {
        canManageUserGroups: () => true,
        getDisplayName: (userId: string) => userId,
        userAvatarUrl: () => "",
        updateUserGroup,
        createUserGroup,
    };
    const client = new Proxy(known, {
        get: (target, prop) =>
            typeof prop === "symbol"
                ? undefined
                : prop in target
                  ? target[prop]
                  : () => Promise.resolve(undefined),
    }) as unknown as OpenChat;
    return { client, updateUserGroup, createUserGroup };
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

    function click(selector: string, within: Element = target) {
        const el = within.querySelector(selector);
        expect(el, selector).not.toBeNull();
        el!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        flushSync();
    }

    function type(selector: string, text: string) {
        const input = target.querySelector(selector) as HTMLInputElement | null;
        expect(input, selector).not.toBeNull();
        input!.value = text;
        input!.dispatchEvent(new Event("input", { bubbles: true }));
        flushSync();
    }

    // The number of members the list shows against each group, by the group's name
    function listed(): Record<string, string> {
        return Object.fromEntries(
            [...target.querySelectorAll(".user-group-card")].map((card) => [
                card.querySelector(".name-text")?.textContent?.trim(),
                card.querySelector(".members .num")?.textContent?.trim(),
            ]),
        );
    }

    function editedUsers(): Element[] {
        return [...target.querySelectorAll(".user-group .users .user")];
    }

    const username = (el: Element) => el.querySelector(".username")?.textContent?.trim() ?? "";

    // The usernames the editor shows as the group's members
    function editedMembers(): string[] {
        return editedUsers().map(username).sort();
    }

    function editing(): boolean {
        return target.querySelector(".user-group .buttons") !== null;
    }

    const cancel = () => click(".user-group .buttons button:first-child");

    async function save() {
        click(".user-group .buttons button:last-child");
        await settle();
    }

    function removeMember(userId: string) {
        const row = editedUsers().find((u) => username(u) === `@${userId}`);
        expect(row, userId).toBeDefined();
        click(".delete", row);
    }

    async function addMember(userId: string) {
        type(".user-group .search input", userId.slice(0, 3));
        await settle();
        click(".user-group .searched-users .member");
    }

    // Opens the group's editor, removes alice from it and adds carol and dave to it
    async function editMembers() {
        click(".user-group-card .edit");
        removeMember("alice");
        await addMember("carol");
        await addMember("dave");
    }

    test("the editor shows the members as they are added and removed", async () => {
        render(fakeClient().client);

        click(".user-group-card .edit");
        expect(editedMembers()).toEqual(["@alice", "@bob"]);

        removeMember("alice");
        expect(editedMembers()).toEqual(["@bob"]);

        await addMember("carol");
        expect(editedMembers()).toEqual(["@bob", "@carol"]);
    });

    test("cancelling an edit leaves the group's members as they were", async () => {
        render(fakeClient().client);
        expect(listed()).toEqual({ devs: "2" });

        await editMembers();
        cancel();

        expect(editing()).toBe(false);
        expect(listed()).toEqual({ devs: "2" });
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
        await save();

        expect(updateUserGroup).toHaveBeenCalledTimes(1);
        // the editor stays open on what was entered so that it can be corrected
        expect(editing()).toBe(true);
        expect(editedMembers()).toEqual(["@bob", "@carol", "@dave"]);
        expect(serverMembers()).toEqual(["alice", "bob"]);

        cancel();

        expect(listed()).toEqual({ devs: "2" });
        expect(serverMembers()).toEqual(["alice", "bob"]);
    });

    test("a save sends the changes, and the list shows them once it succeeds", async () => {
        const { client, updateUserGroup } = fakeClient();
        render(client);

        await editMembers();
        await save();

        expect(updateUserGroup).toHaveBeenCalledTimes(1);
        const [id, userGroup, added, removed] = updateUserGroup.mock.calls[0];
        expect(id).toEqual(communityId);
        expect(userGroup.id).toEqual(GROUP_ID);
        expect(userGroup.name).toEqual("devs");
        expect([...userGroup.members].sort()).toEqual(["bob", "carol", "dave"]);
        expect([...added].sort()).toEqual(["carol", "dave"]);
        expect([...removed]).toEqual(["alice"]);

        // the list shows the local update until the community details are next loaded; what
        // the store holds for the group only changes then
        expect(editing()).toBe(false);
        expect(listed()).toEqual({ devs: "3" });
        expect(serverMembers()).toEqual(["alice", "bob"]);

        // the saved members are in turn left alone by an edit which is then cancelled
        click(".user-group-card .edit");
        expect(editedMembers()).toEqual(["@bob", "@carol", "@dave"]);
        removeMember("bob");
        cancel();

        expect(listed()).toEqual({ devs: "3" });
        click(".user-group-card .edit");
        expect(editedMembers()).toEqual(["@bob", "@carol", "@dave"]);
    });

    test("a new group is sent with its members, and is listed once it is created", async () => {
        const { client, createUserGroup } = fakeClient();
        render(client);

        click(".user-groups .add [role='button']");
        type(".user-group .header input", "ops");
        await addMember("carol");
        await addMember("dave");
        removeMember("dave");
        await save();

        expect(createUserGroup).toHaveBeenCalledTimes(1);
        const [id, userGroup] = createUserGroup.mock.calls[0];
        expect(id).toEqual(communityId);
        expect(userGroup.name).toEqual("ops");
        expect([...userGroup.members]).toEqual(["carol"]);

        expect(editing()).toBe(false);
        expect(listed()).toEqual({ devs: "2", ops: "1" });
    });
});

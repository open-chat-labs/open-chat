import {
    selectedChatBlockedUsersStore,
    selectedChatBotsStore,
    selectedChatInvitedUsersStore,
    selectedChatLapsedMembersStore,
    selectedChatMembersStore,
    selectedChatWebhooksStore,
    ROLE_ADMIN,
    ROLE_MEMBER,
    type CommunitySummary,
    type MemberRole,
    type MultiUserChat,
    type OpenChat,
} from "@client";
import { flushSync, tick } from "svelte";
import { afterEach, expect, test, vi } from "vitest";
import { MemberManagement } from "./memberManagement.svelte";

afterEach(() => vi.restoreAllMocks());

// One is built each time a members, invite or group details page opens, so one that kept its
// subscriptions after the page closed would keep updating for the rest of the session
test("a MemberManagement holds no store subscription once nothing renders it", async () => {
    const stores = [
        selectedChatMembersStore,
        selectedChatLapsedMembersStore,
        selectedChatBlockedUsersStore,
        selectedChatInvitedUsersStore,
        selectedChatBotsStore,
        selectedChatWebhooksStore,
    ];
    let live = 0;
    for (const store of stores) {
        // A derived store's `.value` keeps one subscription of its own, once per store
        void store.value;
        const subscribe = store.subscribe.bind(store as never);
        vi.spyOn(store, "subscribe").mockImplementation(((
            run: (value: unknown) => void,
            invalidate?: () => void,
        ) => {
            live++;
            const unsubscribe = subscribe(run as never, invalidate);
            return () => {
                live--;
                unsubscribe();
            };
        }) as never);
    }

    const membersState = new MemberManagement(
        {} as OpenChat,
        {
            kind: "group_chat",
            id: { kind: "group_chat", groupId: "bbbbb-bb" },
        } as MultiUserChat,
    );
    let rendered = 0;
    const stop = $effect.root(() => {
        $effect(() => {
            rendered =
                membersState.members.size +
                membersState.lapsed.size +
                membersState.blocked.size +
                membersState.invited.size +
                membersState.bots.size +
                membersState.webhooks.size;
        });
    });
    flushSync();
    expect(rendered).toBe(0);
    expect(live).toBe(stores.length);

    stop();
    // createSubscriber lets go of the store a microtask after the last reader goes
    await tick();
    expect(live).toBe(0);
});

// 4a invariant 6: a failed role change, removal, block or unblock gives its failure ResourceKey
test("each failed member action gives its failure message, and a community's go to the community", async () => {
    const formatter = (id: string) => id;
    const failingClient = {
        changeRole: async () => false,
        removeMember: async () => ({ kind: "not_authorized" }),
        blockUser: async () => false,
        unblockUser: async () => false,
        changeCommunityRole: async () => false,
        removeCommunityMember: async () => {
            throw new Error("offline");
        },
        blockCommunityUser: async () => false,
        unblockCommunityUser: async () => false,
        logError: () => undefined,
    } as never;
    const group = {
        kind: "group_chat",
        id: { kind: "group_chat", groupId: "bbbbb-bb" },
    } as MultiUserChat;
    const community = {
        kind: "community",
        id: { kind: "community", communityId: "ccccc-cc" },
    } as CommunitySummary;
    const roleChange: { userId: string; newRole: MemberRole; oldRole: MemberRole } = {
        userId: "u",
        newRole: ROLE_ADMIN,
        oldRole: ROLE_MEMBER,
    };

    for (const collection of [group, community]) {
        const members = new MemberManagement(failingClient, collection);
        expect(await members.changeRole(roleChange, formatter)).toMatchObject({
            kind: "failed",
            message: { key: "promoteFailed" },
        });
        expect(await members.removeMember("u")).toMatchObject({
            kind: "failed",
            message: { key: "removeMemberFailed" },
        });
        expect(await members.blockUser("u")).toMatchObject({
            kind: "failed",
            message: { key: "blockUserFailed" },
        });
        expect(await members.unblockUser("u")).toMatchObject({
            kind: "failed",
            message: { key: "unblockUserFailed" },
        });
    }

    const blockCommunityUser = vi.fn(async () => true);
    const blockUser = vi.fn(async () => true);
    const members = new MemberManagement({ blockCommunityUser, blockUser } as never, community);
    expect(await members.blockUser("u")).toMatchObject({ kind: "success" });
    expect(blockCommunityUser).toHaveBeenCalledWith(community.id, "u");
    expect(blockUser).not.toHaveBeenCalled();
});

// 4b invariant 3: a failed invite or add gives its failure ResourceKey, and a partial add says so
test("a failed invite or add to a channel gives its failure message", async () => {
    const channel = {
        kind: "channel",
        id: { kind: "channel", communityId: "ccccc-cc", channelId: 1 },
        level: "channel",
        public: false,
    } as MultiUserChat;
    const outcomes = (add: unknown) =>
        new MemberManagement(
            {
                inviteUsers: async () => false,
                addMembersToChannel: async () => add,
            } as never,
            channel,
        );

    expect(await outcomes({}).inviteUsers(["u"])).toMatchObject({
        kind: "failed",
        message: { key: "group.inviteUsersFailed" },
    });
    expect(await outcomes({ kind: "add_to_channel_failed" }).addUsers(["u"])).toMatchObject({
        kind: "failed",
        message: { key: "group.addMembersFailed" },
    });
    expect(
        await outcomes({ kind: "add_to_channel_partial_success" }).addUsers(["u", "v"]),
    ).toMatchObject({ kind: "success", message: { key: "group.addMembersPartialSuccess" } });
});

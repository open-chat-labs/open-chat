import {
    emptyRules,
    localUpdates,
    routeStore,
    selectedChatIdStore,
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
    type UserSummary,
} from "@client";
import { ChatDetailsState } from "@client/state/chat/serverDetails";
import { currentChatVisit, startChatVisit } from "@client/state/selectedChat";
import { flushSync, tick } from "svelte";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { InviteWay } from "./invitePeople";
import { MemberManagement, searchToInvite } from "./memberManagement.svelte";

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
        await outcomes({
            kind: "add_to_channel_partial_success",
            usersAdded: ["u"],
            usersAlreadyInChannel: [],
        }).addUsers(["u", "v"]),
    ).toMatchObject({ kind: "success", message: { key: "group.addMembersPartialSuccess" } });
});

// the users the dialog picked are the ones sent (the old pages' own picks are empty there)
test("an invite or add sends the users it's given", async () => {
    const channel = {
        kind: "channel",
        id: { kind: "channel", communityId: "ccccc-cc", channelId: 1 },
        level: "channel",
    } as MultiUserChat;
    const inviteUsers = vi.fn(async () => true);
    const addMembersToChannel = vi.fn(async () => ({ kind: "success" }));
    const members = new MemberManagement({ inviteUsers, addMembersToChannel } as never, channel);

    await members.inviteUsers(["u"]);
    await members.addUsers(["u", "v"]);

    expect(inviteUsers).toHaveBeenCalledWith(channel.id, ["u"]);
    expect(addMembersToChannel).toHaveBeenCalledWith(channel.id, ["u", "v"]);
});

// the native Invite people screen sends its picks in one go: a private community's members added to
// the channel, the others invited
describe("sending the picks", () => {
    const channel = {
        kind: "channel",
        id: { kind: "channel", communityId: "ccccc-cc", channelId: 1 },
        level: "channel",
        public: false,
    } as MultiUserChat;
    const user = (userId: string) => ({ userId, username: userId }) as UserSummary;
    const picked = (members: MemberManagement) => members.usersToAddOrInvite.map((u) => u.userId);
    // "a" is added, "x" was invited elsewhere since being picked, the others are invited
    const way = (id: string): InviteWay => (id === "a" ? "add" : id === "x" ? "invited" : "invite");

    function picking(client: object, ...userIds: string[]): MemberManagement {
        const members = new MemberManagement(client as never, channel);
        userIds.forEach((id) => members.togglePicked(user(id)));
        return members;
    }

    test("with no one left to send, nothing goes and it says so", async () => {
        const inviteUsers = vi.fn(async () => true);
        const addMembersToChannel = vi.fn(async () => ({ kind: "success" }));
        const members = picking({ inviteUsers, addMembersToChannel }, "x");

        expect(await members.sendPicked(way)).toEqual({ kind: "none_left" });
        expect(inviteUsers).not.toHaveBeenCalled();
        expect(addMembersToChannel).not.toHaveBeenCalled();
        expect(picked(members)).toEqual([]);
    });

    test("adds those it names and invites the rest", async () => {
        const inviteUsers = vi.fn(async () => true);
        const addMembersToChannel = vi.fn(async () => ({ kind: "success" }));
        const members = picking({ inviteUsers, addMembersToChannel }, "a", "b", "z", "c");
        // picked again: let go
        members.togglePicked(user("z"));
        expect(members.isPicked("z")).toBe(false);
        expect(members.isPicked("b")).toBe(true);

        const outcome = await members.sendPicked(way);

        expect(addMembersToChannel).toHaveBeenCalledWith(channel.id, ["a"]);
        expect(inviteUsers).toHaveBeenCalledWith(channel.id, ["b", "c"]);
        expect(outcome).toMatchObject({
            kind: "sent",
            added: [{ userId: "a" }],
            invited: [{ userId: "b" }, { userId: "c" }],
        });
        expect(picked(members)).toEqual([]);
    });

    // the backend refuses a whole invite for one who's in or invited already
    test("leaves out, and lets go of, those who can't be sent any more", async () => {
        const inviteUsers = vi.fn(async () => true);
        const members = picking({ inviteUsers }, "x", "b");

        expect(await members.sendPicked(way)).toMatchObject({
            kind: "sent",
            added: [],
            invited: [{ userId: "b" }],
        });
        expect(inviteUsers).toHaveBeenCalledWith(channel.id, ["b"]);
        expect(picked(members)).toEqual([]);
    });

    test("an add that went and an invite that didn't: both said, the invites still picked", async () => {
        const members = picking(
            {
                inviteUsers: async () => false,
                addMembersToChannel: async () => ({ kind: "success" }),
            },
            "a",
            "b",
        );

        expect(await members.sendPicked(way)).toMatchObject({
            kind: "partly_sent",
            added: [{ userId: "a" }],
            invited: [],
            message: { key: "group.inviteUsersFailed" },
        });
        expect(picked(members)).toEqual(["b"]);
    });

    test("a partial add keeps those not added picked, and the invites still go", async () => {
        const inviteUsers = vi.fn(async () => true);
        const members = picking(
            {
                inviteUsers,
                addMembersToChannel: async () => ({
                    kind: "add_to_channel_partial_success",
                    usersAdded: ["a"],
                    usersAlreadyInChannel: ["a3"],
                    usersLimitReached: ["a2"],
                    usersFailedWithError: [],
                }),
            },
            "a",
            "a2",
            "a3",
            "b",
        );

        const outcome = await members.sendPicked((id) => (id.startsWith("a") ? "add" : "invite"));

        expect(outcome).toMatchObject({
            kind: "partly_sent",
            added: [{ userId: "a" }, { userId: "a3" }],
            invited: [{ userId: "b" }],
            message: { key: "group.addMembersPartialSuccess" },
        });
        expect(inviteUsers).toHaveBeenCalledWith(channel.id, ["b"]);
        expect(picked(members)).toEqual(["a2"]);
    });

    test("nothing sent says why, and keeps everyone picked", async () => {
        const members = picking(
            {
                inviteUsers: async () => false,
                addMembersToChannel: async () => ({ kind: "add_to_channel_failed" }),
            },
            "a",
            "b",
        );

        expect(await members.sendPicked(way)).toMatchObject({
            kind: "failed",
            message: { key: "group.inviteUsersFailed" },
        });
        expect(picked(members)).toEqual(["a", "b"]);
    });
});

// Invite people's Invite link tab: one that couldn't load says so, and can be asked for again
test("an invite link that fails to load is marked failed, and loads when asked again", async () => {
    const link = { kind: "enabled", code: "123" } as const;
    const getInviteLink = vi
        .fn()
        .mockResolvedValueOnce({ kind: "failed", message: { key: "invite.errorGettingLink" } })
        .mockResolvedValueOnce(link);
    const group = { kind: "group_chat", id: { kind: "group_chat", groupId: "bbbbb-bb" } };
    const members = new MemberManagement({ getInviteLink } as never, group as MultiUserChat);
    expect(members.inviteLinkLoad).toEqual({ kind: "idle" });

    const loading = members.initialiseSharing();
    expect(members.inviteLinkLoad).toEqual({ kind: "loading" });
    expect(await loading).toMatchObject({ kind: "failed" });
    expect(members.inviteLinkLoad).toEqual({ kind: "failed" });
    expect(members.inviteLink).toBeUndefined();

    expect(await members.initialiseSharing()).toMatchObject({ kind: "success" });
    expect(members.inviteLinkLoad).toEqual({ kind: "loaded", link });
    expect(members.inviteLink).toEqual(link);
});

// Invite people's search: one that rejects (a member lookup that throws) finds nobody, rather than
// leaving its "searching" up for good
test("a search for people to invite that fails finds nobody", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const client = {
        canInviteUsers: () => true,
        searchUsersForInvite: async () => {
            throw new Error("lookup failed");
        },
    } as never;

    expect(await searchToInvite(client, "group", "ann")).toEqual([[], []]);
});

// The Invite people screen's Pending is `invited`: the people sent show there as soon as they're
// sent (the client's own invite puts them among the selected chat's invited users at once, as
// openchat-client's inviteUsers.spec checks), without waiting for the chat's details to reload
test("the people sent are among the invited at once, for the page that shows them", async () => {
    const groupId = { kind: "group_chat", groupId: "ggggg-gg" } as const;
    routeStore.set({
        kind: "global_chat_selected_route",
        chatId: groupId,
        chatType: "group_chat",
        open: false,
        scope: { kind: "chats" },
    });
    startChatVisit(selectedChatIdStore.value);
    currentChatVisit()?.setDetails(
        new ChatDetailsState(
            groupId,
            0n,
            new Map(),
            new Set(),
            new Set(),
            new Set(["a"]),
            new Set(),
            new Map(),
            new Map(),
            emptyRules(),
        ),
    );
    let answer: (ok: boolean) => void = () => {};
    const client = {
        // as the client's: invited here at once, then the backend asked
        inviteUsers: (id: typeof groupId, userIds: string[]) => {
            localUpdates.inviteChatUsers(id, userIds);
            return new Promise<boolean>((resolve) => (answer = resolve));
        },
    } as never;
    const group = { kind: "group_chat", id: groupId, level: "group", public: false };
    const members = new MemberManagement(client, group as MultiUserChat);
    members.togglePicked({ userId: "b", username: "b" } as UserSummary);

    let pending: string[] = [];
    const stop = $effect.root(() => {
        $effect(() => {
            pending = [...members.invited].sort();
        });
    });
    flushSync();
    expect(pending).toEqual(["a"]);

    const sent = members.sendPicked(() => "invite");
    flushSync();
    expect(pending).toEqual(["a", "b"]);

    answer(true);
    expect(await sent).toMatchObject({ kind: "sent", invited: [{ userId: "b" }] });
    flushSync();
    expect(pending).toEqual(["a", "b"]);
    expect(members.usersToAddOrInvite).toEqual([]);

    stop();
    localUpdates.clearAll();
});

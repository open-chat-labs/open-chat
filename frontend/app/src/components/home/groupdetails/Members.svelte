<script lang="ts">
    import { _ } from "svelte-i18n";
    import Search from "../../Search.svelte";
    import Member from "./Member.svelte";
    import BlockedUser from "./BlockedUser.svelte";
    import MembersHeader from "./MembersHeader.svelte";
    import VirtualList from "../../VirtualList.svelte";
    import type {
        FullMember,
        GroupChatSummary,
        Member as MemberType,
        OpenChat,
        PartialUserSummary,
        UserLookup,
    } from "openchat-client";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import MembersSelectionButton from "../MembersSelectionButton.svelte";
    import InvitedUser from "./InvitedUser.svelte";
    import ViewUserProfile from "../profile/ViewUserProfile.svelte";

    const client = getContext<OpenChat>("client");
    const userId = client.user.userId;

    export let closeIcon: "close" | "back";
    export let chat: GroupChatSummary;

    $: members = client.currentChatMembers;
    $: blocked = client.currentChatBlockedUsers;
    $: invited = client.currentChatInvitedUsers;
    $: userStore = client.userStore;
    $: knownUsers = getKnownUsers($userStore, $members);
    $: me = knownUsers.find((u) => u.userId === userId);
    $: fullMembers = knownUsers
        .filter(
            (u) =>
                matchesSearch(searchTerm, u) &&
                u.userId !== userId &&
                !$blocked.has(u.userId) &&
                !$invited.has(u.userId)
        )
        .sort(compareMembers);
    $: blockedUsers = Array.from($blocked)
        .map((userId) => $userStore[userId])
        .filter((u) => matchesSearch(searchTerm, u) && u.userId !== userId);
    $: invitedUsers = Array.from($invited)
        .map((userId) => $userStore[userId])
        .filter((u) => matchesSearch(searchTerm, u) && u.userId !== userId);
    $: publicGroup = chat.public;
    $: showBlocked = publicGroup && $blocked.size > 0;
    $: showInvited = !publicGroup && $invited.size > 0;

    let searchTerm = "";
    let chatId = chat.chatId;
    let membersList: VirtualList;
    let view: "members" | "blocked" | "invited" = "members";
    let profileUserId: string | undefined = undefined;

    $: {
        if (chat.chatId !== chatId) {
            chatId = chat.chatId;
            view = "members";
        }

        if (
            (view === "blocked" && $blocked.size === 0) ||
            (view === "invited" && $invited.size === 0)
        ) {
            view = "members";
        }
    }

    const dispatch = createEventDispatcher();

    function close() {
        dispatch("close");
    }

    function addMembers() {
        dispatch("addMembers");
    }

    function matchesSearch(searchTerm: string, user: PartialUserSummary): boolean {
        if (searchTerm === "") return true;
        if (user.username === undefined) return true;
        return user.username.toLowerCase().includes(searchTerm.toLowerCase());
    }

    function getKnownUsers(userStore: UserLookup, members: MemberType[]): FullMember[] {
        const users: FullMember[] = [];
        members.forEach((p) => {
            const user = userStore[p.userId];
            if (user) {
                users.push({
                    ...user,
                    ...p,
                });
            }
        });
        return users;
    }

    function compareMembers(a: FullMember, b: FullMember): number {
        if (a.role !== b.role) {
            if (a.role === "owner") return -1;
            if (b.role === "owner") return 1;
            if (a.role === "admin") return -1;
            if (b.role === "admin") return 1;
        }
        return 0;
    }

    function setView(v: "members" | "blocked" | "invited"): void {
        view = v;
    }

    function openUserProfile(ev: CustomEvent<string>) {
        profileUserId = ev.detail;
    }

    function closeUserProfile() {
        profileUserId = undefined;
    }

    function userSelected() {
        dispatch("chatWith", profileUserId);
        closeUserProfile();
    }
</script>

<MembersHeader {closeIcon} {publicGroup} {me} on:close={close} on:addMembers={addMembers} />

<div class="search">
    <Search
        on:searchEntered={() => membersList.reset()}
        searching={false}
        bind:searchTerm
        placeholder={"search"} />
</div>

{#if showBlocked || showInvited}
    <div class="section-selector">
        <MembersSelectionButton
            title={$_("members")}
            on:click={() => setView("members")}
            selected={view === "members"} />
        {#if showBlocked}
            <MembersSelectionButton
                title={$_("blocked")}
                on:click={() => setView("blocked")}
                selected={view === "blocked"} />
        {:else}
            <MembersSelectionButton
                title={$_("invited")}
                on:click={() => setView("invited")}
                selected={view === "invited"} />
        {/if}
    </div>
{/if}

{#if profileUserId !== undefined}
    <ViewUserProfile
        userId={profileUserId}
        on:openDirectChat={userSelected}
        on:close={closeUserProfile} />
{/if}

{#if view === "members"}
    {#if me !== undefined}
        <Member
            me
            member={me}
            canPromoteToOwner={me.role !== "owner" && client.isPlatformModerator()}
            canDemoteToAdmin={client.canDemote(chat.chatId, me.role, "admin")}
            canDemoteToMember={client.canDemote(chat.chatId, me.role, "participant")}
            on:openUserProfile={openUserProfile}
            on:changeRole />
    {/if}
    <VirtualList bind:this={membersList} keyFn={(user) => user.userId} items={fullMembers} let:item>
        <Member
            me={false}
            member={item}
            canPromoteToOwner={client.canPromote(chat.chatId, item.role, "owner")}
            canPromoteToAdmin={client.canPromote(chat.chatId, item.role, "admin")}
            canDemoteToAdmin={client.canDemote(chat.chatId, item.role, "admin")}
            canDemoteToMember={client.canDemote(chat.chatId, item.role, "participant")}
            canBlockUser={client.canBlockUsers(chat.chatId)}
            canRemoveMember={client.canRemoveMembers(chat.chatId)}
            {searchTerm}
            on:blockUser
            on:chatWith
            on:changeRole
            on:removeMember
            on:openUserProfile={openUserProfile} />
    </VirtualList>
{:else if view === "blocked"}
    <div class="user-list">
        {#each blockedUsers as user}
            <BlockedUser
                {user}
                {searchTerm}
                canUnblockUser={client.canUnblockUsers(chat.chatId)}
                on:openUserProfile={openUserProfile}
                on:unblockUser />
        {/each}
    </div>
{:else if view === "invited"}
    <div class="user-list">
        {#each invitedUsers as user}
            <InvitedUser
                {user}
                {searchTerm}
                canUninviteUser={false}
                on:openUserProfile={openUserProfile}
                on:uninviteUser />
        {/each}
    </div>
{/if}

<style type="text/scss">
    .section-selector {
        display: flex;
        justify-content: flex-start;
        margin: 0 $sp4 $sp4 $sp4;
        gap: $sp3;
        @include mobile() {
            justify-content: space-evenly;
            margin: 0 $sp3 $sp3 $sp3;
        }
    }
</style>

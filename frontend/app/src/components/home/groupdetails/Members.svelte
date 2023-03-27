<script lang="ts">
    import Search from "../../Search.svelte";
    import Member from "./Member.svelte";
    import MembersHeader from "./MembersHeader.svelte";
    import VirtualList from "../../VirtualList.svelte";
    import type {
        BlockedMember,
        FullMember,
        GroupChatSummary,
        Member as MemberType,
        OpenChat,
        UserLookup,
    } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import type { Readable } from "svelte/store";

    const client = getContext<OpenChat>("client");
    const userId = client.user.userId;

    export let closeIcon: "close" | "back";
    export let members: Readable<MemberType[]>;
    export let blockedUsers: Readable<Set<string>>;
    export let chat: GroupChatSummary;

    $: userStore = client.userStore;
    $: knownUsers = getKnownUsers($userStore, $members, $blockedUsers);
    $: me = knownUsers.find((u) => u.userId === userId);
    $: others = knownUsers
        .filter((u) => matchesSearch(searchTerm, u) && u.userId !== userId)
        .sort(compareMembers);
    $: publicGroup = chat.public;

    let searchTerm = "";
    let membersList: VirtualList;

    const dispatch = createEventDispatcher();

    function close() {
        dispatch("close");
    }

    function addMembers() {
        dispatch("addMembers");
    }

    function matchesSearch(searchTerm: string, user: FullMember | BlockedMember): boolean {
        if (searchTerm === "") return true;
        if (user.username === undefined) return true;
        return user.username.toLowerCase().includes(searchTerm.toLowerCase());
    }

    function getKnownUsers(
        userStore: UserLookup,
        members: MemberType[],
        blockedUsers: Set<string>
    ): (FullMember | BlockedMember)[] {
        const users: (FullMember | BlockedMember)[] = [];
        members.forEach((p) => {
            const user = userStore[p.userId];
            if (user) {
                users.push({
                    ...user,
                    ...p,
                    memberKind: "full_member",
                });
            }
        });
        if (chat.myRole === "admin" || chat.myRole === "owner") {
            blockedUsers.forEach((userId) => {
                const user = userStore[userId];
                if (user) {
                    users.push({
                        ...user,
                        role: "participant",
                        memberKind: "blocked_member",
                    });
                }
            });
        }
        return users;
    }

    function compareMembers(a: FullMember | BlockedMember, b: FullMember | BlockedMember): number {
        if (a.memberKind !== b.memberKind) {
            return a.memberKind === "full_member" ? -1 : 1;
        }
        if (a.role !== b.role) {
            if (a.role === "owner") return -1;
            if (b.role === "owner") return 1;
            if (a.role === "admin") return -1;
            if (b.role === "admin") return 1;
        }
        return 0;
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

{#if me !== undefined && me.memberKind === "full_member"}
    <Member 
        me
        member={me} 
        canPromoteToOwner={me.role !== "owner" && client.isPlatformModerator()}
        canDemoteToAdmin={client.canDemote(chat.chatId, me.role, "admin")}
        canDemoteToMember={client.canDemote(chat.chatId, me.role, "participant")}
        on:changeRole />
{/if}

<VirtualList bind:this={membersList} keyFn={(user) => user.userId} items={others} let:item>
    <Member
        me={false}
        member={item}
        canPromoteToOwner={client.canPromote(chat.chatId, item.role, "owner")}
        canPromoteToAdmin={client.canPromote(chat.chatId, item.role, "admin")}
        canDemoteToAdmin={client.canDemote(chat.chatId, item.role, "admin")}
        canDemoteToMember={client.canDemote(chat.chatId, item.role, "participant")}
        canBlockUser={client.canBlockUsers(chat.chatId)}
        canUnblockUser={client.canUnblockUsers(chat.chatId)}
        canRemoveMember={client.canRemoveMembers(chat.chatId)}
        {searchTerm}
        on:blockUser
        on:unblockUser
        on:chatWith
        on:changeRole
        on:removeMember
        on:close={close} />
</VirtualList>

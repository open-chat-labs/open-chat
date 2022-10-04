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
    } from "../../../domain/chat/chat";
    import {
        canBlockUsers,
        canChangeRoles,
        canRemoveMembers,
        canUnblockUsers,
    } from "../../../domain/chat/chat.utils";
    import { userStore } from "../../../stores/user";
    import { createEventDispatcher } from "svelte";
    import type { Readable } from "svelte/store";
    import type { UserLookup } from "../../../domain/user/user";

    export let userId: string;
    export let closeIcon: "close" | "back";
    export let members: Readable<MemberType[]>;
    export let blockedUsers: Readable<Set<string>>;
    export let chat: GroupChatSummary;

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
        placeholder={"filterMembers"} />
</div>

{#if me !== undefined && me.memberKind === "full_member"}
    <Member me={true} member={me} />
{/if}

<VirtualList bind:this={membersList} keyFn={(user) => user.userId} items={others} let:item>
    <Member
        me={false}
        member={item}
        canTransferOwnership={canChangeRoles(chat, item.role, "owner")}
        canMakeAdmin={canChangeRoles(chat, item.role, "admin")}
        canDismissAdmin={item.role === "admin" && canChangeRoles(chat, "admin", "participant")}
        canBlockUser={canBlockUsers(chat)}
        canUnblockUser={canUnblockUsers(chat)}
        canRemoveMember={canRemoveMembers(chat)}
        on:blockUser
        on:unblockUser
        on:chatWith
        on:dismissAsAdmin
        on:makeAdmin
        on:transferOwnership
        on:removeMember
        on:close={close} />
</VirtualList>

<style type="text/scss">
    .search {
        padding: 0 $sp3;
        @include size-above(xl) {
            padding: 0;
        }

        @include mobile() {
            padding: 0;
        }
    }
</style>

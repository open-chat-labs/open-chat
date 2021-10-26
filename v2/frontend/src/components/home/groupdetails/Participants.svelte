<script lang="ts">
    import Search from "../../Search.svelte";
    import Participant from "./Participant.svelte";
    import ParticipantsHeader from "./ParticipantsHeader.svelte";
    import VirtualList from "../../VirtualList.svelte";
    import type {
        BlockedParticipant,
        FullParticipant,
        GroupChatSummary,
        Participant as ParticipantType,
    } from "../../../domain/chat/chat";
    import { userStore } from "../../../stores/user";
    import { createEventDispatcher } from "svelte";
    import type { Writable } from "svelte/store";

    export let chat: Writable<GroupChatSummary>;
    export let participants: Writable<ParticipantType[]>;
    export let blockedUsers: Writable<Set<string>>;
    export let userId: string;
    export let closeIcon: "close" | "back";

    let searchTerm = "";

    const dispatch = createEventDispatcher();

    function close() {
        dispatch("close");
    }

    function addParticipants() {
        dispatch("addParticipants");
    }

    function matchesSearch(
        searchTerm: string,
        user: FullParticipant | BlockedParticipant
    ): boolean {
        if (searchTerm === "") return true;
        if (user.username === undefined) return true;
        return user.username.toLowerCase().includes(searchTerm.toLowerCase());
    }

    function getKnownUsers(
        participants: ParticipantType[],
        blockedUsers: Set<string>
    ): (FullParticipant | BlockedParticipant)[] {
        const users: (FullParticipant | BlockedParticipant)[] = [];
        let includeBlocked = false;
        participants.forEach((p) => {
            const user = $userStore[p.userId];
            if (p.userId === userId && p.role === "admin") {
                includeBlocked = true;
            }
            if (user) {
                users.push({
                    kind: "full_participant",
                    ...user,
                    ...p,
                });
            }
        });
        if (includeBlocked) {
            blockedUsers.forEach((userId) => {
                const user = $userStore[userId];
                if (user) {
                    users.push({
                        kind: "blocked_participant",
                        ...user,
                        role: "standard",
                    });
                }
            });
        }
        return users;
    }

    $: knownUsers = getKnownUsers($participants, $blockedUsers);

    $: me = knownUsers.find((u) => u.userId === userId);

    $: myRole = me && me.kind === "full_participant" ? me.role : "standard";

    // FIXME - we need to sort this list to put blocked users to the bottom
    $: others = knownUsers.filter((u) => {
        return matchesSearch(searchTerm, u) && u.userId !== userId;
    });

    let publicGroup = $chat.public;
</script>

<ParticipantsHeader
    {closeIcon}
    {publicGroup}
    {me}
    on:close={close}
    on:addParticipants={addParticipants} />

<div class="search">
    <Search searching={false} bind:searchTerm placeholder={"filterParticipants"} />
</div>

{#if me !== undefined && me.kind === "full_participant"}
    <Participant
        {publicGroup}
        me={true}
        participant={me}
        myRole={me.role}
        on:blockUser
        on:chatWith />
{/if}

<VirtualList keyFn={(user) => user.userId} items={others} let:item>
    <Participant
        me={false}
        participant={item}
        {myRole}
        {publicGroup}
        on:blockUser
        on:unblockUser
        on:chatWith
        on:dismissAsAdmin
        on:makeAdmin
        on:removeParticipant
        on:close={close} />
</VirtualList>

<style type="text/scss">
    .search {
        padding: 0 $sp3;
    }
</style>

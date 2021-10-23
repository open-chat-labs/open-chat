<script lang="ts">
    import Search from "../../Search.svelte";
    import Participant from "./Participant.svelte";
    import ParticipantsHeader from "./ParticipantsHeader.svelte";
    import VirtualList from "../../VirtualList.svelte";
    import type { FullParticipant, GroupChatSummary } from "../../../domain/chat/chat";
    import { userStore } from "../../../stores/user";
    import { createEventDispatcher } from "svelte";
    import type { Writable } from "svelte/store";

    export let chat: Writable<GroupChatSummary>;
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

    function matchesSearch(searchTerm: string, user: FullParticipant): boolean {
        if (searchTerm === "") return true;
        if (user.username === undefined) return true;
        return user.username.toLowerCase().includes(searchTerm.toLowerCase());
    }

    $: knownUsers = $chat.participants.reduce<FullParticipant[]>((users, p) => {
        const user = $userStore[p.userId];
        if (user) {
            users.push({
                ...user,
                ...p,
            });
        }
        return users;
    }, []);

    $: me = knownUsers.find((u) => u.userId === userId);

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

{#if me !== undefined}
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
        myRole={me?.role ?? "standard"}
        {publicGroup}
        on:blockUser
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

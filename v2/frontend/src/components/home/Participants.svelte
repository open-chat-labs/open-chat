<script lang="ts">
    import ParticipantsHeader from "./ParticipantsHeader.svelte";
    import Participant from "./Participant.svelte";
    import type { GroupChatSummary } from "../../domain/chat/chat";
    import type { UserLookup } from "../../domain/user/user";

    export let groupChat: GroupChatSummary;
    export let users: UserLookup;

    $: console.log(users);
</script>

<ParticipantsHeader on:close on:addParticipant />

{#each groupChat.participants as userId}
    {#if users[userId] !== undefined}
        <Participant
            {users}
            participant={users[userId]}
            on:dismissAsAdmin
            on:removeUser
            on:blockUser
            on:selectParticipant />
    {/if}
{/each}

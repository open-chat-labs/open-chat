<script lang="ts">
    import ParticipantsHeader from "./ParticipantsHeader.svelte";
    import Participant from "./Participant.svelte";
    import type { GroupChatSummary } from "../../domain/chat/chat";
    import type { UserLookup } from "../../domain/user/user";

    export let groupChat: GroupChatSummary;
    export let users: UserLookup;
</script>

<ParticipantsHeader on:close />

{#each groupChat.participants as userId}
    {#if users[userId] !== undefined}
        <Participant {users} participant={users[userId]} on:dismissAsAdmin on:removeUser />
    {/if}
{/each}

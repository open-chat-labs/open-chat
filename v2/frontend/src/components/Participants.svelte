<script lang="ts">
    import ParticipantsHeader from "./ParticipantsHeader.svelte";
    import Participant from "./Participant.svelte";
    import { chatStore } from "../stores/chats";
</script>

<ParticipantsHeader />

{#if $chatStore}
    {#await $chatStore.chatDetails then chat}
        {#each chat.participants as participant}
            <Participant {participant} />
        {/each}
    {/await}
{/if}

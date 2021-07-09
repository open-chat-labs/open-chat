<script lang="ts">
    import ParticipantsHeader from "./ParticipantsHeader.svelte";
    import Participant from "./Participant.svelte";
    import type { ActorRefFrom } from "xstate";
    import type { ChatMachine } from "../../fsm/chat.machine";
    export let machine: ActorRefFrom<ChatMachine>;

    function close() {
        machine.send({ type: "HIDE_PARTICIPANTS" });
    }
</script>

<ParticipantsHeader on:close={close} on:addParticipant />

{#if $machine.context.chatSummary.kind === "group_chat"}
    {#each $machine.context.chatSummary.participants as userId}
        {#if $machine.context.userLookup[userId] !== undefined}
            <Participant
                {machine}
                participant={$machine.context.userLookup[userId]}
                on:dismissAsAdmin
                on:blockUser
                on:selectParticipant />
        {/if}
    {/each}
{/if}

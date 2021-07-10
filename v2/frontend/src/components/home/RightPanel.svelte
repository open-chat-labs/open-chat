<script lang="ts">
    import type { ActorRefFrom } from "xstate";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import Panel from "../Panel.svelte";
    import Participants from "./Participants.svelte";
    import AddParticipant from "./AddParticipant.svelte";
    export let machine: ActorRefFrom<ChatMachine>;
</script>

<Panel right>
    {#if $machine.matches({ showing_participants: "adding_participant" })}
        <AddParticipant {machine} />
    {:else}
        <Participants {machine} on:blockUser on:selectParticipant />
    {/if}
</Panel>

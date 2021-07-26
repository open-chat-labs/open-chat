<script lang="ts">
    import type { ActorRefFrom } from "xstate";
    import Panel from "../Panel.svelte";
    import Participants from "./Participants.svelte";
    import AddParticipant from "./AddParticipant.svelte";
    import type { ParticipantsMachine } from "../../fsm/participants.machine";
    export let machine: ActorRefFrom<ParticipantsMachine>;
</script>

<Panel right>
    {#if $machine.matches("adding_participant")}
        <AddParticipant {machine} />
    {:else}
        <Participants {machine} on:blockUser on:chatWith />
    {/if}
</Panel>

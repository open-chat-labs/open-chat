<script lang="ts">
    import type { ActorRefFrom } from "xstate";
    import Panel from "../Panel.svelte";
    import GroupDetails from "./groupdetails/GroupDetails.svelte";
    import AddParticipants from "./groupdetails/AddParticipants.svelte";
    import Participants from "./groupdetails/Participants.svelte";
    import type { EditGroupMachine } from "../../fsm/editgroup.machine";
    export let machine: ActorRefFrom<EditGroupMachine>;
</script>

<Panel right>
    {#if $machine.matches("editing_group_details")}
        <GroupDetails {machine} />
    {:else if $machine.matches("adding_participants")}
        <AddParticipants {machine} />
    {:else}
        <Participants {machine} on:blockUser on:chatWith />
    {/if}
</Panel>

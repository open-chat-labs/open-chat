<script lang="ts">
    import type { ActorRefFrom } from "xstate";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import Panel from "../Panel.svelte";
    import Participants from "./Participants.svelte";
    export let machine: ActorRefFrom<ChatMachine>;
</script>

<Panel right>
    <Participants {machine} on:dismissAsAdmin on:addParticipant on:blockUser on:selectParticipant />
</Panel>

<script lang="ts">
    import CurrentChatHeader from "./CurrentChatHeader.svelte";
    import CurrentChatMessages from "./CurrentChatMessages.svelte";
    import MessageEntry from "./MessageEntry.svelte";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom } from "xstate";

    export let machine: ActorRefFrom<ChatMachine>;

    function showParticipants() {
        machine.send({ type: "SHOW_PARTICIPANTS" });
    }

    function addParticipant() {
        machine.send({ type: "ADD_PARTICIPANT" });
    }
</script>

<div class="wrapper">
    <CurrentChatHeader
        users={$machine.context.userLookup}
        on:clearSelection
        on:blockUser
        on:addParticipant={addParticipant}
        on:showParticipants={showParticipants}
        on:leaveGroup
        selectedChatSummary={$machine.context.chatSummary} />

    <CurrentChatMessages on:chatWith {machine} />
    <MessageEntry {machine} />
</div>

<style type="text/scss">
    .wrapper {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
    }
</style>

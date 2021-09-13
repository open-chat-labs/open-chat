<script lang="ts">
    import CurrentChatHeader from "./CurrentChatHeader.svelte";
    import CurrentChatMessages from "./CurrentChatMessages.svelte";
    import Footer from "./Footer.svelte";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom } from "xstate";

    export let machine: ActorRefFrom<ChatMachine>;
    export let blocked: boolean;
    export let unconfirmed: Set<bigint>;

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
        user={$machine.context.user}
        {blocked}
        on:clearSelection
        on:blockUser
        on:unblockUser
        on:addParticipant={addParticipant}
        on:showParticipants={showParticipants}
        on:leaveGroup
        selectedChatSummary={$machine.context.chatSummary} />
    <CurrentChatMessages {unconfirmed} on:chatWith {machine} />
    <Footer {machine} on:unconfirmedMessage on:messageConfirmed />
</div>

<style type="text/scss">
    .wrapper {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
    }
</style>

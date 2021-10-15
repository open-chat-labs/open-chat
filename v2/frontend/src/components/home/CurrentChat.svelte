<script lang="ts">
    import CurrentChatHeader from "./CurrentChatHeader.svelte";
    import CurrentChatMessages from "./CurrentChatMessages.svelte";
    import Footer from "./Footer.svelte";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom } from "xstate";
    import { getMinVisibleMessageIndex } from "../../domain/chat/chat.utils";

    export let machine: ActorRefFrom<ChatMachine>;
    export let blocked: boolean;

    $: unreadMessages = $machine.context.markRead.unreadMessageCount(
        $machine.context.chatSummary.chatId,
        getMinVisibleMessageIndex($machine.context.chatSummary),
        $machine.context.chatSummary.latestMessage?.event.messageIndex
    );

    function showGroupDetails() {
        machine.send({ type: "SHOW_GROUP_DETAILS" });
    }

    function showParticipants() {
        machine.send({ type: "SHOW_PARTICIPANTS" });
    }

    function addParticipants() {
        machine.send({ type: "ADD_PARTICIPANT" });
    }
</script>

<div class="wrapper">
    <CurrentChatHeader
        user={$machine.context.user}
        {blocked}
        {unreadMessages}
        on:clearSelection
        on:blockUser
        on:unblockUser
        on:addParticipants={addParticipants}
        on:showGroupDetails={showGroupDetails}
        on:showParticipants={showParticipants}
        on:leaveGroup
        selectedChatSummary={$machine.context.chatSummary} />
    <CurrentChatMessages on:messageRead on:chatWith {machine} {unreadMessages} />
    <Footer {machine} />
</div>

<style type="text/scss">
    .wrapper {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
    }
</style>

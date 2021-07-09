<script lang="ts">
    import CurrentChatHeader from "./CurrentChatHeader.svelte";
    import Loading from "../Loading.svelte";
    // import CurrentChatMessages from "../CurrentChatMessages.svelte";
    // import MessageEntry from "../MessageEntry.svelte";
    import type { UserLookup } from "../../domain/user/user";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom } from "xstate";

    export let machine: ActorRefFrom<ChatMachine>;

    $: console.log("ChatMachineState: ", $machine.value);
</script>

<div class="wrapper">
    <CurrentChatHeader
        users={$machine.context.userLookup}
        on:clearSelection
        on:blockUser
        on:showParticipants
        on:leaveGroup
        selectedChatSummary={$machine.context.chatSummary} />

    {#if $machine.matches("loading_messages")}
        <Loading />
    {/if}
    <!-- <CurrentChatMessages {chat} />
    <MessageEntry /> -->
</div>

<style type="text/scss">
    .wrapper {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
    }
</style>

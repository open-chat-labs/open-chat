<script lang="ts">
    import LeftPanel from "./LeftPanel.svelte";
    import type { ActorRefFrom } from "xstate";
    import type { LoggedInMachine } from "../../fsm/loggedin.machine";
    import type { LeftPanelState } from "./LeftPanel.types";
    import type { ChatSummary } from "../../domain/chat";
    import { push } from "svelte-spa-router";

    export let params: { chatId?: string } = {};
    export let machine: ActorRefFrom<LoggedInMachine>;

    let uiState: LeftPanelState = "loadingChats";

    $: {
        console.log("X", $machine.value);
    }

    // I think this logged in machine is going to get interesting. Seems like there might well be parallel states
    // trying to square the router and the state machine
    // do we need a select_chat event which just changes the url
    // then a chat_selected event which fires when the route changes which causes the messages to be loaded
    $: {
        if (params.chatId !== $machine.context.selectedChatId && params.chatId) {
            machine.send({ type: "SET_SELECTED_CHAT_ID", data: params.chatId });
        }
    }

    function selectChat(ev: CustomEvent<ChatSummary>) {
        // tell the router about the selection so that the router can tell the state machine
        // we need the router to be the source of truth so that the browser history works as expected
        push(`/chat/${ev.detail.chatId}`);
    }

    $: {
        switch ($machine.value) {
            case "loading_chats":
                uiState = "loadingChats";
                break;
            default:
                uiState = { error: $machine.context.error?.message ?? "" };
        }
    }
</script>

<pre>{$machine.context.selectedChatId}</pre>

{#if $machine.context.user}
    <LeftPanel
        chatSummaries={$machine.context.chats}
        selectedChatId={$machine.context.selectedChatId}
        state={uiState}
        on:logout
        on:selectChat={selectChat}
        user={$machine.context.user} />
{/if}

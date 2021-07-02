<script lang="ts">
    import LeftPanel from "./LeftPanel.svelte";
    import type { ActorRefFrom } from "xstate";
    import type { LoggedInMachine } from "../../fsm/loggedin.machine";
    import type { LeftPanelState } from "./LeftPanel.types";
    import type { ChatSummary } from "../../domain/chat";
    import { push, replace } from "svelte-spa-router";
    import { ScreenWidth, screenWidth } from "../../stores/screenWidth";

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
    // $: {
    //     if (params.chatId !== $machine.context.selectedChatId && params.chatId) {
    //         console.log("this should trigger loading messages");
    //         machine.send({ type: "SET_SELECTED_CHAT_ID", data: params.chatId });
    //     }
    // }

    // in addition to what we are already doing we need to intercept the back button so that on mobile we can
    // toggle visibility of the left hand panel

    $: {
        // wait until we have loaded the chats
        if ($machine.matches("loaded_chats")) {
            // if we have a chatid in the params then we need to select that chat
            if (params.chatId) {
                console.log("selecting chat specified in params");
                // todo check whether the selected chat is in the list of chats
                // if it is not then figure out what to do
                machine.send({ type: "SET_SELECTED_CHAT_ID", data: params.chatId });
            } else if ($screenWidth !== ScreenWidth.ExtraSmall) {
                // if not we will select the first chat if we are not in mobile mode
                console.log("select the first chat - if there is one");
                // machine.send({ type: "SET_SELECTED_CHAT_ID", data: params.chatId });
            } else {
                console.log("not selecting any chat because we're on mobile");
            }
        }
    }

    function selectChat(ev: CustomEvent<ChatSummary>) {
        // to replace or to push, that is the question
        replace(`/chat/${ev.detail.chatId}`);
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

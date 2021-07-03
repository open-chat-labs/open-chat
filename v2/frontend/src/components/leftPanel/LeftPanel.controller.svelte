<script lang="ts">
    import LeftPanel from "./LeftPanel.svelte";
    import type { ActorRefFrom } from "xstate";
    import type { LoggedInMachine } from "../../fsm/loggedin.machine";
    import type { LeftPanelState } from "./LeftPanel.types";
    import type { ChatSummary } from "../../domain/chat";
    import { push, replace } from "svelte-spa-router";
    import { onMount } from "svelte";

    export let params: { chatId: string | null } = { chatId: null };
    export let machine: ActorRefFrom<LoggedInMachine>;

    let uiState: LeftPanelState = "loadingChats";

    onMount(() => {
        console.log("mounting left panel", params.chatId);
    });

    $: {
        // wait until we have loaded the chats
        if ($machine.matches("loaded_chats")) {
            // if we have a chatid in the params then we need to select that chat
            if (params.chatId && params.chatId !== $machine.context.selectedChatId) {
                // if we have an unknown chat in the param, then redirect to home
                if ($machine.context.chats.findIndex((c) => c.chatId === params.chatId) < 0) {
                    replace("/");
                } else {
                    // otherwise tell the machine to load messages for this chat
                    machine.send({ type: "LOAD_MESSAGES", data: params.chatId });
                }
            }

            // if there is no chatId param, tell the machine to clear the selection
            if (params.chatId === undefined) {
                machine.send({ type: "CLEAR_SELECTED_CHAT" });
            }
        }
    }

    function selectChat(ev: CustomEvent<ChatSummary>) {
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

{#if $machine.context.user}
    <LeftPanel
        hideLeft={params.chatId !== null}
        chatSummaries={$machine.context.chats}
        selectedChatId={$machine.context.selectedChatId}
        state={uiState}
        on:logout
        on:selectChat={selectChat}
        user={$machine.context.user} />
{/if}

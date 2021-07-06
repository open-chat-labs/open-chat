<script lang="ts">
    import LeftPanel from "./LeftPanel.svelte";
    import MiddlePanel from "./MiddlePanel.svelte";
    import TestModeModal from "../TestModeModal.svelte";
    import ThemePicker from "../ThemePicker.svelte";
    import type { ActorRefFrom } from "xstate";
    import { modalStore, ModalType } from "../../stores/modal";
    import Overlay from "../Overlay.svelte";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
    // import { rtlStore } from "../../stores/rtl";
    import type { HomeMachine } from "../../fsm/home.machine";
    import type { HomeState } from "./Home.types";
    import type { ChatSummary } from "../../domain/chat";
    import { push, replace } from "svelte-spa-router";
    export let machine: ActorRefFrom<HomeMachine>;
    export let params: { chatId: string | null } = { chatId: null };
    let homeState: HomeState = "loadingChats";

    function logout() {
        dispatch("logout");
    }

    $: {
        // wait until we have loaded the chats
        if ($machine.matches("loaded_chats")) {
            // if we have a chatid in the params then we need to select that chat
            if (params.chatId && params.chatId !== $machine.context.selectedChatId?.toString()) {
                // if we have an unknown chat in the param, then redirect to home
                if (
                    $machine.context.chats.findIndex((c) => c.chatId.toString() === params.chatId) <
                    0
                ) {
                    replace("/");
                } else {
                    // otherwise tell the machine to load messages for this chat
                    machine.send({ type: "LOAD_MESSAGES", data: BigInt(params.chatId) });
                }
            }

            // if there is no chatId param, tell the machine to clear the selection
            if (params.chatId === null) {
                machine.send({ type: "CLEAR_SELECTED_CHAT" });
            }
        }
    }

    function selectChat(ev: CustomEvent<ChatSummary>) {
        push(`/chat/${ev.detail.chatId}`);
    }

    function newChat() {
        console.log("new chat clicked");
    }

    $: {
        // todo - not too thrilled about this
        if ($machine.matches("loading_chats")) {
            homeState = "loadingChats";
        } else if ($machine.matches({ loaded_chats: "loading_messages" })) {
            homeState = "loadingMessages";
        } else if ($machine.matches({ loaded_chats: "idle" })) {
            homeState = "idle";
        } else if ($machine.matches("unexpected_error")) {
            homeState = { error: $machine.context.error?.message ?? "" };
        }
    }
</script>

{#if $machine.context.user}
    <main>
        <LeftPanel
            users={$machine.context.userLookup}
            hideLeft={params.chatId !== null}
            chatSummaries={$machine.context.chats}
            selectedChatId={$machine.context.selectedChatId}
            state={homeState}
            on:logout={logout}
            on:newchat={newChat}
            on:selectChat={selectChat}
            user={$machine.context.user} />
        <MiddlePanel
            state={homeState}
            on:newchat={newChat}
            hideLeft={params.chatId !== null}
            selectedChatId={$machine.context.selectedChatId} />
        <!-- {#if $navStore}
            <div transition:fly={{ x, duration: 400 }} class="right-wrapper" class:rtl={$rtlStore}>
                <RightPanel />
            </div>
        {/if} -->
    </main>
{/if}

<Overlay active={$modalStore !== ModalType.NoModal}>
    {#if $modalStore === ModalType.TestMode}
        <TestModeModal />
    {:else if $modalStore === ModalType.ThemeSelection}
        <ThemePicker />
    {/if}
</Overlay>

<style type="text/scss">
    main {
        position: relative;
        @include fullHeight();
        width: 100%;
        max-width: 1000px;
        margin: auto;
    }
    :global(body) {
        transition: color ease-in-out 300ms;
        padding: 0;
        --background-color: var(--theme-background);
        --text-color: var(--theme-text);
        color: var(--theme-text);
    }
    .right-wrapper {
        position: absolute;
        top: 0;
        &:not(.rtl) {
            right: 0;
        }
        &.rtl {
            left: 0;
        }
        @include z-index("right-panel");
        @include box-shadow(3);
        @include size-below(xs) {
            width: 100%;
        }
    }
</style>

<script lang="ts">
    import LeftPanel from "./LeftPanel.svelte";
    import MiddlePanel from "./MiddlePanel.svelte";
    import RightPanel from "./RightPanel.svelte";
    import TestModeModal from "../TestModeModal.svelte";
    import ThemePicker from "../ThemePicker.svelte";
    import { fly } from "svelte/transition";
    import type { ActorRefFrom } from "xstate";
    import { modalStore, ModalType } from "../../stores/modal";
    import Overlay from "../Overlay.svelte";
    import { createEventDispatcher } from "svelte";
    const dispatch = createEventDispatcher();
    import { rtlStore } from "../../stores/rtl";
    import type { HomeMachine } from "../../fsm/home.machine";
    import type { ChatSummary } from "../../domain/chat/chat";
    import { push, replace } from "svelte-spa-router";
    export let machine: ActorRefFrom<HomeMachine>;
    export let params: { chatId: string | null } = { chatId: null };

    function logout() {
        dispatch("logout");
    }

    $: {
        // wait until we have loaded the chats
        if ($machine.matches("loaded_chats")) {
            // if we have a chatid in the params then we need to select that chat
            if (
                params.chatId &&
                params.chatId !== $machine.context.selectedChat?.chatId?.toString()
            ) {
                // if we have an unknown chat in the param, then redirect to home
                if (
                    $machine.context.chatSummaries.findIndex(
                        (c) => c.chatId.toString() === params.chatId
                    ) < 0
                ) {
                    replace("/");
                } else {
                    // otherwise tell the machine to load messages for this chat
                    machine.send({ type: "SELECT_CHAT", data: BigInt(params.chatId) });
                }
            }

            // if there is no chatId param, tell the machine to clear the selection
            if (params.chatId === null) {
                machine.send({ type: "CLEAR_SELECTED_CHAT" });
            }
        }
    }

    function clearSelectedChat() {
        push("/");
    }

    function selectChat(ev: CustomEvent<ChatSummary>) {
        push(`/chat/${ev.detail.chatId}`);
    }

    function newChat() {
        console.log("new chat clicked");
    }

    function blockUser() {
        console.log("block user clicked");
    }

    function dismissUserAsAdmin() {
        console.log("dismiss user as admin");
    }

    function addParticipant() {
        console.log("add participant");
    }

    function selectParticipant() {
        console.log("select participant");
    }

    function leaveGroup() {
        console.log("leave group");
    }

    $: selectedChat = $machine.context.selectedChat;

    $: groupChat = selectedChat
        ? selectedChat.kind === "group_chat"
            ? selectedChat
            : undefined
        : undefined;

    $: actorKey = $machine.context.selectedChat?.chatId.toString();

    $: selectedChatActor = actorKey ? $machine.context.chatsIndex[actorKey] : undefined;

    $: x = $rtlStore ? -300 : 300;
</script>

{#if $machine.context.user}
    <main>
        <LeftPanel
            {machine}
            hideLeft={params.chatId !== null}
            on:logout={logout}
            on:newchat={newChat}
            on:selectChat={selectChat} />
        <MiddlePanel
            loadingChats={$machine.matches("loading_chats")}
            on:newchat={newChat}
            on:clearSelection={clearSelectedChat}
            on:blockUser={blockUser}
            on:leaveGroup={leaveGroup}
            hideLeft={params.chatId !== null}
            machine={selectedChatActor} />
    </main>
{/if}

{#if selectedChatActor !== undefined}
    <Overlay active={$selectedChatActor.matches("showing_participants")}>
        {#if $selectedChatActor.matches("showing_participants") && groupChat !== undefined}
            <div transition:fly={{ x, duration: 400 }} class="right-wrapper" class:rtl={$rtlStore}>
                <RightPanel
                    machine={selectedChatActor}
                    on:dismissAsAdmin={dismissUserAsAdmin}
                    on:addParticipant={addParticipant}
                    on:selectParticipant={selectParticipant}
                    on:blockUser={blockUser} />
            </div>
        {/if}
    </Overlay>
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

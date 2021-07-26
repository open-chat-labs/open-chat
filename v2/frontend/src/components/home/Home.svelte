<script lang="ts">
    import LeftPanel from "./LeftPanel.svelte";
    import Toast from "../Toast.svelte";
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
    import { push, replace } from "svelte-spa-router";
    import { sineInOut } from "svelte/easing";
    import JoinGroup from "./JoinGroup.svelte";
    import ModalContent from "../ModalContent.svelte";
    import type { ParticipantsMachine } from "../../fsm/participants.machine";
    export let machine: ActorRefFrom<HomeMachine>;
    export let params: { chatId: string | null; messageIndex: string | undefined | null } = {
        chatId: null,
        messageIndex: undefined,
    };

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
                    machine.send({
                        type: "SELECT_CHAT",
                        data: {
                            chatId: params.chatId,
                            messageIndex:
                                params.messageIndex == null ? undefined : params.messageIndex,
                        },
                    });
                }
            }

            // if there is no chatId param, tell the machine to clear the selection
            if (params.chatId === null && $machine.context.selectedChat !== undefined) {
                machine.send({ type: "CLEAR_SELECTED_CHAT" });
            }
        }
    }

    function clearSelectedChat() {
        push("/");
    }

    function newChat() {
        machine.send({ type: "NEW_CHAT" });
    }

    function joinGroup() {
        machine.send({ type: "JOIN_GROUP" });
        // modalStore.showModal(ModalType.JoinGroup);
    }

    function blockUser() {
        console.log("block user clicked");
    }

    function leaveGroup(ev: CustomEvent<string>) {
        machine.send({ type: "LEAVE_GROUP", data: ev.detail });
    }

    function chatWith(ev: CustomEvent<string>) {
        const chat = $machine.context.chatSummaries.find((c) => {
            return c.kind === "direct_chat" && c.them === ev.detail;
        });
        if (chat) {
            push(`/${chat.chatId}`);
        } else {
            machine.send({ type: "CREATE_DIRECT_CHAT", data: ev.detail });
        }
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

    $: participantsMachine =
        selectedChatActor &&
        ($selectedChatActor.children.participantsMachine as ActorRefFrom<ParticipantsMachine>);
</script>

{#if $machine.context.user}
    <main>
        <LeftPanel
            {machine}
            hideLeft={params.chatId !== null}
            on:logout={logout}
            on:joinGroup={joinGroup}
            on:newchat={newChat} />
        <MiddlePanel
            loadingChats={$machine.matches("loading_chats")}
            on:newchat={newChat}
            on:clearSelection={clearSelectedChat}
            on:blockUser={blockUser}
            on:leaveGroup={leaveGroup}
            on:chatWith={chatWith}
            hideLeft={params.chatId !== null}
            machine={selectedChatActor} />
    </main>
{/if}

{#if selectedChatActor !== undefined}
    <Overlay active={participantsMachine !== undefined}>
        {#if participantsMachine !== undefined && groupChat !== undefined}
            <div
                transition:fly={{ x, duration: 200, easing: sineInOut }}
                class="right-wrapper"
                class:rtl={$rtlStore}>
                <RightPanel
                    machine={participantsMachine}
                    on:chatWith={chatWith}
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
    {:else if $modalStore === ModalType.JoinGroup}
        <ModalContent>
            <span slot="body">
                <JoinGroup {machine} />
            </span>
        </ModalContent>
    {/if}
</Overlay>

<Toast />

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

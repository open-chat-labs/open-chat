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
    import { createEventDispatcher, onDestroy, onMount } from "svelte";
    const dispatch = createEventDispatcher();
    import { rtlStore } from "../../stores/rtl";
    import { ScreenWidth, screenWidth } from "../../stores/screenWidth";
    import type { HomeMachine } from "../../fsm/home.machine";
    import { push, replace } from "svelte-spa-router";
    import { sineInOut } from "svelte/easing";
    import JoinGroup from "./JoinGroup.svelte";
    import ModalContent from "../ModalContent.svelte";
    import { toastStore } from "../../stores/toast";
    import type { EditGroupMachine } from "../../fsm/editgroup.machine";
    import type {
        GroupSearchResponse,
        MessageMatch,
        SearchAllMessagesResponse,
    } from "../../domain/search/search";
    import type { UserSummary } from "../../domain/user/user";
    import { blockedUsers } from "../../stores/blockedUsers";
    import { stopMarkReadPoller } from "../../stores/markRead";
    import { rtcConnectionsManager } from "../../domain/webrtc/RtcConnectionsManager";
    export let machine: ActorRefFrom<HomeMachine>;
    export let params: { chatId: string | null; eventIndex: string | undefined | null } = {
        chatId: null,
        eventIndex: undefined,
    };

    let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    let userSearchResults: Promise<UserSummary[]> | undefined = undefined;
    let messageSearchResults: Promise<SearchAllMessagesResponse> | undefined = undefined;
    let searchTerm: string = "";
    let searching: boolean = false;
    let searchResultsAvailable: boolean = false;

    function logout() {
        dispatch("logout");
    }

    onMount(() => {
        // bootstrap anything that needs a service container here
        rtcConnectionsManager.init($machine.context.user!.userId);
    });

    onDestroy(() => {
        // clean up anything that needs to be stopped e.g. pollers
        stopMarkReadPoller();
    });

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
                            eventIndex: params.eventIndex == null ? undefined : params.eventIndex,
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

    async function performSearch(ev: CustomEvent<string>) {
        searchResultsAvailable = false;
        searchTerm = ev.detail.toLowerCase();
        if (searchTerm !== "") {
            searching = true;
            groupSearchResults = $machine.context.serviceContainer!.searchGroups(searchTerm, 10);
            userSearchResults = $machine.context.serviceContainer!.searchUsers(searchTerm, 10);
            messageSearchResults = $machine.context.serviceContainer!.searchAllMessages(
                searchTerm,
                10
            );
            try {
                await Promise.all([
                    groupSearchResults,
                    userSearchResults,
                    messageSearchResults,
                ]).then(() => {
                    searchResultsAvailable = true;
                    searching = false;
                });
            } catch (_err) {
                searching = false;
            }
        } else {
            clearSearch();
        }
    }

    function clearSearch() {
        groupSearchResults = userSearchResults = messageSearchResults = undefined;
        searchTerm = "";
        searching = false;
        searchResultsAvailable = false;
    }

    function clearSelectedChat() {
        push("/");
    }

    function newGroup() {
        machine.send({ type: "NEW_GROUP" });
    }

    function newChat() {
        machine.send({ type: "NEW_CHAT" });
    }

    function joinGroup() {
        machine.send({ type: "JOIN_GROUP" });
    }

    function blockUser(ev: CustomEvent<{ userId: string }>) {
        blockedUsers.add(ev.detail.userId);
        $machine.context
            .serviceContainer!.blockUser(ev.detail.userId)
            .then((resp) => {
                if (resp === "success") {
                    toastStore.showSuccessToast("blockUserSucceeded");
                } else {
                    toastStore.showFailureToast("blockUserFailed");
                }
            })
            .catch((_err) => toastStore.showFailureToast("blockUserFailed"));
    }

    function unblockUser(ev: CustomEvent<{ userId: string }>) {
        blockedUsers.delete(ev.detail.userId);
        $machine.context
            .serviceContainer!.unblockUser(ev.detail.userId)
            .then((resp) => {
                if (resp === "success") {
                    toastStore.showSuccessToast("unblockUserSucceeded");
                } else {
                    toastStore.showFailureToast("unblockUserFailed");
                }
            })
            .catch((_err) => toastStore.showFailureToast("unblockUserFailed"));
    }

    function leaveGroup(ev: CustomEvent<string>) {
        machine.send({ type: "LEAVE_GROUP", data: ev.detail });
        $machine.context
            .serviceContainer!.leaveGroup(ev.detail)
            .then((resp) => {
                if (resp === "success") {
                    toastStore.showSuccessToast("leftGroup");
                } else {
                    // todo - do we need to reverse the data update here (by posting to the machine)
                    toastStore.showFailureToast("failedToLeaveGroup");
                }
            })
            .catch((_err) => toastStore.showFailureToast("failedToLeaveGroup"));
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

    function loadMessage(ev: CustomEvent<MessageMatch>): void {
        push(`/${ev.detail.chatId}/${ev.detail.eventIndex}`);
        if (ev.detail.chatId === $machine.context.selectedChat?.chatId) {
            machine.send({ type: "GO_TO_EVENT_INDEX", data: ev.detail.eventIndex });
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

    $: editGroupMachine =
        selectedChatActor &&
        ($selectedChatActor.children.editGroupMachine as ActorRefFrom<EditGroupMachine>);

    $: blocked =
        selectedChat !== undefined &&
        selectedChat.kind === "direct_chat" &&
        $blockedUsers.has(selectedChat.them);
</script>

{#if $machine.context.user}
    <main>
        {#if params.chatId == null || $screenWidth !== ScreenWidth.ExtraSmall}
            <LeftPanel
                {machine}
                {groupSearchResults}
                {userSearchResults}
                {messageSearchResults}
                {searchTerm}
                {searchResultsAvailable}
                {searching}
                on:searchEntered={performSearch}
                on:chatWith={chatWith}
                on:logout={logout}
                on:joinGroup={joinGroup}
                on:loadMessage={loadMessage}
                on:newGroup={newGroup}
                on:newchat={newChat} />
        {/if}
        {#if params.chatId != null || $screenWidth !== ScreenWidth.ExtraSmall}
            <MiddlePanel
                loadingChats={$machine.matches("loading_chats")}
                {blocked}
                on:newchat={newChat}
                on:clearSelection={clearSelectedChat}
                on:blockUser={blockUser}
                on:unblockUser={unblockUser}
                on:leaveGroup={leaveGroup}
                on:chatWith={chatWith}
                machine={selectedChatActor} />
        {/if}
    </main>
{/if}

{#if selectedChatActor !== undefined}
    <Overlay active={editGroupMachine !== undefined}>
        {#if editGroupMachine !== undefined && groupChat !== undefined}
            <div
                transition:fly={{ x, duration: 200, easing: sineInOut }}
                class="right-wrapper"
                class:rtl={$rtlStore}>
                <RightPanel
                    machine={editGroupMachine}
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

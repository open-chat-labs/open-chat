<script lang="ts">
    import LeftPanel from "./LeftPanel.svelte";
    import Toast from "../Toast.svelte";
    import MiddlePanel from "./MiddlePanel.svelte";
    import RightPanel from "./RightPanel.svelte";
    import TestModeModal from "../TestModeModal.svelte";
    import ThemePicker from "../ThemePicker.svelte";
    import { fly } from "svelte/transition";
    import { modalStore, ModalType } from "../../stores/modal";
    import Overlay from "../Overlay.svelte";
    import { createEventDispatcher, onDestroy, onMount, tick } from "svelte";
    const dispatch = createEventDispatcher();
    import { rtlStore } from "../../stores/rtl";
    import { ScreenWidth, screenWidth } from "../../stores/screenDimensions";
    import { push, replace } from "svelte-spa-router";
    import { sineInOut } from "svelte/easing";
    import { toastStore } from "../../stores/toast";
    import RemovingGroup from "./RemovingGroup.svelte";
    import type {
        GroupSearchResponse,
        MessageMatch,
        SearchAllMessagesResponse,
    } from "../../domain/search/search";
    import type { UserSummary } from "../../domain/user/user";
    import { blockedUsers } from "../../stores/blockedUsers";
    import { rtcConnectionsManager } from "../../domain/webrtc/RtcConnectionsManager";
    import { userStore } from "../../stores/user";
    import { initNotificationStores } from "../../stores/notifications";
    import type { EditGroupState } from "../../fsm/editGroup";
    import { rollbar } from "../../utils/logging";
    import type {
        ChatSummary,
        EnhancedReplyContext,
        GroupChatSummary,
    } from "../../domain/chat/chat";
    import type { Writable } from "svelte/store";
    import type { HomeController } from "../../fsm/home.controller";
    import { _ } from "svelte-i18n";
    import { mapRemoteData, RemoteData } from "../../utils/remoteData";

    export let controller: HomeController;
    export let params: { chatId: string | null; messageIndex: string | undefined | null } = {
        chatId: null,
        messageIndex: undefined,
    };

    let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    let userSearchResults: Promise<UserSummary[]> | undefined = undefined;
    let messageSearchResults: Promise<SearchAllMessagesResponse> | undefined = undefined;
    let searchTerm: string = "";
    let searching: boolean = false;
    let searchResultsAvailable: boolean = false;
    let removingOperation: "leave" | "delete" = "delete";
    let removingChatId: string | undefined;
    let recommendedGroups: RemoteData<GroupChatSummary[], string> = { kind: "idle" };
    let joining: GroupChatSummary | undefined = undefined;

    $: userId = controller.user.userId;
    $: api = controller.api;
    $: chatsLoading = controller.loading;
    $: chatSummaries = controller.chatSummaries;
    $: chatSummariesList = controller.chatSummariesList;
    $: selectedChat = controller.selectedChat;

    function logout() {
        dispatch("logout");
    }

    onMount(() => {
        // bootstrap anything that needs a service container here
        rtcConnectionsManager.init(controller.user.userId);
        initNotificationStores(api, controller.user!.userId, (n) =>
            controller.notificationReceived(n)
        );
    });

    onDestroy(() => {
        controller.destroy();
    });

    $: {
        // wait until we have loaded the chats
        if (controller.initialised) {
            // if we have a chatid in the params then we need to select that chat
            if (params.chatId && params.chatId !== $selectedChat?.chatId?.toString()) {
                // if the chat in the param is not known to us then we need to attempt to load the
                // chat on the assumption that it is a public group chat that we want to preview
                // if we have an unknown chat in the param, then redirect to home
                const chatId = params.chatId;
                const messageIndex =
                    params.messageIndex == null ? undefined : Number(params.messageIndex);

                if ($chatSummaries[chatId] === undefined) {
                    controller.previewChat(chatId).then((canPreview) => {
                        if (canPreview) {
                            controller.selectChat(chatId, messageIndex);
                        } else {
                            replace("/");
                        }
                    });
                } else {
                    controller.selectChat(chatId, messageIndex);
                }
                recommendedGroups = { kind: "idle" };
            }

            // if there is no chatId param, tell the machine to clear the selection
            if (params.chatId === null && $selectedChat !== undefined) {
                controller.clearSelectedChat();
            }
        }
    }

    function cancelRecommendations() {
        recommendedGroups = { kind: "idle" };
    }

    function dismissRecommendation(ev: CustomEvent<string>) {
        recommendedGroups = mapRemoteData(recommendedGroups, (data) =>
            data.filter((g) => g.chatId !== ev.detail)
        );
    }

    async function performSearch(ev: CustomEvent<string>) {
        searchResultsAvailable = false;
        searchTerm = ev.detail.toLowerCase();
        if (searchTerm !== "") {
            searching = true;
            groupSearchResults = api.searchGroups(searchTerm, 10);
            userSearchResults = api.searchUsers(searchTerm, 10).then((resp) => {
                userStore.addMany(resp);
                return resp;
            });
            messageSearchResults = api.searchAllMessages(searchTerm, 10);
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

    function blockUser(ev: CustomEvent<{ userId: string }>) {
        blockedUsers.add(ev.detail.userId);
        api.blockUserFromDirectChat(ev.detail.userId)
            .then((resp) => {
                if (resp === "success") {
                    toastStore.showSuccessToast("blockUserSucceeded");
                } else {
                    toastStore.showFailureToast("blockUserFailed");
                }
            })
            .catch((err) => {
                toastStore.showFailureToast("blockUserFailed");
                rollbar.error("Error blocking user", err);
                blockedUsers.delete(ev.detail.userId);
            });
    }

    function unblockUser(ev: CustomEvent<{ userId: string }>) {
        blockedUsers.delete(ev.detail.userId);
        api.unblockUserFromDirectChat(ev.detail.userId)
            .then((resp) => {
                if (resp === "success") {
                    toastStore.showSuccessToast("unblockUserSucceeded");
                } else {
                    toastStore.showFailureToast("unblockUserFailed");
                }
            })
            .catch((err) => {
                toastStore.showFailureToast("unblockUserFailed");
                rollbar.error("Error unblocking user", err);
                blockedUsers.add(ev.detail.userId);
            });
    }

    function leaveGroup(ev: CustomEvent<string>) {
        removingOperation = "leave";
        removingChatId = ev.detail;
    }

    function deleteGroup(ev: CustomEvent<string>) {
        removingOperation = "delete";
        removingChatId = ev.detail;
    }

    function chatWith(ev: CustomEvent<string>) {
        const chat = $chatSummariesList.find((c) => {
            return c.kind === "direct_chat" && c.them === ev.detail;
        });
        if (chat) {
            push(`/${chat.chatId}`);
        } else {
            controller.createDirectChat(ev.detail);
        }
    }

    function loadMessage(ev: CustomEvent<MessageMatch>): void {
        if (ev.detail.chatId === $selectedChat?.chatId) {
            controller.goToMessageIndex(ev.detail.messageIndex);
        } else {
            push(`/${ev.detail.chatId}/${ev.detail.messageIndex}`);
        }
    }

    function addParticipants() {
        editGroupHistory = [...editGroupHistory, "add_participants"];
    }

    function replyPrivatelyTo(ev: CustomEvent<EnhancedReplyContext>) {
        controller.replyPrivatelyTo(ev.detail);
    }

    function showParticipants() {
        if ($selectedChat !== undefined) {
            editGroupHistory = [...editGroupHistory, "show_participants"];
            $selectedChat.loadDetails();
        }
    }

    function showGroupDetails() {
        editGroupHistory = [...editGroupHistory, "group_details"];
    }

    function updateChat(ev: CustomEvent<ChatSummary>) {
        controller.replaceChat(ev.detail);
    }

    function joinGroup(ev: CustomEvent<GroupChatSummary>) {
        joining = ev.detail;
        controller
            .joinGroup(ev.detail)
            .then((success) => {
                if (success) {
                    recommendedGroups = { kind: "idle" };
                    push(`/${ev.detail.chatId}`);
                }
            })
            .finally(() => (joining = undefined));
    }

    function cancelPreview(ev: CustomEvent<string>) {
        controller.clearSelectedChat();
        tick().then(() => controller.removeGroup(ev.detail));
    }

    function whatsHot() {
        controller.clearSelectedChat();
        recommendedGroups = { kind: "loading" };
        api.getRecommendedGroups()
            .then((resp) => (recommendedGroups = { kind: "success", data: resp }))
            .catch((err) => (recommendedGroups = { kind: "error", error: err.toString() }));
    }

    $: chat = $selectedChat?.chat;

    $: groupChat =
        chat && $chat && $chat.kind === "group_chat"
            ? (chat as Writable<GroupChatSummary>)
            : undefined;

    $: x = $rtlStore ? -300 : 300;

    let editGroupHistory: EditGroupState[] = [];

    $: blocked = chat && $chat && $chat.kind === "direct_chat" && $blockedUsers.has($chat.them);

    /** SHOW LEFT
     * SmallScreen  |  ChatSelected  |  ShowingRecs  |  ShowLeft
     * ==========================================================
     * F             |  -            |  -            |  T
     * T             |  T            |  -            |  F
     * T             |  F            |  T            |  F
     * T             |  F            |  F            |  T
     */
    $: showLeft =
        $screenWidth !== ScreenWidth.ExtraSmall ||
        ($screenWidth === ScreenWidth.ExtraSmall &&
            params.chatId == null &&
            recommendedGroups.kind === "idle");

    /** SHOW MIDDLE
     * SmallScreen  |  ChatSelected  |  ShowingRecs  |  ShowLeft
     * ==========================================================
     * F             |  -            |  -            |  T
     * T             |  T            |  -            |  T
     * T             |  F            |  T            |  T
     * T             |  F            |  F            |  F
     */
    $: showMiddle =
        $screenWidth !== ScreenWidth.ExtraSmall ||
        ($screenWidth === ScreenWidth.ExtraSmall && params.chatId != null) ||
        ($screenWidth === ScreenWidth.ExtraSmall &&
            params.chatId == null &&
            recommendedGroups.kind !== "idle");
</script>

{#if controller.user}
    <main>
        {#if showLeft}
            <LeftPanel
                {controller}
                {groupSearchResults}
                {userSearchResults}
                {messageSearchResults}
                {searchTerm}
                {searchResultsAvailable}
                {searching}
                on:searchEntered={performSearch}
                on:chatWith={chatWith}
                on:whatsHot={whatsHot}
                on:logout={logout}
                on:loadMessage={loadMessage} />
        {/if}
        {#if showMiddle}
            <MiddlePanel
                {recommendedGroups}
                {joining}
                loadingChats={$chatsLoading}
                blocked={!!blocked}
                on:clearSelection={clearSelectedChat}
                on:blockUser={blockUser}
                on:unblockUser={unblockUser}
                on:leaveGroup={leaveGroup}
                on:deleteGroup={deleteGroup}
                on:chatWith={chatWith}
                on:replyPrivatelyTo={replyPrivatelyTo}
                on:addParticipants={addParticipants}
                on:showGroupDetails={showGroupDetails}
                on:showParticipants={showParticipants}
                on:updateChat={updateChat}
                on:joinGroup={joinGroup}
                on:cancelPreview={cancelPreview}
                on:cancelRecommendations={cancelRecommendations}
                on:recommend={whatsHot}
                on:dismissRecommendation={dismissRecommendation}
                controller={$selectedChat} />
        {/if}
    </main>
{/if}

{#if $selectedChat !== undefined}
    <Overlay active={editGroupHistory.length > 0}>
        {#if editGroupHistory.length > 0 && groupChat}
            <div
                transition:fly={{ x, duration: 200, easing: sineInOut }}
                class="right-wrapper"
                class:rtl={$rtlStore}>
                <RightPanel
                    {api}
                    {userId}
                    controller={$selectedChat}
                    bind:editGroupHistory
                    on:addParticipants={addParticipants}
                    on:showParticipants={showParticipants}
                    on:chatWith={chatWith}
                    on:blockUser={blockUser}
                    on:updateChat={updateChat} />
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

<RemovingGroup
    operation={removingOperation}
    {controller}
    on:removed={() => (removingChatId = undefined)}
    bind:chatId={removingChatId} />

<Toast />

<style type="text/scss">
    main {
        transition: margin ease-in-out 300ms;
        position: relative;
        width: 100%;
        max-width: 1200px;
        display: flex;
        margin: var(--mg);
        @include size-below(lg) {
            margin: 0 auto;
        }
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

<script lang="ts">
    import BackgroundLogo from "../BackgroundLogo.svelte";
    import { number, _ } from "svelte-i18n";
    import LeftPanel from "./LeftPanel.svelte";
    import Toast from "../Toast.svelte";
    import AboutModal from "../AboutModal.svelte";
    import FaqModal from "../FaqModal.svelte";
    import RoadmapModal from "../RoadmapModal.svelte";
    import SelectChatModal from "../SelectChatModal.svelte";
    import MiddlePanel from "./MiddlePanel.svelte";
    import RightPanel from "./RightPanel.svelte";
    import { fly } from "svelte/transition";
    import Overlay from "../Overlay.svelte";
    import { createEventDispatcher, onDestroy, onMount, setContext, tick } from "svelte";
    import { rtlStore } from "../../stores/rtl";
    import {
        dimensions,
        mobileWidth,
        screenWidth,
        ScreenWidth,
    } from "../../stores/screenDimensions";
    import { push, replace, querystring } from "svelte-spa-router";
    import { sineInOut } from "svelte/easing";
    import { toastStore } from "../../stores/toast";
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
    import { filterByChatType, RightPanelState } from "../../fsm/rightPanel";
    import { rollbar } from "../../utils/logging";
    import type {
        ChatSummary,
        EnhancedReplyContext,
        EventWrapper,
        GroupChatSummary,
        Message,
    } from "../../domain/chat/chat";
    import { currentUserKey, HomeController } from "../../fsm/home.controller";
    import { mapRemoteData } from "../../utils/remoteData";
    import type { RemoteData } from "../../utils/remoteData";
    import Upgrade from "./upgrade/Upgrade.svelte";
    import type { Questions } from "../../domain/faq";
    import { apiKey } from "../../services/serviceContainer";
    import type { Share } from "../../domain/share";
    import { draftMessages } from "../../stores/draftMessages";
    import AreYouSure from "../AreYouSure.svelte";
    import { removeQueryStringParam } from "../../utils/urls";
    import { emptyChatMetrics, mergeChatMetrics } from "../../domain/chat/chat.utils";
    import { trackEvent } from "../../utils/tracking";
    import { numberOfColumns, oldLayout } from "../../stores/layout";
    import { messageToForwardStore } from "../../stores/messageToForward";

    const dispatch = createEventDispatcher();

    export let controller: HomeController;
    export let params: { chatId: string | null; messageIndex: string | undefined | null } = {
        chatId: null,
        messageIndex: undefined,
    };

    type ConfirmAction = "leave" | "delete" | "makePrivate";
    type ConfirmActionEvent = {
        kind: ConfirmAction;
        chatId: string;
        doubleCheck: { challenge: string; response: string } | undefined;
    };

    enum ModalType {
        None,
        About,
        Faq,
        Roadmap,
        SelectChat,
    }

    let faqQuestion: Questions | undefined = undefined;
    let modal = ModalType.None;
    let rightPanel: RightPanel;
    setContext(apiKey, controller.api);
    setContext(currentUserKey, controller.user);

    let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    let userSearchResults: Promise<UserSummary[]> | undefined = undefined;
    let messageSearchResults: Promise<SearchAllMessagesResponse> | undefined = undefined;
    let searchTerm: string = "";
    let searching: boolean = false;
    let searchResultsAvailable: boolean = false;
    let confirmActionEvent: ConfirmActionEvent | undefined;
    let recommendedGroups: RemoteData<GroupChatSummary[], string> = { kind: "idle" };
    let joining: GroupChatSummary | undefined = undefined;
    let upgradeStorage: "explain" | "icp" | "sms" | undefined = undefined;
    let share: Share = { title: "", text: "", url: "", files: [] };
    let interruptRecommended = false;
    let rightPanelHistory: RightPanelState[] = [];
    let messageToForward: Message | undefined = undefined;

    $: userId = controller.user.userId;
    $: api = controller.api;
    $: chatsLoading = controller.loading;
    $: chatSummaries = controller.chatSummaries;
    $: chatSummariesList = controller.chatSummariesList;
    $: selectedChat = controller.selectedChat;
    $: wasmVersion = controller.user.wasmVersion;
    $: qs = new URLSearchParams($querystring);
    $: confirmMessage = getConfirmMessage(confirmActionEvent);
    $: combinedMetrics = $chatSummariesList
        .map((c) => c.myMetrics)
        .reduce(mergeChatMetrics, emptyChatMetrics());
    $: chat = $selectedChat?.chat;
    $: x = $rtlStore ? -500 : 500;
    $: rightPanelSlideDuration = $mobileWidth ? 0 : 200;
    $: blocked = chat && $chat && $chat.kind === "direct_chat" && $blockedUsers.has($chat.them);

    /** SHOW LEFT
     * MobileScreen  |  ChatSelected  |  ShowingRecs  |  ShowLeft
     * ==========================================================
     * F             |  -            |  -            |  T
     * T             |  T            |  -            |  F
     * T             |  F            |  T            |  F
     * T             |  F            |  F            |  T
     */
    $: showLeft =
        !$mobileWidth ||
        ($mobileWidth && params.chatId == null && recommendedGroups.kind === "idle");

    /** SHOW MIDDLE
     * SmallScreen  |  ChatSelected  |  ShowingRecs  |  ShowLeft
     * ==========================================================
     * F             |  -            |  -            |  T
     * T             |  T            |  -            |  T
     * T             |  F            |  T            |  T
     * T             |  F            |  F            |  F
     */
    $: showMiddle =
        !$mobileWidth ||
        ($mobileWidth && params.chatId != null) ||
        ($mobileWidth && params.chatId == null && recommendedGroups.kind !== "idle");

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
            if (params.chatId === "share") {
                const local_qs = new URLSearchParams(window.location.search);
                const title = local_qs.get("title") ?? "";
                const text = local_qs.get("text") ?? "";
                const url = local_qs.get("url") ?? "";
                share = {
                    title,
                    text,
                    url,
                    files: [],
                };
                params.chatId = null;
                history.replaceState(null, "", "/#/");
                modal = ModalType.SelectChat;
            }

            // if we have a chatid in the params then we need to select that chat
            if (params.chatId && params.chatId !== $selectedChat?.chatId?.toString()) {
                // if the chat in the param is not known to us then we need to attempt to load the
                // chat on the assumption that it is a group we want to preview
                // if we have an unknown chat in the param, then redirect to home
                const chatId = params.chatId;
                const messageIndex =
                    params.messageIndex == null ? undefined : Number(params.messageIndex);

                if ($chatSummaries[chatId] === undefined) {
                    if (qs.get("type") === "direct") {
                        controller.createDirectChat(chatId);
                    } else {
                        const code = qs.get("code");
                        if (code) {
                            controller.api.groupInvite = {
                                chatId,
                                code,
                            };
                        }

                        recommendedGroups = { kind: "loading" };
                        controller.previewChat(chatId).then((canPreview) => {
                            if (canPreview) {
                                controller.selectChat(chatId, messageIndex);
                                resetRightPanel();
                                recommendedGroups = { kind: "idle" };
                            } else {
                                replace("/");
                            }
                        });
                    }
                } else {
                    recommendedGroups = { kind: "idle" };
                    interruptRecommended = true;
                    controller.selectChat(chatId, messageIndex);
                    resetRightPanel();
                }
            }

            if (
                params.chatId &&
                params.messageIndex &&
                params.chatId === $selectedChat?.chatId?.toString()
            ) {
                $selectedChat?.goToMessageIndex(Number(params.messageIndex), false);
            }

            const faq = qs.get("faq");
            if (faq !== null) {
                faqQuestion = faq as Questions;
                modal = ModalType.Faq;
                replace(removeQueryStringParam(qs, "faq"));
            }

            // if there is no chatId param, tell the machine to clear the selection
            if (params.chatId === null && $selectedChat !== undefined) {
                controller.clearSelectedChat();
            }

            if (params.chatId === null && !$mobileWidth && recommendedGroups.kind === "idle") {
                whatsHot();
            }
        }
    }

    function resetRightPanel() {
        rightPanelHistory = filterByChatType(rightPanelHistory, $selectedChat?.chatVal);
    }
    function userAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>): void {
        controller.updateUserAvatar({
            blobData: ev.detail.data,
            blobUrl: ev.detail.url,
        });
    }

    function goToMessageIndex(ev: CustomEvent<{ index: number; preserveFocus: boolean }>) {
        $selectedChat?.goToMessageIndex(ev.detail.index, ev.detail.preserveFocus);
    }

    function closeModal() {
        modal = ModalType.None;
    }

    function cancelRecommendations() {
        recommendedGroups = { kind: "idle" };
    }

    function dismissRecommendation(ev: CustomEvent<string>) {
        recommendedGroups = mapRemoteData(recommendedGroups, (data) =>
            data.filter((g) => g.chatId !== ev.detail)
        );
        api.dismissRecommendation(ev.detail);
    }

    function showFaqQuestion(ev: CustomEvent<Questions>) {
        faqQuestion = ev.detail;
        modal = ModalType.Faq;
    }

    async function performSearch(ev: CustomEvent<string>) {
        searchResultsAvailable = false;
        searchTerm = ev.detail;
        if (searchTerm !== "") {
            searching = true;
            const lowercase = searchTerm.toLowerCase();
            groupSearchResults = api.searchGroups(lowercase, 10);
            userSearchResults = api.searchUsers(lowercase, 10).then((resp) => {
                userStore.addMany(resp);
                return resp;
            });
            messageSearchResults = api.searchAllMessages(lowercase, 10);
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

    function getConfirmMessage(confirmActionEvent: ConfirmActionEvent | undefined): string {
        if (confirmActionEvent === undefined) return "";

        switch (confirmActionEvent.kind) {
            case "leave":
                return $_("confirmLeaveGroup");
            case "delete":
                return $_("irreversible");
            case "makePrivate":
                return $_("confirmMakeGroupPrivate");
        }
    }

    function triggerConfirm(ev: CustomEvent<ConfirmActionEvent>) {
        confirmActionEvent = ev.detail;
    }

    function onConfirmAction(yes: boolean): Promise<void> {
        const result = yes ? doConfirmAction(confirmActionEvent!) : Promise.resolve();

        return result.finally(() => {
            confirmActionEvent = undefined;
        });
    }

    function doConfirmAction(confirmActionEvent: ConfirmActionEvent): Promise<void> {
        switch (confirmActionEvent.kind) {
            case "leave":
                return controller.leaveGroup(confirmActionEvent.chatId);
            case "delete":
                return controller.deleteGroup(confirmActionEvent.chatId).then((_) => {
                    rightPanelHistory = [];
                });
            case "makePrivate":
                return controller.makeGroupPrivate(confirmActionEvent.chatId).then((_) => {
                    rightPanelHistory = [];
                });
            default:
                return Promise.reject();
        }
    }

    function deleteDirectChat(ev: CustomEvent<string>) {
        if (ev.detail === params.chatId) {
            controller.clearSelectedChat();
        }
        tick().then(() => controller.removeChat(ev.detail));
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
        if ($selectedChat !== undefined) {
            rightPanelHistory = [...rightPanelHistory, { kind: "add_participants" }];
        }
    }

    function replyPrivatelyTo(ev: CustomEvent<EnhancedReplyContext>) {
        controller.replyPrivatelyTo(ev.detail);
    }

    function forwardMessage(ev: CustomEvent<Message>) {
        messageToForward = ev.detail;
        modal = ModalType.SelectChat;
    }

    function showParticipants() {
        if ($selectedChat !== undefined) {
            rightPanelHistory = [...rightPanelHistory, { kind: "show_participants" }];
        }
    }

    function showProfile() {
        rightPanelHistory = [{ kind: "user_profile" }];
        tick().then(() => rightPanel?.showProfile());
    }

    function replyInThread(ev: CustomEvent<EventWrapper<Message>>) {
        if ($selectedChat !== undefined) {
            rightPanelHistory = [
                {
                    kind: "message_thread_panel",
                    root: ev.detail,
                },
            ];
        }
    }

    function showGroupDetails() {
        if ($selectedChat !== undefined) {
            rightPanelHistory = [
                {
                    kind: "group_details",
                },
            ];
        }
    }

    function updateChat(ev: CustomEvent<ChatSummary>) {
        controller.addOrReplaceChat(ev.detail);
    }

    function showPinned() {
        if ($selectedChat !== undefined) {
            rightPanelHistory = [
                {
                    kind: "show_pinned",
                },
            ];
        }
    }

    function joinGroup(ev: CustomEvent<{ group: GroupChatSummary; select: boolean }>) {
        joining = ev.detail.group;
        controller
            .joinGroup(joining)
            .then((success) => {
                if (success && ev.detail.select) {
                    recommendedGroups = { kind: "idle" };
                    push(`/${ev.detail.group.chatId}`);
                }
            })
            .finally(() => (joining = undefined));
    }

    function cancelPreview(ev: CustomEvent<string>) {
        controller.clearSelectedChat();
        tick().then(() => {
            controller.removeChat(ev.detail);
        });
    }

    function whatsHot() {
        controller.clearSelectedChat();
        tick().then(() => {
            interruptRecommended = false;
            recommendedGroups = { kind: "loading" };
            api.getRecommendedGroups((_n: number) => interruptRecommended)
                .then((resp) => (recommendedGroups = { kind: "success", data: resp }))
                .catch((err) => (recommendedGroups = { kind: "error", error: err.toString() }));
        });
    }

    function upgrade(ev: CustomEvent<"explain" | "icp" | "sms">) {
        upgradeStorage = ev.detail;
    }

    function onSelectChat(ev: CustomEvent<string>) {
        closeModal();
        if (messageToForward !== undefined) {
            forwardToChat(ev.detail);
            messageToForward = undefined;
        } else {
            shareWithChat(ev.detail);
        }
    }

    function onCloseSelectChat() {
        closeModal();
        messageToForward = undefined;
    }

    function forwardToChat(chatId: string) {
        push(`/${chatId}`);
        messageToForwardStore.set(messageToForward);
    }

    function shareWithChat(chatId: string) {
        push(`/${chatId}`);

        const shareText = share.text ?? "";
        const shareTitle = share.title ?? "";
        const shareUrl = share.url ?? "";

        let text = shareText.length > 0 ? shareText : shareTitle;

        if (shareUrl.length > 0) {
            if (text.length > 0) {
                text += "\n";
            }
            text += shareUrl;
        }

        draftMessages.setTextContent(chatId, text);
    }

    function groupCreated(ev: CustomEvent<GroupChatSummary>) {
        controller.addOrReplaceChat(ev.detail);
        if (ev.detail.public) {
            trackEvent("public_group_created");
        } else {
            trackEvent("private_group_created");
        }
        rightPanelHistory =
            $screenWidth === ScreenWidth.ExtraExtraLarge
                ? [
                      {
                          kind: "group_details",
                      },
                  ]
                : [];
    }

    function newGroup() {
        rightPanelHistory = [...rightPanelHistory, { kind: "new_group_panel" }];
    }

    $: bgHeight = $dimensions.height * 0.9;
    $: bgClip = (($dimensions.height - 32) / bgHeight) * 361;
</script>

{#if controller.user}
    <main class:old-layout={oldLayout}>
        {#if showLeft}
            <LeftPanel
                {controller}
                {groupSearchResults}
                {userSearchResults}
                {messageSearchResults}
                {searchTerm}
                {searchResultsAvailable}
                {searching}
                on:showAbout={() => (modal = ModalType.About)}
                on:showFaq={() => (modal = ModalType.Faq)}
                on:showFaqQuestion={showFaqQuestion}
                on:showRoadmap={() => (modal = ModalType.Roadmap)}
                on:searchEntered={performSearch}
                on:userAvatarSelected={userAvatarSelected}
                on:chatWith={chatWith}
                on:whatsHot={whatsHot}
                on:newGroup={newGroup}
                on:profile={showProfile}
                on:logout={logout}
                on:deleteDirectChat={deleteDirectChat}
                on:loadMessage={loadMessage} />
        {/if}
        {#if showMiddle}
            <MiddlePanel
                {recommendedGroups}
                {joining}
                loadingChats={$chatsLoading}
                blocked={!!blocked}
                controller={$selectedChat}
                on:clearSelection={clearSelectedChat}
                on:blockUser={blockUser}
                on:unblockUser={unblockUser}
                on:leaveGroup={triggerConfirm}
                on:chatWith={chatWith}
                on:replyPrivatelyTo={replyPrivatelyTo}
                on:addParticipants={addParticipants}
                on:showGroupDetails={showGroupDetails}
                on:replyInThread={replyInThread}
                on:showParticipants={showParticipants}
                on:updateChat={updateChat}
                on:joinGroup={joinGroup}
                on:cancelPreview={cancelPreview}
                on:cancelRecommendations={cancelRecommendations}
                on:recommend={whatsHot}
                on:dismissRecommendation={dismissRecommendation}
                on:upgrade={upgrade}
                on:showPinned={showPinned}
                on:goToMessageIndex={goToMessageIndex}
                on:forward={forwardMessage} />
        {/if}
        {#if $numberOfColumns === 3}
            <RightPanel
                {userId}
                controller={$selectedChat}
                metrics={combinedMetrics}
                bind:this={rightPanel}
                bind:rightPanelHistory
                on:userAvatarSelected={userAvatarSelected}
                on:goToMessageIndex={goToMessageIndex}
                on:addParticipants={addParticipants}
                on:showParticipants={showParticipants}
                on:chatWith={chatWith}
                on:upgrade={upgrade}
                on:blockUser={blockUser}
                on:deleteGroup={triggerConfirm}
                on:makeGroupPrivate={triggerConfirm}
                on:updateChat={updateChat}
                on:groupCreated={groupCreated} />
        {/if}
    </main>
{/if}

{#if $numberOfColumns === 2 && rightPanelHistory.length > 0}
    <Overlay fade={!$mobileWidth}>
        <div
            transition:fly={{ x, duration: rightPanelSlideDuration, easing: sineInOut }}
            class="right-wrapper"
            class:rtl={$rtlStore}>
            <RightPanel
                {userId}
                controller={$selectedChat}
                metrics={combinedMetrics}
                bind:this={rightPanel}
                bind:rightPanelHistory
                on:userAvatarSelected={userAvatarSelected}
                on:goToMessageIndex={goToMessageIndex}
                on:addParticipants={addParticipants}
                on:showParticipants={showParticipants}
                on:chatWith={chatWith}
                on:upgrade={upgrade}
                on:blockUser={blockUser}
                on:deleteGroup={triggerConfirm}
                on:makeGroupPrivate={triggerConfirm}
                on:updateChat={updateChat}
                on:groupCreated={groupCreated} />
        </div>
    </Overlay>
{/if}

{#if confirmActionEvent !== undefined}
    <AreYouSure
        doubleCheck={confirmActionEvent.doubleCheck}
        message={confirmMessage}
        action={onConfirmAction} />
{/if}

<Toast />

{#if upgradeStorage && controller.user}
    <Upgrade
        user={controller.user}
        {api}
        step={upgradeStorage}
        on:showFaqQuestion={showFaqQuestion}
        on:cancel={() => (upgradeStorage = undefined)} />
{/if}

{#if modal !== ModalType.None}
    <Overlay
        dismissible={modal !== ModalType.SelectChat}
        alignLeft={modal === ModalType.SelectChat}
        on:close={closeModal}>
        {#if modal === ModalType.Faq}
            <FaqModal bind:question={faqQuestion} on:close={closeModal} />
        {:else if modal === ModalType.Roadmap}
            <RoadmapModal on:close={closeModal} />
        {:else if modal === ModalType.About}
            <AboutModal canister={{ id: userId, wasmVersion }} on:close={closeModal} />
        {:else if modal === ModalType.SelectChat}
            <SelectChatModal
                chatsSummaries={$chatSummariesList}
                on:close={onCloseSelectChat}
                on:select={onSelectChat} />
        {/if}
    </Overlay>
{/if}

<BackgroundLogo
    width={`${bgHeight}px`}
    bottom={"unset"}
    left={"0"}
    opacity={"0.1"}
    skew={"5deg"}
    viewBox={`0 0 361 ${bgClip}`} />

<style type="text/scss">
    :global(.edited-msg) {
        @include font(light, normal, fs-70);
    }

    main {
        transition: max-width ease-in-out 150ms;
        position: relative;
        width: 100%;
        display: flex;
        gap: $sp3;
        margin: 0 auto;

        &:not(.old-layout) {
            max-width: 1400px;
            @include size-above(xl) {
                max-width: 1792px;
            }
        }

        &.old-layout {
            max-width: 1600px;
            @include size-below(xl) {
                max-width: 1400px;
            }
        }
    }
    :global(body) {
        transition: color ease-in-out 150ms, padding ease-in-out 150ms;
        padding: $sp4;
        --background-color: var(--theme-background);
        --text-color: var(--theme-text);
        color: var(--theme-text);

        @include size-below(lg) {
            padding: $sp3;
        }

        @include mobile() {
            padding: 0;
        }
    }

    :global(body.fill) {
        transition: none;
        padding: 0;
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
        @include mobile() {
            width: 100%;
        }
    }
</style>

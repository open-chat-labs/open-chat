<script lang="ts">
    import BackgroundLogo from "../BackgroundLogo.svelte";
    import { _ } from "svelte-i18n";
    import LeftPanel from "./LeftPanel.svelte";
    import type CurrentChatMessages from "./CurrentChatMessages.svelte";
    import Toast from "../Toast.svelte";
    import FaqModal from "../FaqModal.svelte";
    import SelectChatModal from "../SelectChatModal.svelte";
    import MiddlePanel from "./MiddlePanel.svelte";
    import RightPanel from "./RightPanel.svelte";
    import { fly } from "svelte/transition";
    import {
        GroupSearchResponse,
        MessageMatch,
        SearchAllMessagesResponse,
        UserSummary,
        ChatSummary,
        EnhancedReplyContext,
        GroupChatSummary,
        GroupRules,
        Message,
        Questions,
        WebRtcMessage,
        OpenChat,
        ThreadSelected,
        ThreadClosed,
    } from "openchat-client";
    import Overlay from "../Overlay.svelte";
    import { getContext, onMount, tick } from "svelte";
    import { rtlStore } from "../../stores/rtl";
    import {
        dimensions,
        mobileWidth,
        screenWidth,
        ScreenWidth,
    } from "../../stores/screenDimensions";
    import { push, replace, querystring } from "svelte-spa-router";
    import { pathParams } from "../../stores/routing";
    import type { RouteParams } from "../../stores/routing";
    import { sineInOut } from "svelte/easing";
    import { toastStore } from "../../stores/toast";
    import { fullScreen } from "../../stores/settings";
    import { closeNotificationsForChat, subscribeToNotifications } from "../../utils/notifications";
    import { filterByChatType, RightPanelState } from "./rightPanel";
    import { mapRemoteData } from "../../utils/remoteData";
    import type { RemoteData } from "../../utils/remoteData";
    import Upgrade from "./upgrade/Upgrade.svelte";
    import AreYouSure from "../AreYouSure.svelte";
    import { removeQueryStringParam } from "../../utils/urls";
    import { numberOfColumns } from "../../stores/layout";
    import { messageToForwardStore } from "../../stores/messageToForward";
    import type Thread from "./thread/Thread.svelte";
    import type { Share } from "../../utils/share";

    export let logout: () => void;

    const client = getContext<OpenChat>("client");
    const user = client.user;

    type ConfirmActionEvent =
        | ConfirmLeaveEvent
        | ConfirmDeleteEvent
        | ConfirmMakePrivateEvent
        | ConfirmRulesEvent;

    interface ConfirmLeaveEvent {
        kind: "leave";
        chatId: string;
    }

    interface ConfirmDeleteEvent {
        kind: "delete";
        chatId: string;
        doubleCheck: { challenge: string; response: string };
    }

    interface ConfirmMakePrivateEvent {
        kind: "makePrivate";
        chatId: string;
    }

    interface ConfirmRulesEvent {
        kind: "rules";
        group: GroupChatSummary;
        select: boolean;
        rules: string;
    }

    enum ModalType {
        None,
        Faq,
        SelectChat,
    }

    let faqQuestion: Questions | undefined = undefined;
    let modal = ModalType.None;
    let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    let userSearchResults: Promise<UserSummary[]> | undefined = undefined;
    let messageSearchResults: Promise<SearchAllMessagesResponse> | undefined = undefined;
    let searchTerm: string = "";
    let searching: boolean = false;
    let searchResultsAvailable: boolean = false;
    let confirmActionEvent: ConfirmActionEvent | undefined;
    let hotGroups: RemoteData<GroupChatSummary[], string> = { kind: "idle" };
    let joining: GroupChatSummary | undefined = undefined;
    let upgradeStorage: "explain" | "icp" | "sms" | undefined = undefined;
    let share: Share = { title: "", text: "", url: "", files: [] };
    let interruptRecommended = false;
    let rightPanelHistory: RightPanelState[] = [];
    let messageToForward: Message | undefined = undefined;
    let creatingThread = false;
    let threadComponent: Thread | undefined;
    let currentChatMessages: CurrentChatMessages | undefined;

    $: userStore = client.userStore;
    $: unconfirmed = client.unconfirmed;
    $: chatSummariesListStore = client.chatSummariesListStore;
    $: chatSummariesStore = client.chatSummariesStore;
    $: chatsLoading = client.chatsLoading;
    $: selectedChatStore = client.selectedChatStore;
    $: selectedChatId = client.selectedChatId;
    $: chatsInitialised = client.chatsInitialised;
    $: currentChatDraftMessage = client.currentChatDraftMessage;
    $: chatStateStore = client.chatStateStore;
    $: qs = new URLSearchParams($querystring);
    $: confirmMessage = getConfirmMessage(confirmActionEvent);
    $: x = $rtlStore ? -500 : 500;
    $: rightPanelSlideDuration = $mobileWidth ? 0 : 200;

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
        ($mobileWidth && $pathParams.chatId === undefined && hotGroups.kind === "idle");

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
        ($mobileWidth && $pathParams.chatId !== undefined) ||
        ($mobileWidth && $pathParams.chatId === undefined && hotGroups.kind !== "idle");

    onMount(() => {
        client.initWebRtc((msg) => routeRtcMessages(msg as WebRtcMessage));
        subscribeToNotifications(client, (n) => client.notificationReceived(n));
        client.addEventListener("openchat_event", clientEvent);

        return () => {
            client.removeEventListener("openchat_event", clientEvent);
        };
    });

    function clientEvent(ev: Event): void {
        if (ev instanceof ThreadSelected) {
            openThread(ev.detail);
        }
        if (ev instanceof ThreadClosed) {
            closeThread();
        }
    }

    function routeRtcMessages(msg: WebRtcMessage) {
        const fromChatId = client.filterWebRtcMessage(msg);
        if (fromChatId === undefined) return;
        const parsedMsg = client.parseWebRtcMessage(fromChatId, msg);

        if (parsedMsg.threadRootMessageIndex !== undefined) {
            // do we have the thread window open for this thread
            threadComponent?.handleWebRtcMessage(fromChatId, parsedMsg);
        } else {
            if (client.delegateToChatComponent(parsedMsg)) {
                currentChatMessages?.handleWebRtcMessage(fromChatId, parsedMsg);
            } else {
                if (parsedMsg.kind === "remote_user_sent_message") {
                    unconfirmed.add(parsedMsg.chatId, parsedMsg.messageEvent);
                }
            }
        }
    }

    async function newChatSelected(chatId: string, messageIndex?: number): Promise<void> {
        interruptRecommended = true;

        let chat = $chatSummariesStore[chatId];

        // if this is an unknown chat let's preview it
        if (chat === undefined) {
            if (qs.get("type") === "direct") {
                client.createDirectChat(chatId);
                push(`/${chatId}`);
                hotGroups = { kind: "idle" };
                return;
            } else {
                const code = qs.get("code");
                if (code) {
                    client.api.groupInvite = {
                        chatId,
                        code,
                    };
                }
                if (!(await client.previewChat(chatId))) {
                    replace("/");
                    return;
                }

                chat = $chatSummariesStore[chatId];
            }
        }

        // If an archived chat has been explicitly selected (for example by searching for it) then un-archive it
        if (chat.archived) {
            unarchiveChat(chat.chatId);
        }

        // if it's a known chat let's select it
        closeNotificationsForChat(chat.chatId);
        client.setSelectedChat(chat, messageIndex);
        resetRightPanel();
        hotGroups = { kind: "idle" };
    }

    // extracting to a function to try to control more tightly what this reacts to
    function routeChange(initialised: boolean, pathParams: RouteParams): void {
        // wait until we have loaded the chats
        if (initialised) {
            if (pathParams.chatId === "threads") {
                closeThread();
                client.clearSelectedChat();
                hotGroups = { kind: "idle" };
            } else if (pathParams.chatId === "share") {
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
                history.replaceState(null, "", "/#/");
                modal = ModalType.SelectChat;
            } else {
                // if we have something in the chatId url param

                // first close any open thread
                closeThread();

                if (pathParams.chatId !== undefined) {
                    // if the chat in the url is different from the chat we already have selected
                    if (pathParams.chatId !== $selectedChatId?.toString()) {
                        newChatSelected(pathParams.chatId, pathParams.messageIndex);
                    } else {
                        // if the chat in the url is *the same* as the selected chat
                        // *and* if we have a messageIndex specified in the url
                        if (pathParams.messageIndex !== undefined) {
                            currentChatMessages?.scrollToMessageIndex(
                                pathParams.messageIndex,
                                false,
                                true
                            );
                        }
                    }
                } else {
                    // we do *not* have a chat in the url
                    if ($selectedChatId !== undefined) {
                        client.clearSelectedChat();
                    }

                    if (!$mobileWidth && hotGroups.kind === "idle") {
                        whatsHot(false);
                    }

                    filterChatSpecificRightPanelStates();
                }

                // regardless of the path params, we *always* check the query string
                const faq = qs.get("faq");
                if (faq !== null) {
                    faqQuestion = faq as Questions;
                    modal = ModalType.Faq;
                    replace(removeQueryStringParam(qs, "faq"));
                }
            }
        }
    }

    $: {
        routeChange($chatsInitialised, $pathParams);
    }

    // Note: very important (and hacky) that this is hidden in a function rather than inline in the top level reactive
    // statement because we don't want that reactive statement to execute in reponse to changes in rightPanelHistory :puke:
    function filterChatSpecificRightPanelStates() {
        rightPanelHistory = rightPanelHistory.filter(
            (panel) => panel.kind === "user_profile" || panel.kind === "new_group_panel"
        );
    }

    function closeThread() {
        if (creatingThread) {
            creatingThread = false;
            return;
        }
        rightPanelHistory = rightPanelHistory.filter(
            (panel) => panel.kind !== "message_thread_panel"
        );
    }

    function resetRightPanel() {
        rightPanelHistory = filterByChatType(rightPanelHistory, $selectedChatStore);
    }

    function userAvatarSelected(ev: CustomEvent<{ data: Uint8Array }>): void {
        client.setUserAvatar(ev.detail.data).then((success) => {
            if (success) {
                toastStore.showSuccessToast("avatarUpdated");
            } else {
                toastStore.showFailureToast("avatarUpdateFailed");
            }
        });
    }

    function goToMessageIndex(ev: CustomEvent<{ index: number; preserveFocus: boolean }>) {
        currentChatMessages?.scrollToMessageIndex(ev.detail.index, ev.detail.preserveFocus);
    }

    function closeModal() {
        modal = ModalType.None;
    }

    function cancelRecommendations() {
        hotGroups = { kind: "idle" };
    }

    function dismissRecommendation(ev: CustomEvent<string>) {
        hotGroups = mapRemoteData(hotGroups, (data) => data.filter((g) => g.chatId !== ev.detail));
        client.api.dismissRecommendation(ev.detail);
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
            groupSearchResults = client.api.searchGroups(lowercase, 10);
            userSearchResults = client.api.searchUsers(lowercase, 10).then((resp) => {
                userStore.addMany(resp);
                return resp;
            });
            messageSearchResults = client.api.searchAllMessages(lowercase, 10);
            try {
                await Promise.all([
                    groupSearchResults,
                    userSearchResults,
                    messageSearchResults,
                ]).then(() => {
                    if (searchTerm !== "") {
                        searchResultsAvailable = true;
                        searching = false;
                    } else {
                        clearSearch();
                    }
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

    function blockUser(ev: CustomEvent<{ userId: string }>) {
        client.blockUserFromDirectChat(ev.detail.userId).then((success) => {
            if (success) {
                toastStore.showSuccessToast("blockUserSucceeded");
            } else {
                toastStore.showFailureToast("blockUserFailed");
            }
        });
    }

    function unblockUser(ev: CustomEvent<{ userId: string }>) {
        client.unblockUserFromDirectChat(ev.detail.userId).then((success) => {
            if (success) {
                toastStore.showSuccessToast("unblockUserSucceeded");
            } else {
                toastStore.showFailureToast("unblockUserFailed");
            }
        });
    }

    function pinChat(ev: CustomEvent<string>) {
        client.pinChat(ev.detail).then((resp) => {
            if (resp.kind === "limit_exceeded") {
                toastStore.showSuccessToast("pinChat.limitExceeded", {
                    values: { limit: resp.limit },
                });
            } else if (resp.kind === "failure") {
                toastStore.showFailureToast("pinChat.failed");
            }
        });
    }

    function unpinChat(ev: CustomEvent<string>) {
        client.unpinChat(ev.detail).then((success) => {
            if (!success) {
                toastStore.showFailureToast("pinChat.unpinFailed");
            }
        });
    }

    function onArchiveChat(ev: CustomEvent<string>) {
        client.archiveChat(ev.detail).then((success) => {
            if (!success) {
                toastStore.showFailureToast("archiveChatFailed");
            }
        });
        if (ev.detail === $selectedChatId) {
            push("/");
        }
    }

    function onUnarchiveChat(ev: CustomEvent<string>) {
        unarchiveChat(ev.detail);
    }

    function unarchiveChat(chatId: string) {
        client.unarchiveChat(chatId).then((success) => {
            if (!success) {
                toastStore.showFailureToast("unarchiveChatFailed");
            }
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
            case "rules": {
                return confirmActionEvent.rules;
            }
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
                return leaveGroup(confirmActionEvent.chatId);
            case "delete":
                return deleteGroup(confirmActionEvent.chatId).then((_) => {
                    rightPanelHistory = [];
                });
            case "makePrivate":
                return makeGroupPrivate(confirmActionEvent.chatId).then((_) => {
                    rightPanelHistory = [];
                });
            case "rules":
                return doJoinGroup(confirmActionEvent.group, confirmActionEvent.select);
            default:
                return Promise.reject();
        }
    }

    function makeGroupPrivate(chatId: string): Promise<void> {
        return client.makeGroupPrivate(chatId).then((success) => {
            if (!success) {
                toastStore.showFailureToast("makeGroupPrivateFailed");
            }
        });
    }

    function deleteGroup(chatId: string): Promise<void> {
        push("/");
        return client.deleteGroup(chatId).then((success) => {
            if (success) {
                toastStore.showSuccessToast("deleteGroupSuccess");
            } else {
                toastStore.showFailureToast("deleteGroupFailure");
                push(`/${chatId}`);
            }
        });
    }

    function leaveGroup(chatId: string): Promise<void> {
        push("/");

        return client.leaveGroup(chatId).then((resp) => {
            if (resp === "success") {
                toastStore.showSuccessToast("leftGroup");
            } else {
                if (resp === "owner_cannot_leave") {
                    toastStore.showFailureToast("ownerCantLeave");
                } else {
                    toastStore.showFailureToast("failedToLeaveGroup");
                }
                push(`/${chatId}`);
            }
        });
    }

    function deleteDirectChat(ev: CustomEvent<string>) {
        if (ev.detail === $pathParams.chatId) {
            push("/");
        }
        tick().then(() => client.removeChat(ev.detail));
    }

    function chatWith(ev: CustomEvent<string>) {
        const chat = $chatSummariesListStore.find((c) => {
            return c.kind === "direct_chat" && c.them === ev.detail;
        });
        if (chat) {
            push(`/${chat.chatId}`);
        } else {
            client.createDirectChat(ev.detail);
            push(`/${ev.detail}`);
        }
    }

    function loadMessage(ev: CustomEvent<MessageMatch>): void {
        if (ev.detail.chatId === $selectedChatId) {
            currentChatMessages?.externalGoToMessage(ev.detail.messageIndex);
        } else {
            push(`/${ev.detail.chatId}/${ev.detail.messageIndex}`);
        }
    }

    function addMembers() {
        if ($selectedChatId !== undefined) {
            rightPanelHistory = [...rightPanelHistory, { kind: "add_members" }];
        }
    }

    function replyPrivatelyTo(ev: CustomEvent<EnhancedReplyContext>) {
        const chat = $chatSummariesListStore.find((c) => {
            return c.kind === "direct_chat" && c.them === ev.detail.sender?.userId;
        });
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const chatId = chat?.chatId ?? ev.detail.sender!.userId;
        currentChatDraftMessage.setTextContent(chatId, "");
        currentChatDraftMessage.setReplyingTo(chatId, ev.detail);
        if (chat) {
            push(`/${chat.chatId}`);
        } else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            client.createDirectChat(ev.detail.sender!.userId);
            push(`/${ev.detail.sender!.userId}`);
        }
    }

    function forwardMessage(ev: CustomEvent<Message>) {
        messageToForward = ev.detail;
        modal = ModalType.SelectChat;
    }

    function showMembers() {
        if ($selectedChatId !== undefined) {
            rightPanelHistory = [...rightPanelHistory, { kind: "show_members" }];
        }
    }

    function showProfile() {
        if ($selectedChatId !== undefined) {
            replace(`/${$selectedChatId}`);
        }
        rightPanelHistory = [{ kind: "user_profile" }];
    }

    function openThread(ev: { threadRootMessageId: bigint; initiating: boolean }) {
        if ($selectedChatId !== undefined) {
            if (ev.initiating) {
                creatingThread = true;
                replace(`/${$selectedChatId}`);
            }
            rightPanelHistory = [
                {
                    kind: "message_thread_panel",
                    threadRootMessageId: ev.threadRootMessageId,
                },
            ];
        }
    }

    function showGroupDetails() {
        if ($selectedChatId !== undefined) {
            replace(`/${$selectedChatId}`);
            rightPanelHistory = [
                {
                    kind: "group_details",
                },
            ];
        }
    }

    function showProposalFilters() {
        if ($selectedChatId !== undefined) {
            replace(`/${$selectedChatId}`);
            rightPanelHistory = [
                {
                    kind: "proposal_filters",
                },
            ];
        }
    }

    function updateChat(ev: CustomEvent<ChatSummary>) {
        client.addOrReplaceChat(ev.detail);
    }

    function showPinned() {
        if ($selectedChatId !== undefined) {
            replace(`/${$selectedChatId}`);
            rightPanelHistory = [
                {
                    kind: "show_pinned",
                },
            ];
        }
    }

    async function joinGroup(
        ev: CustomEvent<{ group: GroupChatSummary; select: boolean }>
    ): Promise<void> {
        const { group, select } = ev.detail;

        const rules = await client.api.getGroupRules(group.chatId);

        if (rules === undefined) {
            toastStore.showFailureToast("group.getRulesFailed");
            return;
        }

        if (!rules.enabled) {
            doJoinGroup(group, select);
        } else {
            confirmActionEvent = {
                kind: "rules",
                group,
                select,
                rules: rules.text,
            };
        }
    }

    async function doJoinGroup(group: GroupChatSummary, select: boolean): Promise<void> {
        joining = group;
        return client
            .joinGroup(group)
            .then((resp) => {
                if (resp === "blocked") {
                    toastStore.showFailureToast("youreBlocked");
                } else if (resp === "failure") {
                    toastStore.showFailureToast("joinGroupFailed");
                } else if (select) {
                    hotGroups = { kind: "idle" };
                    push(`/${group.chatId}`);
                }
            })
            .finally(() => (joining = undefined));
    }

    function cancelPreview(ev: CustomEvent<string>) {
        push("/");
        tick().then(() => {
            client.removeChat(ev.detail);
        });
    }

    function whatsHot(navigate: boolean = true) {
        if (navigate) {
            push("/");
        }
        tick().then(() => {
            interruptRecommended = false;
            hotGroups = { kind: "loading" };
            client.api
                .getRecommendedGroups((_n: number) => interruptRecommended)
                .then((resp) => (hotGroups = { kind: "success", data: resp }))
                .catch((err) => (hotGroups = { kind: "error", error: err.toString() }));
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

        currentChatDraftMessage.setTextContent(chatId, text);
    }

    function groupCreated(ev: CustomEvent<{ group: GroupChatSummary; rules: GroupRules }>) {
        const { group, rules } = ev.detail;
        chatStateStore.setProp(group.chatId, "rules", rules);
        client.addOrReplaceChat(group);
        if (group.public) {
            client.trackEvent("public_group_created");
        } else {
            client.trackEvent("private_group_created");
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

    function filterChatSelection(
        chats: ChatSummary[],
        selectedChatId: string | undefined
    ): ChatSummary[] {
        return chats.filter(
            (c) => selectedChatId !== c.chatId && client.canSendMessages(c, $userStore)
        );
    }

    function toggleMuteNotifications(ev: CustomEvent<{ chatId: string; mute: boolean }>) {
        const op = ev.detail.mute ? "muted" : "unmuted";
        client.toggleMuteNotifications(ev.detail.chatId, ev.detail.mute).then((success) => {
            if (!success) {
                toastStore.showFailureToast("toggleMuteNotificationsFailed", {
                    values: { operation: $_(op) },
                });
            }
        });
    }

    function showLandingPageRoute(route: string) {
        return () => (window.location.href = route);
    }

    $: bgHeight = $dimensions.height * 0.9;
    $: bgClip = (($dimensions.height - 32) / bgHeight) * 361;
</script>

<main class:fullscreen={$fullScreen}>
    {#if showLeft}
        <LeftPanel
            {groupSearchResults}
            {userSearchResults}
            {messageSearchResults}
            {searchTerm}
            {searchResultsAvailable}
            {searching}
            on:showAbout={showLandingPageRoute("/home")}
            on:showFaq={() => (modal = ModalType.Faq)}
            on:showRoadmap={showLandingPageRoute("/roadmap")}
            on:showArchitecture={showLandingPageRoute("/architecture")}
            on:showFeatures={showLandingPageRoute("/features")}
            on:showWhitepaper={showLandingPageRoute("whitepaper")}
            on:searchEntered={performSearch}
            on:userAvatarSelected={userAvatarSelected}
            on:chatWith={chatWith}
            on:whatsHot={() => whatsHot(true)}
            on:newGroup={newGroup}
            on:profile={showProfile}
            on:logout={logout}
            on:deleteDirectChat={deleteDirectChat}
            on:pinChat={pinChat}
            on:unpinChat={unpinChat}
            on:archiveChat={onArchiveChat}
            on:unarchiveChat={onUnarchiveChat}
            on:toggleMuteNotifications={toggleMuteNotifications}
            on:loadMessage={loadMessage} />
    {/if}
    {#if showMiddle}
        <MiddlePanel
            {hotGroups}
            {joining}
            bind:currentChatMessages
            loadingChats={$chatsLoading}
            on:clearSelection={() => push("/")}
            on:blockUser={blockUser}
            on:unblockUser={unblockUser}
            on:leaveGroup={triggerConfirm}
            on:chatWith={chatWith}
            on:replyPrivatelyTo={replyPrivatelyTo}
            on:addMembers={addMembers}
            on:showGroupDetails={showGroupDetails}
            on:showProposalFilters={showProposalFilters}
            on:showMembers={showMembers}
            on:updateChat={updateChat}
            on:joinGroup={joinGroup}
            on:cancelPreview={cancelPreview}
            on:cancelRecommendations={cancelRecommendations}
            on:recommend={() => whatsHot(false)}
            on:dismissRecommendation={dismissRecommendation}
            on:upgrade={upgrade}
            on:showPinned={showPinned}
            on:toggleMuteNotifications={toggleMuteNotifications}
            on:goToMessageIndex={goToMessageIndex}
            on:forward={forwardMessage} />
    {/if}
    {#if $numberOfColumns === 3}
        <RightPanel
            bind:rightPanelHistory
            bind:thread={threadComponent}
            on:showFaqQuestion={showFaqQuestion}
            on:userAvatarSelected={userAvatarSelected}
            on:goToMessageIndex={goToMessageIndex}
            on:addMembers={addMembers}
            on:showMembers={showMembers}
            on:chatWith={chatWith}
            on:upgrade={upgrade}
            on:blockUser={blockUser}
            on:deleteGroup={triggerConfirm}
            on:makeGroupPrivate={triggerConfirm}
            on:updateChat={updateChat}
            on:groupCreated={groupCreated} />
    {/if}
</main>

{#if $numberOfColumns === 2 && rightPanelHistory.length > 0}
    <Overlay fade={!$mobileWidth}>
        <div
            transition:fly={{ x, duration: rightPanelSlideDuration, easing: sineInOut }}
            class="right-wrapper"
            class:rtl={$rtlStore}>
            <RightPanel
                bind:rightPanelHistory
                bind:thread={threadComponent}
                on:showFaqQuestion={showFaqQuestion}
                on:userAvatarSelected={userAvatarSelected}
                on:goToMessageIndex={goToMessageIndex}
                on:addMembers={addMembers}
                on:showMembers={showMembers}
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
        doubleCheck={confirmActionEvent.kind === "delete"
            ? confirmActionEvent.doubleCheck
            : undefined}
        title={confirmActionEvent.kind === "rules" ? $_("group.rules.acceptTitle") : undefined}
        yesLabel={confirmActionEvent.kind === "rules" ? $_("group.rules.accept") : undefined}
        noLabel={confirmActionEvent.kind === "rules" ? $_("group.rules.reject") : undefined}
        message={confirmMessage}
        action={onConfirmAction} />
{/if}

<Toast />

{#if upgradeStorage && user}
    <Upgrade
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
        {:else if modal === ModalType.SelectChat}
            <SelectChatModal
                chatsSummaries={filterChatSelection($chatSummariesListStore, $selectedChatId)}
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

        &:not(.fullscreen) {
            max-width: 1400px;
            @include size-above(xl) {
                max-width: 1792px;
            }
        }
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
            height: 100%;
        }
    }
</style>

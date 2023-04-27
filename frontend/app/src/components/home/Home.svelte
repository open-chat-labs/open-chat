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
    import {
        GroupSearchResponse,
        MessageMatch,
        UserSummary,
        ChatSummary,
        EnhancedReplyContext,
        GroupChatSummary,
        GroupRules,
        Message,
        Questions,
        OpenChat,
        ThreadSelected,
        ThreadClosed,
        SelectedChatInvalid,
        SendMessageFailed,
        ChatsUpdated,
        Notification,
        CandidateGroupChat,
        defaultGroupRules,
        EventWrapper,
    } from "openchat-client";
    import Overlay from "../Overlay.svelte";
    import { getContext, onMount, tick } from "svelte";
    import { rtlStore } from "../../stores/rtl";
    import { mobileWidth, screenWidth, ScreenWidth } from "../../stores/screenDimensions";
    import page from "page";
    import { pathParams } from "../../routes";
    import type { RouteParams } from "../../routes";
    import { toastStore } from "../../stores/toast";
    import {
        closeNotificationsForChat,
        closeNotifications,
        subscribeToNotifications,
    } from "../../utils/notifications";
    import { filterByChatType, rightPanelHistory } from "../../stores/rightPanel";
    import { mapRemoteData } from "../../utils/remoteData";
    import type { RemoteData } from "../../utils/remoteData";
    import Upgrade from "./upgrade/Upgrade.svelte";
    import AreYouSure from "../AreYouSure.svelte";
    import { removeQueryStringParam } from "../../utils/urls";
    import { numberOfColumns } from "../../stores/layout";
    import { dimensions } from "../../stores/screenDimensions";
    import { messageToForwardStore } from "../../stores/messageToForward";
    import type { Share } from "../../utils/share";
    import { themeStore } from "../../theme/themes";
    import SuspendedModal from "../SuspendedModal.svelte";
    import NewGroup from "./addgroup/NewGroup.svelte";
    import AccountsModal from "./profile/AccountsModal.svelte";
    import { querystring } from "routes";
    import { eventListScrollTop } from "../../stores/scrollPos";
    import GateCheckFailed from "./groupdetails/GateCheckFailed.svelte";

    const client = getContext<OpenChat>("client");
    const user = client.user;
    let candidateGroup: CandidateGroupChat | undefined;

    type ConfirmActionEvent = ConfirmLeaveEvent | ConfirmDeleteEvent | ConfirmRulesEvent;

    interface ConfirmLeaveEvent {
        kind: "leave";
        chatId: string;
    }

    interface ConfirmDeleteEvent {
        kind: "delete";
        chatId: string;
        doubleCheck: { challenge: string; response: string };
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
        Suspended,
        NewGroup,
        Wallet,
        GateCheckFailed,
    }

    let faqQuestion: Questions | undefined = undefined;
    let modal = ModalType.None;
    let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    let userSearchResults: Promise<UserSummary[]> | undefined = undefined;
    let searchTerm: string = "";
    let searching: boolean = false;
    let searchResultsAvailable: boolean = false;
    let confirmActionEvent: ConfirmActionEvent | undefined;
    let hotGroups: RemoteData<GroupChatSummary[], string> = { kind: "idle" };
    let joining: GroupChatSummary | undefined = undefined;
    let showUpgrade: boolean = false;
    let share: Share = { title: "", text: "", url: "", files: [] };
    let messageToForward: Message | undefined = undefined;
    let creatingThread = false;
    let currentChatMessages: CurrentChatMessages | undefined;

    $: chatSummariesListStore = client.chatSummariesListStore;
    $: chatSummariesStore = client.chatSummariesStore;
    $: chatsLoading = client.chatsLoading;
    $: selectedChatStore = client.selectedChatStore;
    $: selectedChatId = client.selectedChatId;
    $: chatsInitialised = client.chatsInitialised;
    $: currentChatDraftMessage = client.currentChatDraftMessage;
    $: chatStateStore = client.chatStateStore;
    $: confirmMessage = getConfirmMessage(confirmActionEvent);

    // layout stuff
    $: showRight = $rightPanelHistory.length > 0 || $numberOfColumns === 3;
    $: floatRightPanel = !$mobileWidth && $numberOfColumns < 3;
    $: middleSelected = $pathParams.chatId !== undefined || hotGroups.kind !== "idle";
    $: leftSelected = $pathParams.chatId === undefined && hotGroups.kind === "idle";
    $: showMiddle = !$mobileWidth || (middleSelected && !showRight);
    $: showLeft = !$mobileWidth || (leftSelected && !showRight);

    onMount(() => {
        subscribeToNotifications(client, (n) => client.notificationReceived(n));
        client.addEventListener("openchat_event", clientEvent);

        if (client.user.suspensionDetails !== undefined) {
            modal = ModalType.Suspended;
        }

        return () => {
            client.removeEventListener("openchat_event", clientEvent);
        };
    });

    function clientEvent(ev: Event): void {
        if (ev instanceof ThreadSelected) {
            openThread(ev.detail);
        } else if (ev instanceof ThreadClosed) {
            closeThread();
        } else if (ev instanceof SendMessageFailed) {
            // This can occur either for chat messages or thread messages so we'll just handle it here
            if (ev.detail) {
                toastStore.showFailureToast("errorSendingMessage");
            }
        } else if (ev instanceof ChatsUpdated) {
            closeNotifications((notification: Notification) => {
                if (
                    notification.kind === "direct_notification" ||
                    notification.kind === "group_notification"
                ) {
                    return client.isMessageRead(
                        notification.kind === "direct_notification"
                            ? notification.sender
                            : notification.chatId,
                        notification.message.event.messageIndex,
                        notification.message.event.messageId
                    );
                }

                return false;
            });
        } else if (ev instanceof SelectedChatInvalid) {
            page.replace("/");
        }
    }

    async function newChatSelected(
        chatId: string,
        messageIndex?: number,
        threadMessageIndex?: number
    ): Promise<void> {
        let chat = $chatSummariesStore[chatId];

        // if this is an unknown chat let's preview it
        if (chat === undefined) {
            if (!(await createDirectChat(chatId))) {
                if (!(await client.previewChat(chatId))) {
                    page.replace("/");
                    return;
                }
            }

            chat = $chatSummariesStore[chatId];
        }

        // If an archived chat has been explicitly selected (for example by searching for it) then un-archive it
        if (chat.archived) {
            unarchiveChat(chat.chatId);
        }

        // if it's a known chat let's select it
        closeNotificationsForChat(chat.chatId);
        $eventListScrollTop = undefined;
        client.setSelectedChat(chat.chatId, messageIndex, threadMessageIndex);
        resetRightPanel();
        hotGroups = { kind: "idle" };
    }

    // the currentChatMessages component may not exist straight away
    async function waitAndScrollToMessageIndex(index: number, preserveFocus: boolean, retries = 0) {
        if (!currentChatMessages && retries < 5) {
            window.requestAnimationFrame(() =>
                waitAndScrollToMessageIndex(index, preserveFocus, retries + 1)
            );
        } else {
            currentChatMessages?.scrollToMessageIndex(index, preserveFocus);
        }
    }

    // extracting to a function to try to control more tightly what this reacts to
    async function routeChange(initialised: boolean, pathParams: RouteParams): Promise<void> {
        // wait until we have loaded the chats
        if (initialised) {
            if (pathParams.chatId === "share") {
                const title = $querystring.get("title") ?? "";
                const text = $querystring.get("text") ?? "";
                const url = $querystring.get("url") ?? "";
                share = {
                    title,
                    text,
                    url,
                    files: [],
                };
                page.replace("/");
                modal = ModalType.SelectChat;
            } else {
                // if we have something in the chatId url param

                // first close any open thread
                closeThread();

                if (pathParams.chatId !== undefined) {
                    // if the chat in the url is different from the chat we already have selected
                    if (pathParams.chatId !== $selectedChatId?.toString()) {
                        console.log("PathParams: ", pathParams);
                        newChatSelected(
                            pathParams.chatId,
                            pathParams.messageIndex,
                            pathParams.threadMessageIndex
                        );
                    } else {
                        // if the chat in the url is *the same* as the selected chat
                        // *and* if we have a messageIndex specified in the url
                        if (pathParams.messageIndex !== undefined) {
                            waitAndScrollToMessageIndex(pathParams.messageIndex, false);
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
                const faq = $querystring.get("faq");
                if (faq !== null) {
                    faqQuestion = faq as Questions;
                    modal = ModalType.Faq;
                    page.replace(removeQueryStringParam("faq"));
                }

                const diamond = $querystring.get("diamond");
                if (diamond !== null) {
                    showUpgrade = true;
                    page.replace(removeQueryStringParam("diamond"));
                }

                const wallet = $querystring.get("wallet");
                if (wallet !== null) {
                    modal = ModalType.Wallet;
                    page.replace(removeQueryStringParam("wallet"));
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
        rightPanelHistory.update((history) => {
            return history.filter((panel) => panel.kind === "user_profile");
        });
    }

    function closeThread() {
        if (creatingThread) {
            creatingThread = false;
            return;
        }
        tick().then(() => {
            rightPanelHistory.update((history) => {
                return history.filter((panel) => panel.kind !== "message_thread_panel");
            });
        });
    }

    function resetRightPanel() {
        rightPanelHistory.update((history) => {
            return filterByChatType(history, $selectedChatStore);
        });
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
        waitAndScrollToMessageIndex(ev.detail.index, ev.detail.preserveFocus);
    }

    function closeModal() {
        modal = ModalType.None;
        candidateGroup = undefined;
        joining = undefined;
    }

    function cancelRecommendations() {
        hotGroups = { kind: "idle" };
    }

    function dismissRecommendation(ev: CustomEvent<string>) {
        hotGroups = mapRemoteData(hotGroups, (data) => data.filter((g) => g.chatId !== ev.detail));
        client.dismissRecommendation(ev.detail);
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
            groupSearchResults = client.searchGroups(lowercase, 10);
            userSearchResults = client.searchUsers(lowercase, 10);
            try {
                await Promise.all([groupSearchResults, userSearchResults]).then(() => {
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
        groupSearchResults = userSearchResults = undefined;
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
            page("/");
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
                    rightPanelHistory.set([]);
                });
            case "rules":
                return doJoinGroup(confirmActionEvent.group, confirmActionEvent.select);
            default:
                return Promise.reject();
        }
    }

    function deleteGroup(chatId: string): Promise<void> {
        page("/");
        return client.deleteGroup(chatId).then((success) => {
            if (success) {
                toastStore.showSuccessToast("deleteGroupSuccess");
            } else {
                toastStore.showFailureToast("deleteGroupFailure");
                page(`/${chatId}`);
            }
        });
    }

    function leaveGroup(chatId: string): Promise<void> {
        page("/");

        client.leaveGroup(chatId).then((resp) => {
            if (resp !== "success") {
                if (resp === "owner_cannot_leave") {
                    toastStore.showFailureToast("ownerCantLeave");
                } else {
                    toastStore.showFailureToast("failedToLeaveGroup");
                }
                page(`/${chatId}`);
            }
        });

        return Promise.resolve();
    }

    function deleteDirectChat(ev: CustomEvent<string>) {
        if (ev.detail === $pathParams.chatId) {
            page("/");
        }
        tick().then(() => client.removeChat(ev.detail));
    }

    function chatWith(ev: CustomEvent<string>) {
        const chat = $chatSummariesListStore.find((c) => {
            return c.kind === "direct_chat" && c.them === ev.detail;
        });
        if (chat) {
            page(`/${chat.chatId}`);
        } else {
            createDirectChat(ev.detail);
        }
    }

    function loadMessage(ev: CustomEvent<MessageMatch>): void {
        if (ev.detail.chatId === $selectedChatId) {
            currentChatMessages?.externalGoToMessage(ev.detail.messageIndex);
        } else {
            page(`/${ev.detail.chatId}/${ev.detail.messageIndex}`);
        }
    }

    function addMembers(ev: CustomEvent<boolean>) {
        if ($selectedChatId !== undefined) {
            if (ev.detail) {
                rightPanelHistory.set([{ kind: "add_members" }]);
            } else {
                rightPanelHistory.update((history) => {
                    return [...history, { kind: "add_members" }];
                });
            }
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
            page(`/${chat.chatId}`);
        } else {
            createDirectChat(chatId);
        }
    }

    function forwardMessage(ev: CustomEvent<Message>) {
        messageToForward = ev.detail;
        modal = ModalType.SelectChat;
    }

    function showMembers(ev: CustomEvent<boolean>) {
        if ($selectedChatId !== undefined) {
            if (ev.detail) {
                rightPanelHistory.set([{ kind: "show_members" }]);
            } else {
                rightPanelHistory.update((history) => {
                    return [...history, { kind: "show_members" }];
                });
            }
        }
    }

    function showProfile() {
        if ($selectedChatId !== undefined) {
            page.replace(`/${$selectedChatId}`);
        }
        rightPanelHistory.set([{ kind: "user_profile" }]);
    }

    function openThread(ev: { threadRootEvent: EventWrapper<Message>; initiating: boolean }) {
        if ($selectedChatId !== undefined) {
            if (ev.initiating) {
                creatingThread = true;
                page.replace(`/${$selectedChatId}`);
            }

            tick().then(() => {
                rightPanelHistory.set([
                    {
                        kind: "message_thread_panel",
                        threadRootMessageIndex: ev.threadRootEvent.event.messageIndex,
                        threadRootMessageId: ev.threadRootEvent.event.messageId,
                    },
                ]);
            });
        }
    }

    function showGroupDetails() {
        if ($selectedChatId !== undefined) {
            page.replace(`/${$selectedChatId}`);
            rightPanelHistory.set([
                {
                    kind: "group_details",
                },
            ]);
        }
    }

    function showProposalFilters() {
        if ($selectedChatId !== undefined) {
            page.replace(`/${$selectedChatId}`);
            rightPanelHistory.set([
                {
                    kind: "proposal_filters",
                },
            ]);
        }
    }

    function showPinned() {
        if ($selectedChatId !== undefined) {
            page.replace(`/${$selectedChatId}`);
            rightPanelHistory.set([
                {
                    kind: "show_pinned",
                },
            ]);
        }
    }

    async function joinGroup(
        ev: CustomEvent<{ group: GroupChatSummary; select: boolean }>
    ): Promise<void> {
        const { group, select } = ev.detail;

        const rules = await client.getGroupRules(group.chatId);

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
                    joining = undefined;
                } else if (resp === "gate_check_failed") {
                    modal = ModalType.GateCheckFailed;
                } else if (resp === "failure") {
                    toastStore.showFailureToast("joinGroupFailed");
                    joining = undefined;
                } else if (select) {
                    hotGroups = { kind: "idle" };
                    joining = undefined;
                    page(`/${group.chatId}`);
                }
            })
            .catch(() => (joining = undefined));
    }

    function cancelPreview(ev: CustomEvent<GroupChatSummary>) {
        let chat = ev.detail;
        page("/");
        tick().then(() => {
            client.removeChat(chat.chatId);
            if (!chat.public) {
                client.declineInvitation(chat.chatId)
            }
        });
    }

    function whatsHot(navigate: boolean = true) {
        if (navigate) {
            page("/");
        }
        tick().then(() => {
            hotGroups = { kind: "loading" };
            client
                .getRecommendedGroups()
                .then((resp) => {
                    if (hotGroups.kind === "loading") {
                        hotGroups = { kind: "success", data: resp };
                    }
                })
                .catch((err) => (hotGroups = { kind: "error", error: err.toString() }));
        });
    }

    function upgrade() {
        showUpgrade = true;
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
        page(`/${chatId}`);
        messageToForwardStore.set(messageToForward);
    }

    function shareWithChat(chatId: string) {
        page(`/${chatId}`);

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

    function groupCreated(
        ev: CustomEvent<{ chatId: string; isPublic: boolean; rules: GroupRules }>
    ) {
        const { chatId, isPublic, rules } = ev.detail;
        chatStateStore.setProp(chatId, "rules", rules);
        if (isPublic) {
            client.trackEvent("public_group_created");
        } else {
            client.trackEvent("private_group_created");
        }
        rightPanelHistory.set(
            $screenWidth === ScreenWidth.ExtraExtraLarge
                ? [
                      {
                          kind: "group_details",
                      },
                  ]
                : []
        );
    }

    function showWallet() {
        modal = ModalType.Wallet;
    }

    function newGroup() {
        modal = ModalType.NewGroup;
        candidateGroup = {
            name: "",
            description: "",
            historyVisible: true,
            isPublic: false,
            members: [],
            permissions: {
                changePermissions: "admins",
                changeRoles: "admins",
                removeMembers: "admins",
                blockUsers: "admins",
                deleteMessages: "admins",
                updateGroup: "admins",
                pinMessages: "admins",
                inviteUsers: "admins",
                createPolls: "members",
                sendMessages: "members",
                reactToMessages: "members",
                replyInThread: "members",
            },
            rules: {
                text: defaultGroupRules,
                enabled: false,
            },
            gate: { kind: "no_gate" },
        };
    }

    function editGroup(ev: CustomEvent<{ chat: GroupChatSummary; rules: GroupRules | undefined }>) {
        modal = ModalType.NewGroup;
        const { chat, rules } = ev.detail;
        candidateGroup = {
            chatId: chat.chatId,
            name: chat.name,
            description: chat.description,
            historyVisible: chat.historyVisibleToNewJoiners,
            isPublic: chat.public,
            members: [],
            permissions: { ...chat.permissions },
            rules:
                rules !== undefined
                    ? { ...rules }
                    : {
                          text: defaultGroupRules,
                          enabled: false,
                      },
            avatar: {
                blobUrl: chat.blobUrl,
                blobData: chat.blobData,
            },
            gate: chat.gate,
        };
    }

    function filterChatSelection(
        chats: ChatSummary[],
        selectedChatId: string | undefined
    ): ChatSummary[] {
        return chats.filter((c) => selectedChatId !== c.chatId && client.canSendMessages(c.chatId));
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
        return () => page(route);
        // return () => (window.location.href = route);
    }

    async function createDirectChat(chatId: string): Promise<boolean> {
        if (!(await client.createDirectChat(chatId))) {
            return false;
        }

        page(`/${chatId}`);
        return true;
    }

    function closeRightPanel() {
        if ($rightPanelHistory.find((panel) => panel.kind === "message_thread_panel")) {
            page.replace(removeQueryStringParam("open"));
        }
        rightPanelHistory.set([]);
    }

    $: bgHeight = $dimensions.height * 0.9;
    $: bgClip = (($dimensions.height - 32) / bgHeight) * 361;
</script>

<main>
    {#if showLeft}
        <LeftPanel
            {groupSearchResults}
            {userSearchResults}
            {searchTerm}
            {searchResultsAvailable}
            {searching}
            on:showHomePage={showLandingPageRoute("/home")}
            on:showFaq={() => (modal = ModalType.Faq)}
            on:searchEntered={performSearch}
            on:chatWith={chatWith}
            on:whatsHot={() => whatsHot(true)}
            on:newGroup={newGroup}
            on:profile={showProfile}
            on:logout={() => client.logout()}
            on:wallet={showWallet}
            on:deleteDirectChat={deleteDirectChat}
            on:pinChat={pinChat}
            on:unpinChat={unpinChat}
            on:upgrade={upgrade}
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
            on:clearSelection={() => page("/")}
            on:blockUser={blockUser}
            on:unblockUser={unblockUser}
            on:leaveGroup={triggerConfirm}
            on:chatWith={chatWith}
            on:replyPrivatelyTo={replyPrivatelyTo}
            on:addMembers={addMembers}
            on:showGroupDetails={showGroupDetails}
            on:showProposalFilters={showProposalFilters}
            on:showMembers={showMembers}
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
    {#if showRight && !floatRightPanel}
        <RightPanel
            on:showFaqQuestion={showFaqQuestion}
            on:userAvatarSelected={userAvatarSelected}
            on:goToMessageIndex={goToMessageIndex}
            on:replyPrivatelyTo={replyPrivatelyTo}
            on:addMembers={addMembers}
            on:showMembers={showMembers}
            on:chatWith={chatWith}
            on:upgrade={upgrade}
            on:blockUser={blockUser}
            on:deleteGroup={triggerConfirm}
            on:editGroup={editGroup}
            on:groupCreated={groupCreated} />
    {/if}
</main>

{#if showRight && floatRightPanel}
    <Overlay on:close={closeRightPanel} dismissible fade={!$mobileWidth}>
        <div on:click|stopPropagation class="right-wrapper" class:rtl={$rtlStore}>
            <RightPanel
                on:showFaqQuestion={showFaqQuestion}
                on:userAvatarSelected={userAvatarSelected}
                on:goToMessageIndex={goToMessageIndex}
                on:replyPrivatelyTo={replyPrivatelyTo}
                on:addMembers={addMembers}
                on:showMembers={showMembers}
                on:chatWith={chatWith}
                on:upgrade={upgrade}
                on:blockUser={blockUser}
                on:deleteGroup={triggerConfirm}
                on:editGroup={editGroup}
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

{#if showUpgrade && user}
    <Upgrade on:showFaqQuestion={showFaqQuestion} on:cancel={() => (showUpgrade = false)} />
{/if}

{#if modal !== ModalType.None}
    <Overlay
        dismissible={modal !== ModalType.SelectChat && modal !== ModalType.Wallet}
        alignLeft={modal === ModalType.SelectChat}
        on:close={closeModal}>
        {#if modal === ModalType.Faq}
            <FaqModal bind:question={faqQuestion} on:close={closeModal} />
        {:else if modal === ModalType.SelectChat}
            <SelectChatModal
                chatsSummaries={filterChatSelection($chatSummariesListStore, $selectedChatId)}
                on:close={onCloseSelectChat}
                on:select={onSelectChat} />
        {:else if modal === ModalType.Suspended}
            <SuspendedModal on:close={closeModal} />
        {:else if modal === ModalType.GateCheckFailed && joining !== undefined}
            <GateCheckFailed on:close={closeModal} gate={joining.gate} />
        {:else if modal === ModalType.NewGroup && candidateGroup !== undefined}
            <NewGroup on:upgrade={upgrade} {candidateGroup} on:close={closeModal} />
        {:else if modal === ModalType.Wallet}
            <AccountsModal on:close={closeModal} />
        {/if}
    </Overlay>
{/if}

{#if $themeStore.name !== "white"}
    <BackgroundLogo
        width={`${bgHeight}px`}
        bottom={"unset"}
        left={"0"}
        opacity={"0.05"}
        skew={"5deg"}
        viewBox={`0 0 361 ${bgClip}`} />
{/if}

<style type="text/scss">
    :global(.edited-msg) {
        @include font(light, normal, fs-70);
    }

    main {
        transition: max-width ease-in-out 150ms;
        position: relative;
        width: 100%;
        display: flex;
        margin: 0 auto;
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

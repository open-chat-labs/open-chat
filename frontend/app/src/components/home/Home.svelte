<script lang="ts">
    import BackgroundLogo from "../BackgroundLogo.svelte";
    import { _ } from "svelte-i18n";
    import LeftPanel from "./LeftPanel.svelte";
    import type CurrentChatMessages from "./CurrentChatMessages.svelte";
    import Toast from "../Toast.svelte";
    import SelectChatModal from "../SelectChatModal.svelte";
    import MiddlePanel from "./MiddlePanel.svelte";
    import RightPanel from "./RightPanel.svelte";
    import EditCommunity from "./communities/edit/Edit.svelte";
    import {
        MessageMatch,
        UserSummary,
        ChatSummary,
        EnhancedReplyContext,
        GroupChatSummary,
        AccessRules,
        Message,
        OpenChat,
        ThreadSelected,
        ThreadClosed,
        SelectedChatInvalid,
        SendMessageFailed,
        ChatsUpdated,
        Notification,
        CandidateGroupChat,
        defaultAccessRules,
        EventWrapper,
        ChatType,
        CommunitySummary,
        Level,
        GroupSearchResponse,
        ChatIdentifier,
        DirectChatIdentifier,
        GroupChatIdentifier,
        chatIdentifiersEqual,
        nullMembership,
        CommunityIdentifier,
        routeForChatIdentifier,
        MultiUserChat,
        MultiUserChatIdentifier,
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
    import {
        filterByChatType,
        pushRightPanelHistory,
        rightPanelHistory,
    } from "../../stores/rightPanel";
    import Upgrade from "./upgrade/Upgrade.svelte";
    import AreYouSure from "../AreYouSure.svelte";
    import { removeQueryStringParam } from "../../utils/urls";
    import { layoutStore } from "../../stores/layout";
    import { dimensions } from "../../stores/screenDimensions";
    import { messageToForwardStore } from "../../stores/messageToForward";
    import type { Share } from "../../utils/share";
    import { themeStore } from "../../theme/themes";
    import SuspendedModal from "../SuspendedModal.svelte";
    import NoAccess from "./NoAccess.svelte";
    import NewGroup from "./addgroup/NewGroup.svelte";
    import AccountsModal from "./profile/AccountsModal.svelte";
    import { querystring } from "routes";
    import { eventListScrollTop } from "../../stores/scrollPos";
    import GateCheckFailed from "./AccessGateCheckFailed.svelte";
    import HallOfFame from "./HallOfFame.svelte";
    import LeftNav from "./nav/LeftNav.svelte";
    import { createCandidateCommunity } from "../../stores/community";
    import { interpolateLevel } from "../../utils/i18n";

    const client = getContext<OpenChat>("client");
    const user = client.user;
    let candidateGroup: CandidateGroupChat | undefined;
    let candidateCommunity: CommunitySummary | undefined;
    let candidateCommunityRules: AccessRules = defaultAccessRules;

    type ConfirmActionEvent =
        | ConfirmLeaveEvent
        | ConfirmDeleteEvent
        | ConfirmRulesEvent
        | ConfirmLeaveCommunityEvent
        | ConfirmDeleteCommunityEvent;

    type ConfirmLeaveCommunityEvent = {
        kind: "leave_community";
        communityId: CommunityIdentifier;
        chatType: ChatType;
    };

    type ConfirmLeaveEvent = {
        kind: "leave";
        chatId: MultiUserChatIdentifier;
        chatType: ChatType;
        level: Level;
    };

    type ConfirmDeleteEvent = {
        kind: "delete";
        chatId: MultiUserChatIdentifier;
        level: Level;
        doubleCheck: { challenge: string; response: string };
    };

    type ConfirmDeleteCommunityEvent = {
        kind: "delete_community";
        communityId: CommunityIdentifier;
        doubleCheck: { challenge: string; response: string };
    };

    type ConfirmRulesEvent = {
        kind: "rules";
        group: GroupChatSummary;
        select: boolean;
        rules: string;
    };

    enum ModalType {
        None,
        SelectChat,
        Suspended,
        NoAccess,
        NewGroup,
        Wallet,
        GateCheckFailed,
        HallOfFame,
        EditCommunity,
    }

    let modal = ModalType.None;
    let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    let userSearchResults: Promise<UserSummary[]> | undefined = undefined;
    let searchTerm: string = "";
    let searching: boolean = false;
    let searchResultsAvailable: boolean = false;
    let confirmActionEvent: ConfirmActionEvent | undefined;
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
    $: chatListScope = client.chatListScope;
    $: currentCommunityRules = client.currentCommunityRules;
    $: globalUnreadCount = client.globalUnreadCount;

    $: {
        document.title = $globalUnreadCount > 0 ? `OpenChat (${$globalUnreadCount})` : "OpenChat";
    }

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
        chatId: ChatIdentifier,
        messageIndex?: number,
        threadMessageIndex?: number
    ): Promise<void> {
        let chat = $chatSummariesStore.get(chatId);

        // if this is an unknown chat let's preview it
        if (chat === undefined) {
            // TODO - deal with channels
            if (chatId.kind === "direct_chat") {
                await createDirectChat(chatId);
            } else if (chatId.kind === "group_chat" || chatId.kind === "channel") {
                const code = $querystring.get("code");
                if (code) {
                    client.groupInvite = {
                        chatId: chatId,
                        code,
                    };
                }
                if (!(await client.previewChat(chatId))) {
                    page.replace("/");
                    return;
                }
            }
            chat = $chatSummariesStore.get(chatId);
        }

        if (chat !== undefined) {
            // If an archived chat has been explicitly selected (for example by searching for it) then un-archive it
            if (chat?.membership.archived) {
                unarchiveChat(chat.id);
            }

            // if it's a known chat let's select it
            closeNotificationsForChat(chat.id);
            $eventListScrollTop = undefined;
            client.setSelectedChat(chat.id, messageIndex, threadMessageIndex);
            resetRightPanel();
        }
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

    async function selectCommunity(id: CommunityIdentifier): Promise<boolean> {
        const found = await client.setSelectedCommunity(id);
        if (!found) {
            modal = ModalType.NoAccess;
        }
        return found;
    }

    // extracting to a function to try to control more tightly what this reacts to
    async function routeChange(initialised: boolean, pathParams: RouteParams): Promise<void> {
        // wait until we have loaded the chats
        if (initialised) {
            if ("scope" in pathParams) {
                client.setChatListScope(pathParams.scope);
            }
            if (pathParams.kind === "home_route") {
                client.clearSelectedChat();
                closeThread();
                filterChatSpecificRightPanelStates();
            } else if (pathParams.kind === "communities_route") {
                client.clearSelectedChat();
                rightPanelHistory.set([]);
            } else if (pathParams.kind === "selected_community_route") {
                await selectCommunity(pathParams.communityId);
            } else if (
                pathParams.kind === "global_chat_selected_route" ||
                pathParams.kind === "selected_channel_route"
            ) {
                if (pathParams.kind === "selected_channel_route") {
                    await selectCommunity(pathParams.communityId);
                }

                // first close any open thread
                closeThread();

                // if the chat in the url is different from the chat we already have selected
                if (!chatIdentifiersEqual(pathParams.chatId, $selectedChatId)) {
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
                // any other route with no associated chat therefore we must clear any selected chat and potentially close the right panel
                if ($selectedChatId !== undefined) {
                    client.clearSelectedChat();
                }
                closeThread();
                filterChatSpecificRightPanelStates();

                if (pathParams.kind === "share_route") {
                    share = {
                        title: pathParams.title,
                        text: pathParams.text,
                        url: pathParams.url,
                        files: [],
                    };
                    page.replace("/");
                    modal = ModalType.SelectChat;
                }
            }

            // regardless of the path params, we *always* check the query string
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

            const faq = $querystring.get("faq");
            if (faq !== null) {
                page.replace(`/faq?q=${faq}`);
            }

            const hof = $querystring.get("hof");
            if (hof !== null) {
                modal = ModalType.HallOfFame;
                page.replace(removeQueryStringParam("hof"));
            }
        }
    }

    $: {
        routeChange($chatsInitialised, $pathParams);
    }

    // Note: very important (and hacky) that this is hidden in a function rather than inline in the top level reactive
    // statement because we don't want that reactive statement to execute in reponse to changes in rightPanelHistory :puke:
    function filterChatSpecificRightPanelStates() {
        rightPanelHistory.update((history) =>
            history.filter((panel) => panel.kind === "user_profile")
        );
    }

    function closeThread() {
        if (creatingThread) {
            creatingThread = false;
            return;
        }
        tick().then(() => {
            rightPanelHistory.update((history) =>
                history.filter((panel) => panel.kind !== "message_thread_panel")
            );
        });
    }

    function resetRightPanel() {
        rightPanelHistory.update((history) => filterByChatType(history, $selectedChatStore));
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
        candidateCommunity = undefined;
        joining = undefined;
    }

    function closeNoAccess() {
        closeModal();
        page("/favourite");
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

    function pinChat(ev: CustomEvent<ChatIdentifier>) {
        client.pinChat(ev.detail).then((success) => {
            if (!success) {
                toastStore.showFailureToast("pinChat.failed");
            }
        });
    }

    function unpinChat(ev: CustomEvent<ChatIdentifier>) {
        client.unpinChat(ev.detail).then((success) => {
            if (!success) {
                toastStore.showFailureToast("pinChat.unpinFailed");
            }
        });
    }

    function onArchiveChat(ev: CustomEvent<ChatIdentifier>) {
        client.archiveChat(ev.detail).then((success) => {
            if (!success) {
                toastStore.showFailureToast("archiveChatFailed");
            }
        });
        if (ev.detail === $selectedChatId) {
            page("/");
        }
    }

    function onUnarchiveChat(ev: CustomEvent<ChatIdentifier>) {
        unarchiveChat(ev.detail);
    }

    function unarchiveChat(chatId: ChatIdentifier) {
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
                return interpolateLevel("confirmLeaveGroup", confirmActionEvent.level, true);
            case "leave_community":
                return $_("communities.leaveMessage");
            case "delete_community":
                return $_("communities.deleteMessage");
            case "delete":
                return interpolateLevel("irreversible", confirmActionEvent.level, true);
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
                return leaveGroup(confirmActionEvent.chatId, confirmActionEvent.level);
            case "leave_community":
                return leaveCommunity(confirmActionEvent.communityId);
            case "delete_community":
                return client.deleteCommunity(confirmActionEvent.communityId).then((_) => {
                    rightPanelHistory.set([]);
                });
            case "delete":
                return deleteGroup(confirmActionEvent.chatId, confirmActionEvent.level).then(
                    (_) => {
                        rightPanelHistory.set([]);
                    }
                );
            case "rules":
                return doJoinGroup(confirmActionEvent.group, confirmActionEvent.select);
            default:
                return Promise.reject();
        }
    }

    function deleteGroup(chatId: MultiUserChatIdentifier, level: Level): Promise<void> {
        if (chatId.kind === "channel") {
            page(`/community/${chatId.communityId}`);
        } else {
            page("/");
        }
        return client.deleteGroup(chatId).then((success) => {
            if (success) {
                toastStore.showSuccessToast(interpolateLevel("deleteGroupSuccess", level));
            } else {
                toastStore.showFailureToast(interpolateLevel("deleteGroupFailure", level, true));
                page(routeForChatIdentifier($chatListScope.kind, chatId));
            }
        });
    }

    function leaveCommunity(id: CommunityIdentifier): Promise<void> {
        page("/favourite");

        client.leaveCommunity(id).then((success) => {
            if (!success) {
                toastStore.showFailureToast("communities.errors.leaveFailed");
                page(`/community/${id.communityId}`);
            }
        });

        return Promise.resolve();
    }

    function leaveGroup(chatId: MultiUserChatIdentifier, level: Level): Promise<void> {
        page("/");

        client.leaveGroup(chatId).then((resp) => {
            if (resp !== "success") {
                if (resp === "owner_cannot_leave") {
                    toastStore.showFailureToast(interpolateLevel("ownerCantLeave", level, true));
                } else {
                    toastStore.showFailureToast(
                        interpolateLevel("failedToLeaveGroup", level, true)
                    );
                }
                page(routeForChatIdentifier($chatListScope.kind, chatId));
            }
        });

        return Promise.resolve();
    }

    function deleteDirectChat(ev: CustomEvent<ChatIdentifier>) {
        if ($pathParams.kind === "global_chat_selected_route" && ev.detail === $pathParams.chatId) {
            page("/");
        }
        tick().then(() => client.removeChat(ev.detail));
    }

    function chatWith(ev: CustomEvent<DirectChatIdentifier>) {
        const chat = $chatSummariesListStore.find((c) => {
            return c.kind === "direct_chat" && c.them === ev.detail;
        });
        if (chat) {
            page(routeForChatIdentifier($chatListScope.kind, ev.detail));
        } else {
            createDirectChat(ev.detail);
        }
    }

    function loadMessage(ev: CustomEvent<MessageMatch>): void {
        if (chatIdentifiersEqual(ev.detail.chatId, $selectedChatId)) {
            currentChatMessages?.externalGoToMessage(ev.detail.messageIndex);
        } else {
            page(
                `${routeForChatIdentifier($chatListScope.kind, ev.detail.chatId)}/${
                    ev.detail.messageIndex
                }`
            );
        }
    }

    function showInviteGroupUsers(ev: CustomEvent<boolean>) {
        if ($selectedChatId !== undefined) {
            if (ev.detail) {
                rightPanelHistory.set([{ kind: "invite_group_users" }]);
            } else {
                rightPanelHistory.update((history) => {
                    return [...history, { kind: "invite_group_users" }];
                });
            }
        }
    }

    function replyPrivatelyTo(ev: CustomEvent<EnhancedReplyContext>) {
        if (ev.detail.sender === undefined) return;

        const chat = $chatSummariesListStore.find((c) => {
            return (
                c.kind === "direct_chat" &&
                chatIdentifiersEqual(c.them, {
                    kind: "direct_chat",
                    userId: ev.detail.sender!.userId,
                })
            );
        });

        const chatId = chat?.id ?? { kind: "direct_chat", userId: ev.detail.sender.userId };
        currentChatDraftMessage.setTextContent(chatId, "");
        currentChatDraftMessage.setReplyingTo(chatId, ev.detail);
        if (chat) {
            page(routeForChatIdentifier($chatListScope.kind, chatId));
        } else {
            createDirectChat(chatId as DirectChatIdentifier);
        }
    }

    function forwardMessage(ev: CustomEvent<Message>) {
        messageToForward = ev.detail;
        modal = ModalType.SelectChat;
    }

    function showGroupMembers(ev: CustomEvent<boolean>) {
        if ($selectedChatId !== undefined) {
            if (ev.detail) {
                rightPanelHistory.set([{ kind: "show_group_members" }]);
            } else {
                pushRightPanelHistory({ kind: "show_group_members" });
            }
        }
    }

    function showProfile() {
        if ($selectedChatId !== undefined) {
            page.replace(routeForChatIdentifier($chatListScope.kind, $selectedChatId));
        }
        rightPanelHistory.set([{ kind: "user_profile" }]);
    }

    function openThread(ev: { threadRootEvent: EventWrapper<Message>; initiating: boolean }) {
        if ($selectedChatId !== undefined) {
            if (ev.initiating) {
                creatingThread = true;
                page.replace(routeForChatIdentifier($chatListScope.kind, $selectedChatId));
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

    function communityDetails() {
        // what do we do here if the community is not selected
        // do we select it?
        if ($chatListScope.kind === "community") {
            rightPanelHistory.set([{ kind: "community_details" }]);
        }
    }

    function showGroupDetails() {
        if ($selectedChatId !== undefined) {
            page.replace(routeForChatIdentifier($chatListScope.kind, $selectedChatId));
            rightPanelHistory.set([
                {
                    kind: "group_details",
                },
            ]);
        }
    }

    function showProposalFilters() {
        if ($selectedChatId !== undefined) {
            page.replace(routeForChatIdentifier($chatListScope.kind, $selectedChatId));
            rightPanelHistory.set([
                {
                    kind: "proposal_filters",
                },
            ]);
        }
    }

    function showPinned() {
        if ($selectedChatId !== undefined) {
            page.replace(routeForChatIdentifier($chatListScope.kind, $selectedChatId));
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

        const rules = await client.getGroupRules(group.id);

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
                    joining = undefined;
                    page(routeForChatIdentifier($chatListScope.kind, group.id));
                } else {
                    joining = undefined;
                }
            })
            .catch(() => (joining = undefined));
    }

    function upgrade() {
        showUpgrade = true;
    }

    function onSelectChat(ev: CustomEvent<ChatIdentifier>) {
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

    function forwardToChat(chatId: ChatIdentifier) {
        page(routeForChatIdentifier($chatListScope.kind, chatId));
        messageToForwardStore.set(messageToForward);
    }

    function shareWithChat(chatId: ChatIdentifier) {
        page(routeForChatIdentifier($chatListScope.kind, chatId));

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
        ev: CustomEvent<{ chatId: GroupChatIdentifier; isPublic: boolean; rules: AccessRules }>
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

    function newChannel() {
        // TODO - come back to this
        newGroup("channel");
    }

    function newGroup(level: Level = "group") {
        if (level === "channel" && $chatListScope.kind !== "community") {
            return;
        }
        const id: MultiUserChatIdentifier =
            level === "channel" && $chatListScope.kind === "community"
                ? { kind: "channel", communityId: $chatListScope.id.communityId, channelId: "" }
                : { kind: "group_chat", groupId: "" };
        modal = ModalType.NewGroup;
        candidateGroup = {
            id,
            name: "",
            description: "",
            historyVisible: true,
            public: false,
            frozen: false,
            members: [],
            permissions: {
                changePermissions: "admin",
                changeRoles: "admin",
                removeMembers: "moderator",
                blockUsers: "moderator",
                deleteMessages: "moderator",
                updateGroup: "admin",
                pinMessages: "admin",
                inviteUsers: "admin",
                createPolls: "member",
                sendMessages: "member",
                reactToMessages: "member",
                replyInThread: "member",
            },
            rules: defaultAccessRules,
            gate: { kind: "no_gate" },
            level,
            membership: {
                ...nullMembership(),
                role: "owner",
            },
        };
    }

    function editGroup(ev: CustomEvent<{ chat: MultiUserChat; rules: AccessRules | undefined }>) {
        modal = ModalType.NewGroup;
        const { chat, rules } = ev.detail;
        candidateGroup = {
            id: chat.id,
            name: chat.name,
            description: chat.description,
            historyVisible: chat.historyVisible,
            public: chat.public,
            frozen: chat.frozen,
            members: [],
            permissions: { ...chat.permissions },
            rules: rules !== undefined ? { ...rules } : defaultAccessRules,
            avatar: {
                blobUrl: chat.blobUrl,
                blobData: chat.blobData,
            },
            gate: chat.gate,
            level: chat.id.kind === "group_chat" ? "group" : "channel",
            membership: chat.membership,
        };
    }

    function filterChatSelection(
        chats: ChatSummary[],
        selectedChatId: ChatIdentifier | undefined
    ): ChatSummary[] {
        if (selectedChatId === undefined) return chats;
        return chats.filter(
            (c) => !chatIdentifiersEqual(selectedChatId, c.id) && client.canSendMessages(c.id)
        );
    }

    function toggleMuteNotifications(ev: CustomEvent<{ chatId: ChatIdentifier; mute: boolean }>) {
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

    async function createDirectChat(chatId: DirectChatIdentifier): Promise<boolean> {
        if (!(await client.createDirectChat(chatId))) {
            return false;
        }

        page(routeForChatIdentifier($chatListScope.kind, chatId));
        return true;
    }

    function closeRightPanel() {
        if ($rightPanelHistory.find((panel) => panel.kind === "message_thread_panel")) {
            page.replace(removeQueryStringParam("open"));
        }
        rightPanelHistory.set([]);
    }

    function createCommunity() {
        candidateCommunity = createCandidateCommunity("");
        candidateCommunityRules = defaultAccessRules;
        modal = ModalType.EditCommunity;
    }

    function editCommunity(ev: CustomEvent<CommunitySummary>) {
        candidateCommunity = ev.detail;
        candidateCommunityRules = $currentCommunityRules ?? defaultAccessRules;
        modal = ModalType.EditCommunity;
    }

    $: bgHeight = $dimensions.height * 0.9;
    $: bgClip = (($dimensions.height - 32) / bgHeight) * 361;
</script>

<main>
    {#if $layoutStore.showNav}
        <LeftNav
            on:profile={showProfile}
            on:wallet={showWallet}
            on:halloffame={() => (modal = ModalType.HallOfFame)}
            on:logout={() => client.logout()}
            on:newGroup={() => newGroup("group")}
            on:communityDetails={communityDetails}
            on:showHomePage={showLandingPageRoute("/home")}
            on:newChannel={newChannel}
            on:leaveCommunity={triggerConfirm}
            on:deleteCommunity={triggerConfirm}
            on:upgrade={upgrade} />
    {/if}

    {#if $layoutStore.showLeft}
        <LeftPanel
            {groupSearchResults}
            {userSearchResults}
            {searchTerm}
            {searchResultsAvailable}
            {searching}
            on:showHomePage={showLandingPageRoute("/home")}
            on:searchEntered={performSearch}
            on:chatWith={chatWith}
            on:halloffame={() => (modal = ModalType.HallOfFame)}
            on:newGroup={() => newGroup("group")}
            on:profile={showProfile}
            on:communityDetails={communityDetails}
            on:logout={() => client.logout()}
            on:wallet={showWallet}
            on:deleteDirectChat={deleteDirectChat}
            on:pinChat={pinChat}
            on:unpinChat={unpinChat}
            on:upgrade={upgrade}
            on:archiveChat={onArchiveChat}
            on:unarchiveChat={onUnarchiveChat}
            on:toggleMuteNotifications={toggleMuteNotifications}
            on:newChannel={newChannel}
            on:editCommunity={editCommunity}
            on:leaveCommunity={triggerConfirm}
            on:deleteCommunity={triggerConfirm}
            on:loadMessage={loadMessage} />
    {/if}
    {#if $layoutStore.showMiddle}
        <MiddlePanel
            {joining}
            bind:currentChatMessages
            loadingChats={$chatsLoading}
            on:clearSelection={() => page("/")}
            on:blockUser={blockUser}
            on:unblockUser={unblockUser}
            on:leaveGroup={triggerConfirm}
            on:chatWith={chatWith}
            on:replyPrivatelyTo={replyPrivatelyTo}
            on:showInviteGroupUsers={showInviteGroupUsers}
            on:showGroupDetails={showGroupDetails}
            on:showProposalFilters={showProposalFilters}
            on:showGroupMembers={showGroupMembers}
            on:joinGroup={joinGroup}
            on:upgrade={upgrade}
            on:showPinned={showPinned}
            on:toggleMuteNotifications={toggleMuteNotifications}
            on:goToMessageIndex={goToMessageIndex}
            on:forward={forwardMessage}
            on:createCommunity={createCommunity} />
    {/if}
    {#if $layoutStore.rightPanel === "inline"}
        <RightPanel
            on:userAvatarSelected={userAvatarSelected}
            on:goToMessageIndex={goToMessageIndex}
            on:replyPrivatelyTo={replyPrivatelyTo}
            on:showInviteGroupUsers={showInviteGroupUsers}
            on:showGroupMembers={showGroupMembers}
            on:chatWith={chatWith}
            on:upgrade={upgrade}
            on:blockUser={blockUser}
            on:deleteGroup={triggerConfirm}
            on:editGroup={editGroup}
            on:editCommunity={editCommunity}
            on:deleteCommunity={triggerConfirm}
            on:groupCreated={groupCreated} />
    {/if}
</main>

{#if $layoutStore.rightPanel === "floating"}
    <Overlay on:close={closeRightPanel} dismissible fade={!$mobileWidth}>
        <div on:click|stopPropagation class="right-wrapper" class:rtl={$rtlStore}>
            <RightPanel
                on:userAvatarSelected={userAvatarSelected}
                on:goToMessageIndex={goToMessageIndex}
                on:replyPrivatelyTo={replyPrivatelyTo}
                on:showInviteGroupUsers={showInviteGroupUsers}
                on:showGroupMembers={showGroupMembers}
                on:chatWith={chatWith}
                on:upgrade={upgrade}
                on:blockUser={blockUser}
                on:deleteGroup={triggerConfirm}
                on:editGroup={editGroup}
                on:editCommunity={editCommunity}
                on:deleteCommunity={triggerConfirm}
                on:groupCreated={groupCreated} />
        </div>
    </Overlay>
{/if}

{#if confirmActionEvent !== undefined}
    <AreYouSure
        doubleCheck={confirmActionEvent.kind === "delete" ||
        confirmActionEvent.kind === "delete_community"
            ? confirmActionEvent.doubleCheck
            : undefined}
        title={confirmActionEvent.kind === "rules"
            ? interpolateLevel("rules.acceptTitle", "group")
            : undefined}
        yesLabel={confirmActionEvent.kind === "rules" ? $_("rules.accept") : undefined}
        noLabel={confirmActionEvent.kind === "rules" ? $_("rules.reject") : undefined}
        message={confirmMessage}
        action={onConfirmAction} />
{/if}

<Toast />

{#if showUpgrade && user}
    <Upgrade on:cancel={() => (showUpgrade = false)} />
{/if}

{#if modal !== ModalType.None}
    <Overlay
        dismissible={modal !== ModalType.SelectChat && modal !== ModalType.Wallet}
        alignLeft={modal === ModalType.SelectChat}
        on:close={closeModal}>
        {#if modal === ModalType.SelectChat}
            <SelectChatModal
                chatsSummaries={filterChatSelection($chatSummariesListStore, $selectedChatId)}
                on:close={onCloseSelectChat}
                on:select={onSelectChat} />
        {:else if modal === ModalType.Suspended}
            <SuspendedModal on:close={closeModal} />
        {:else if modal === ModalType.NoAccess}
            <NoAccess on:close={closeNoAccess} />
        {:else if modal === ModalType.GateCheckFailed && joining !== undefined}
            <GateCheckFailed on:close={closeModal} gate={joining.gate} />
        {:else if modal === ModalType.NewGroup && candidateGroup !== undefined}
            <NewGroup on:upgrade={upgrade} {candidateGroup} on:close={closeModal} />
        {:else if modal === ModalType.EditCommunity && candidateCommunity !== undefined}
            <EditCommunity
                originalRules={candidateCommunityRules}
                original={candidateCommunity}
                on:close={closeModal} />
        {:else if modal === ModalType.Wallet}
            <AccountsModal on:close={closeModal} />
        {:else if modal === ModalType.HallOfFame}
            <HallOfFame on:close={closeModal} />
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

<style lang="scss">
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

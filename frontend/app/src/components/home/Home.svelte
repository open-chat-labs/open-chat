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
    import type {
        Notification,
        GroupSearchResponse,
        MessageMatch,
        SearchAllMessagesResponse,
        UserSummary,
        ChatSummary,
        EnhancedReplyContext,
        EventWrapper,
        GroupChatSummary,
        GroupRules,
        MemberRole,
        Message,
        Questions,
        WebRtcMessage,
        OpenChat,
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
    import {
        closeNotificationsForChat,
        initNotificationsServiceWorker,
    } from "../../utils/notifications";
    import { filterByChatType, RightPanelState } from "./rightPanel";
    import { rollbar } from "../../utils/logging";
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

    $: mutedChatsStore = client.mutedChatsStore;
    $: archivedChatsStore = client.archivedChatsStore;
    $: pinnedChatsStore = client.pinnedChatsStore;
    $: blockedUsers = client.blockedUsers;
    $: userStore = client.userStore;
    $: unconfirmed = client.unconfirmed;
    $: chatSummariesListStore = client.chatSummariesListStore;
    $: chatSummariesStore = client.chatSummariesStore;
    $: chatsLoading = client.chatsLoading;
    $: selectedChatStore = client.selectedChatStore;
    $: selectedChatId = client.selectedChatId;
    $: chatsInitialised = client.chatsInitialised;
    $: serverChatSummariesStore = client.serverChatSummariesStore;
    $: currentChatDraftMessage = client.currentChatDraftMessage;
    $: chatStateStore = client.chatStateStore;

    $: userId = client.user.userId;
    $: wasmVersion = client.user.wasmVersion;
    $: qs = new URLSearchParams($querystring);
    $: confirmMessage = getConfirmMessage(confirmActionEvent);
    $: combinedMetrics = $chatSummariesListStore
        .map((c) => c.myMetrics)
        .reduce(client.mergeChatMetrics, client.emptyChatMetrics());
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
        // bootstrap anything that needs a service container here
        client.initWebRtc();
        client.initNotificationStores();
        client.subscribeToWebRtc((msg) => routeRtcMessages(msg as WebRtcMessage));
        initNotificationsServiceWorker(client, (n) => notificationReceived(n));
        client.startPruningLocalUpdates();
    });

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

    async function newChatSelected(
        chatId: string,
        messageIndex?: number,
        threadMessageIndex?: number
    ): Promise<void> {
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
                if (!(await previewChat(chatId))) {
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
        client.setSelectedChat(client.api, chat, messageIndex, threadMessageIndex);
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
                        newChatSelected(
                            pathParams.chatId,
                            pathParams.messageIndex,
                            pathParams.threadMessageIndex
                        );
                    } else {
                        // if the chat in the url is *the same* as the selected chat
                        // *and* if we have a messageIndex specified in the url
                        if (pathParams.messageIndex !== undefined) {
                            chatStateStore.setProp(
                                pathParams.chatId,
                                "focusThreadMessageIndex",
                                pathParams.threadMessageIndex
                            );
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

    /**
     * We may wish to look at chats without joining them.
     * If the chat is either a public group or a private group with an invite code then
     * we load the chat summary directly.
     * We will then add that chat to our chat list locally with a custom role of "Previewer"
     * This will allow us to interact with the chat in a readonly mode.
     *
     * We will load the chat and then add it to the chat list. If we refresh the page
     * it will just disappear (unless of course we still have the canisterId in the url)
     */
    function previewChat(chatId: string): Promise<boolean> {
        return client.api.getPublicGroupSummary(chatId).then((maybeChat) => {
            if (maybeChat === undefined) {
                return false;
            }
            addOrReplaceChat(maybeChat);
            return true;
        });
    }

    function addOrReplaceChat(chat: ChatSummary): void {
        serverChatSummariesStore.update((summaries) => {
            return {
                ...summaries,
                [chat.chatId]: chat,
            };
        });
    }

    function notificationReceived(notification: Notification): void {
        let chatId: string;
        let threadRootMessageIndex: number | undefined = undefined;
        let message: EventWrapper<Message>;
        switch (notification.kind) {
            case "direct_notification": {
                chatId = notification.sender;
                threadRootMessageIndex = notification.threadRootMessageIndex;
                message = notification.message;
                break;
            }
            case "group_notification": {
                chatId = notification.chatId;
                threadRootMessageIndex = notification.threadRootMessageIndex;
                message = notification.message;
                break;
            }
            case "direct_reaction": {
                chatId = notification.them;
                message = notification.message;
                break;
            }
            case "group_reaction":
                chatId = notification.chatId;
                threadRootMessageIndex = notification.threadRootMessageIndex;
                message = notification.message;
                break;
            case "added_to_group_notification":
                return;
        }

        if (threadRootMessageIndex !== undefined) {
            // TODO fix this for thread messages
            return;
        }

        const chat = $serverChatSummariesStore[chatId];
        if (chat === undefined || chat.latestEventIndex >= message.index) {
            return;
        }

        client.setCachedMessageFromNotification(chatId, threadRootMessageIndex, message);

        const chatType = chat.kind === "direct_chat" ? "direct" : "group";
        Promise.all([
            client.api.rehydrateMessage(
                chatType,
                chatId,
                message,
                undefined,
                chat.latestEventIndex
            ),
            addMissingUsersFromMessage(message),
        ]).then(([m, _]) => {
            client.updateSummaryWithConfirmedMessage(chatId, m);

            if ($selectedChatId === chatId) {
                currentChatMessages?.handleMessageSentByOtherExternal(m);
            }
        });
    }

    async function addMissingUsersFromMessage(message: EventWrapper<Message>): Promise<void> {
        const users = client.userIdsFromEvents([message]);
        const missingUsers = client.missingUserIds($userStore, users);
        if (missingUsers.length > 0) {
            const usersResp = await client.api.getUsers(
                {
                    userGroups: [
                        {
                            users: missingUsers,
                            updatedSince: BigInt(0),
                        },
                    ],
                },
                true
            );
            userStore.addMany(usersResp.users);
        }
    }

    function resetRightPanel() {
        rightPanelHistory = filterByChatType(rightPanelHistory, $selectedChatStore);
    }

    function userAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>): void {
        const data = {
            blobData: ev.detail.data,
            blobUrl: ev.detail.url,
        };

        client.user = {
            ...user,
            ...data,
        };

        const partialUser = $userStore[user.userId];
        if (partialUser) {
            userStore.add({
                ...partialUser,
                ...data,
            });
        }

        client.api
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            .setUserAvatar(data.blobData!)
            .then((_resp) => toastStore.showSuccessToast("avatarUpdated"))
            .catch((err) => {
                rollbar.error("Failed to update user's avatar", err);
                toastStore.showFailureToast("avatarUpdateFailed");
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
        blockedUsers.add(ev.detail.userId);
        client.api
            .blockUserFromDirectChat(ev.detail.userId)
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
        client.api
            .unblockUserFromDirectChat(ev.detail.userId)
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

    function pinChat(ev: CustomEvent<string>) {
        const pinnedChatLimit = 5;
        if ($pinnedChatsStore.length >= pinnedChatLimit) {
            toastStore.showSuccessToast("pinChat.limitExceeded", {
                values: { limit: pinnedChatLimit },
            });
            return;
        }

        const chatId = ev.detail;
        pinnedChatsStore.pin(chatId);
        client.api
            .pinChat(chatId)
            .then((resp) => {
                if (resp.kind === "pinned_limit_reached") {
                    toastStore.showFailureToast("pinChat.limitExceeded", {
                        values: { limit: resp.limit },
                    });
                    pinnedChatsStore.unpin(chatId);
                }
            })
            .catch((err) => {
                toastStore.showFailureToast("pinChat.failed");
                rollbar.error("Error pinning chat", err);
                pinnedChatsStore.unpin(chatId);
            });
    }

    function unpinChat(ev: CustomEvent<string>) {
        const chatId = ev.detail;
        pinnedChatsStore.unpin(chatId);
        client.api.unpinChat(chatId).catch((err) => {
            toastStore.showFailureToast("pinChat.unpinFailed");
            rollbar.error("Error unpinning chat", err);
            pinnedChatsStore.pin(chatId);
        });
    }

    function onArchiveChat(ev: CustomEvent<string>) {
        const chatId = ev.detail;
        archivedChatsStore.set(chatId, true);
        client.api.archiveChat(chatId).catch((err) => {
            toastStore.showFailureToast("archiveChatFailed");
            rollbar.error("Error archiving chat", err);
            archivedChatsStore.set(chatId, false);
        });
        if (chatId === $selectedChatId) {
            push("/");
        }
    }

    function onUnarchiveChat(ev: CustomEvent<string>) {
        unarchiveChat(ev.detail);
    }

    function unarchiveChat(chatId: string) {
        archivedChatsStore.set(chatId, false);
        client.api.unarchiveChat(chatId).catch((err) => {
            toastStore.showFailureToast("unarchiveChatFailed");
            rollbar.error("Error un-archiving chat", err);
            archivedChatsStore.set(chatId, true);
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
        return client.api
            .makeGroupPrivate(chatId)
            .then((resp) => {
                if (resp === "success") {
                    serverChatSummariesStore.update((summaries) => {
                        const summary = summaries[chatId];
                        if (summary === undefined || summary.kind !== "group_chat") {
                            return summaries;
                        }

                        return {
                            ...summaries,
                            [chatId]: {
                                ...summary,
                                public: false,
                            },
                        };
                    });
                } else {
                    toastStore.showFailureToast("makeGroupPrivateFailed");
                }
            })
            .catch((err) => {
                toastStore.showFailureToast("makeGroupPrivateFailed");
                rollbar.error("Error making group private", err);
            });
    }

    function deleteGroup(chatId: string): Promise<void> {
        push("/");
        return client.api
            .deleteGroup(chatId)
            .then((resp) => {
                if (resp === "success") {
                    toastStore.showSuccessToast("deleteGroupSuccess");
                    client.removeChat(chatId);
                } else {
                    rollbar.warn("Unable to delete group", resp);
                    toastStore.showFailureToast("deleteGroupFailure");
                    push(`/${chatId}`);
                }
            })
            .catch((err) => {
                toastStore.showFailureToast("deleteGroupFailure");
                rollbar.error("Unable to delete group", err);
                push(`/${chatId}`);
            });
    }

    function leaveGroup(chatId: string): Promise<void> {
        push("/");
        return client.api
            .leaveGroup(chatId)
            .then((resp) => {
                if (resp === "success" || resp === "not_in_group" || resp === "group_not_found") {
                    toastStore.showSuccessToast("leftGroup");
                    client.removeChat(chatId);
                } else {
                    if (resp === "owner_cannot_leave") {
                        toastStore.showFailureToast("ownerCantLeave");
                    } else {
                        toastStore.showFailureToast("failedToLeaveGroup");
                    }
                    push(`/${chatId}`);
                }
            })
            .catch((err) => {
                toastStore.showFailureToast("failedToLeaveGroup");
                rollbar.error("Unable to leave group", err);
                push(`/${chatId}`);
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

    function openThread(ev: CustomEvent<{ rootEvent: EventWrapper<Message> }>) {
        if ($selectedChatId !== undefined) {
            rightPanelHistory = [
                {
                    kind: "message_thread_panel",
                    rootEvent: ev.detail.rootEvent,
                },
            ];
        }
    }

    function initiateThread(
        ev: CustomEvent<{ rootEvent: EventWrapper<Message>; focusThreadMessageIndex?: number }>
    ) {
        if ($selectedChatId !== undefined) {
            creatingThread = true;
            replace(`/${$selectedChatId}`);
            openThread(ev);
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
        addOrReplaceChat(ev.detail);
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
        return client.api
            .joinGroup(group.chatId)
            .then((resp) => {
                if (resp.kind === "group_chat") {
                    addOrReplaceChat(resp);
                    return true;
                } else if (resp.kind === "already_in_group") {
                    addOrReplaceChat({
                        ...group,
                        myRole: "participant" as MemberRole,
                    });
                    return true;
                } else {
                    if (resp.kind === "blocked") {
                        toastStore.showFailureToast("youreBlocked");
                    } else {
                        toastStore.showFailureToast("joinGroupFailed");
                    }
                    return false;
                }
            })
            .then((success) => {
                if (success && select) {
                    hotGroups = { kind: "idle" };
                    push(`/${group.chatId}`);
                }
            })
            .catch((err) => {
                rollbar.error("Unable to join group", err);
                toastStore.showFailureToast("joinGroupFailed");
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
        addOrReplaceChat(group);
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
        const mute = ev.detail.mute;
        const chatId = ev.detail.chatId;
        const op = mute ? "muted" : "unmuted";

        mutedChatsStore.set(chatId, mute);

        let success = false;
        client.api
            .toggleMuteNotifications(chatId, mute)
            .then((resp) => {
                success = resp === "success";
            })
            .catch((err) => {
                rollbar.error("Error toggling mute notifications", err);
            })
            .finally(() => {
                if (!success) {
                    toastStore.showFailureToast("toggleMuteNotificationsFailed", {
                        values: { operation: $_(op) },
                    });
                    mutedChatsStore.set(chatId, !mute);
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
            {user}
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
            on:initiateThread={initiateThread}
            on:clearSelection={() => push("/")}
            on:blockUser={blockUser}
            on:unblockUser={unblockUser}
            on:leaveGroup={triggerConfirm}
            on:chatWith={chatWith}
            on:replyPrivatelyTo={replyPrivatelyTo}
            on:addMembers={addMembers}
            on:showGroupDetails={showGroupDetails}
            on:showProposalFilters={showProposalFilters}
            on:openThread={openThread}
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
            on:closeThread={closeThread}
            on:goToMessageIndex={goToMessageIndex}
            on:forward={forwardMessage} />
    {/if}
    {#if $numberOfColumns === 3}
        <RightPanel
            {userId}
            metrics={combinedMetrics}
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
                {userId}
                metrics={combinedMetrics}
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

<script lang="ts">
    import BackgroundLogo from "../BackgroundLogo.svelte";
    import { _ } from "svelte-i18n";
    import LeftPanel from "./LeftPanel.svelte";
    import Toast from "../Toast.svelte";
    import AboutModal from "../AboutModal.svelte";
    import FaqModal from "../FaqModal.svelte";
    import RoadmapModal from "../RoadmapModal.svelte";
    import SelectChatModal from "../SelectChatModal.svelte";
    import MiddlePanel from "./MiddlePanel.svelte";
    import RightPanel from "./RightPanel.svelte";
    import { fly } from "svelte/transition";
    import type { Notification } from "../../domain/notifications";
    import Overlay from "../Overlay.svelte";
    import { onMount, setContext, tick } from "svelte";
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
    import type {
        GroupSearchResponse,
        MessageMatch,
        SearchAllMessagesResponse,
    } from "../../domain/search/search";
    import type { CreatedUser, UserSummary } from "../../domain/user/user";
    import { blockedUsers } from "../../stores/blockedUsers";
    import { rtcConnectionsManager } from "../../domain/webrtc/RtcConnectionsManager";
    import { userStore } from "../../stores/user";
    import { fullScreen } from "../../stores/settings";
    import { initNotificationStores } from "../../stores/notifications";
    import { filterByChatType, RightPanelState } from "../../fsm/rightPanel";
    import { rollbar } from "../../utils/logging";
    import type {
        ChatSummary,
        EnhancedReplyContext,
        EventWrapper,
        GroupChatSummary,
        MemberRole,
        Message,
    } from "../../domain/chat/chat";
    import { currentUserKey } from "../../stores/user";
    import { mapRemoteData } from "../../utils/remoteData";
    import type { RemoteData } from "../../utils/remoteData";
    import Upgrade from "./upgrade/Upgrade.svelte";
    import type { Questions } from "../../domain/faq";
    import { apiKey, ServiceContainer } from "../../services/serviceContainer";
    import type { Share } from "../../domain/share";
    import { draftMessages } from "../../stores/draftMessages";
    import AreYouSure from "../AreYouSure.svelte";
    import { removeQueryStringParam } from "../../utils/urls";
    import {
        canSendMessages,
        mergeChatMetrics,
        userIdsFromEvents,
    } from "../../domain/chat/chat.utils";
    import { emptyChatMetrics } from "../../domain/chat/chat.utils.shared";
    import { trackEvent } from "../../utils/tracking";
    import { numberOfColumns } from "../../stores/layout";
    import { messageToForwardStore } from "../../stores/messageToForward";
    import {
        chatSummariesListStore,
        chatSummariesStore,
        chatsLoading,
        selectedChatStore,
        chatsInitialised,
        createDirectChat,
        setSelectedChat,
        serverChatSummariesStore,
        currentUserStore,
        removeChat,
        updateSummaryWithConfirmedMessage,
        clearSelectedChat,
    } from "../../stores/chat";
    import { setCachedMessageFromNotification } from "../../utils/caching";
    import { missingUserIds } from "../../domain/user/user.utils";
    import { handleWebRtcMessage } from "../../domain/webrtc/rtcHandler";
    import { startPruningLocalReactions } from "../../stores/reactions";
    import { pinnedChatsStore } from "../../stores/pinnedChats";
    import type Thread from "./thread/Thread.svelte";
    import type { WebRtcMessage } from "domain/webrtc/webrtc";
    import { mutedChatsStore } from "../../stores/mutedChatsStore";

    export let api: ServiceContainer;
    export let user: CreatedUser;
    export let logout: () => void;

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
    setContext(apiKey, api);
    setContext(currentUserKey, user);

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

    $: userId = user.userId;
    $: wasmVersion = user.wasmVersion;
    $: qs = new URLSearchParams($querystring);
    $: confirmMessage = getConfirmMessage(confirmActionEvent);
    $: combinedMetrics = $chatSummariesListStore
        .map((c) => c.myMetrics)
        .reduce(mergeChatMetrics, emptyChatMetrics());
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
        rtcConnectionsManager.init(user.userId);
        rtcConnectionsManager.subscribe((msg) => routeRtcMessages(msg as WebRtcMessage));
        initNotificationStores(api, user.userId, (n) => notificationReceived(n));
        startPruningLocalReactions();
    });

    function routeRtcMessages(msg: WebRtcMessage) {
        if (msg.threadRootMessageIndex !== undefined) {
            // do we have the thread window open for this thread
            threadComponent?.handleWebRtcMessage(msg);
        } else {
            handleWebRtcMessage(msg);
        }
    }

    function newChatSelected(chatId: string, messageIndex?: number, threadMessageIndex?: number) {
        interruptRecommended = true;

        // if this is an unknown chat let's preview it
        if ($chatSummariesStore[chatId] === undefined) {
            if (qs.get("type") === "direct") {
                createDirectChat(chatId);
                hotGroups = { kind: "idle" };
            } else {
                const code = qs.get("code");
                if (code) {
                    api.groupInvite = {
                        chatId,
                        code,
                    };
                }
                previewChat(chatId).then((canPreview) => {
                    if (canPreview) {
                        setSelectedChat(api, chatId, messageIndex, threadMessageIndex);
                        resetRightPanel();
                        hotGroups = { kind: "idle" };
                    } else {
                        replace("/");
                    }
                });
            }
        } else {
            // if it's a known chat let's select it
            setSelectedChat(api, chatId, messageIndex, threadMessageIndex);
            resetRightPanel();
            hotGroups = { kind: "idle" };
        }
    }

    // extracting to a function to try to control more tightly what this reacts to
    function routeChange(initialised: boolean, pathParams: RouteParams): void {
        // wait until we have loaded the chats
        if (initialised) {
            if (pathParams.chatId === "threads") {
                closeThread();
                clearSelectedChat();
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
                    if (pathParams.chatId !== $selectedChatStore?.chatId?.toString()) {
                        newChatSelected(
                            pathParams.chatId,
                            pathParams.messageIndex,
                            pathParams.threadMessageIndex
                        );
                    } else {
                        // if the chat in the url is *the same* as the selected chat
                        // *and* if we have a messageIndex specified in the url
                        if (pathParams.messageIndex !== undefined) {
                            $selectedChatStore?.goToMessageIndex(
                                pathParams.messageIndex,
                                false,
                                pathParams.threadMessageIndex
                            );
                        }
                    }
                } else {
                    // we do *not* have a chat in the url
                    if ($selectedChatStore !== undefined) {
                        clearSelectedChat();
                    }

                    if (!$mobileWidth && hotGroups.kind === "idle") {
                        whatsHot();
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
     * it will just disppear (unless of course we still have the canisterId in the url)
     */
    function previewChat(chatId: string): Promise<boolean> {
        return api.getPublicGroupSummary(chatId).then((maybeChat) => {
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
        let message: EventWrapper<Message>;
        switch (notification.kind) {
            case "direct_notification": {
                chatId = notification.sender;
                message = notification.message;
                break;
            }
            case "group_notification": {
                chatId = notification.chatId;
                message = notification.message;
                break;
            }
            case "added_to_group_notification":
                return;
        }

        const chat = $chatSummariesStore[chatId];
        if (chat === undefined) {
            return;
        }
        const chatType = chat.kind === "direct_chat" ? "direct" : "group";
        setCachedMessageFromNotification(notification);
        Promise.all([
            api.rehydrateMessage(chatType, chatId, message),
            addMissingUsersFromMessage(message),
        ]).then(([m, _]) => {
            updateSummaryWithConfirmedMessage(chatId, m);

            const selectedChat = $selectedChatStore;
            if (selectedChat?.chatId === chatId) {
                selectedChat?.handleMessageSentByOther(m, true);
            }
        });
    }

    async function addMissingUsersFromMessage(message: EventWrapper<Message>): Promise<void> {
        const users = userIdsFromEvents([message]);
        const missingUsers = missingUserIds($userStore, users);
        if (missingUsers.length > 0) {
            const usersResp = await api.getUsers(
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
        rightPanelHistory = filterByChatType(rightPanelHistory, $selectedChatStore?.chatVal);
    }

    function userAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>): void {
        const data = {
            blobData: ev.detail.data,
            blobUrl: ev.detail.url,
        };
        user = {
            ...user,
            ...data,
        };
        currentUserStore.set(user);

        const partialUser = $userStore[user.userId];
        if (partialUser) {
            userStore.add({
                ...partialUser,
                ...data,
            });
        }

        api
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            .setUserAvatar(data.blobData!)
            .then((_resp) => toastStore.showSuccessToast("avatarUpdated"))
            .catch((err) => {
                rollbar.error("Failed to update user's avatar", err);
                toastStore.showFailureToast("avatarUpdateFailed");
            });
    }

    function goToMessageIndex(ev: CustomEvent<{ index: number; preserveFocus: boolean }>) {
        $selectedChatStore?.goToMessageIndex(ev.detail.index, ev.detail.preserveFocus);
    }

    function closeModal() {
        modal = ModalType.None;
    }

    function cancelRecommendations() {
        hotGroups = { kind: "idle" };
    }

    function dismissRecommendation(ev: CustomEvent<string>) {
        hotGroups = mapRemoteData(hotGroups, (data) => data.filter((g) => g.chatId !== ev.detail));
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
        api.pinChat(chatId)
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
        api.unpinChat(chatId).catch((err) => {
            toastStore.showFailureToast("pinChat.unpinFailed");
            rollbar.error("Error unpinning chat", err);
            pinnedChatsStore.pin(chatId);
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
                return leaveGroup(confirmActionEvent.chatId);
            case "delete":
                return deleteGroup(confirmActionEvent.chatId).then((_) => {
                    rightPanelHistory = [];
                });
            case "makePrivate":
                return makeGroupPrivate(confirmActionEvent.chatId).then((_) => {
                    rightPanelHistory = [];
                });
            default:
                return Promise.reject();
        }
    }

    function makeGroupPrivate(chatId: string): Promise<void> {
        return api
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
        return api
            .deleteGroup(chatId)
            .then((resp) => {
                if (resp === "success") {
                    toastStore.showSuccessToast("deleteGroupSuccess");
                    removeChat(chatId);
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
        return api
            .leaveGroup(chatId)
            .then((resp) => {
                if (resp === "success" || resp === "not_in_group" || resp === "group_not_found") {
                    toastStore.showSuccessToast("leftGroup");
                    removeChat(chatId);
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
        tick().then(() => removeChat(ev.detail));
    }

    function chatWith(ev: CustomEvent<string>) {
        const chat = $chatSummariesListStore.find((c) => {
            return c.kind === "direct_chat" && c.them === ev.detail;
        });
        if (chat) {
            push(`/${chat.chatId}`);
        } else {
            createDirectChat(ev.detail);
        }
    }

    function loadMessage(ev: CustomEvent<MessageMatch>): void {
        if (ev.detail.chatId === $selectedChatStore?.chatId) {
            $selectedChatStore.externalGoToMessage(ev.detail.messageIndex);
        } else {
            push(`/${ev.detail.chatId}/${ev.detail.messageIndex}`);
        }
    }

    function addParticipants() {
        if ($selectedChatStore !== undefined) {
            rightPanelHistory = [...rightPanelHistory, { kind: "add_participants" }];
        }
    }

    function replyPrivatelyTo(ev: CustomEvent<EnhancedReplyContext>) {
        const chat = $chatSummariesListStore.find((c) => {
            return c.kind === "direct_chat" && c.them === ev.detail.sender?.userId;
        });
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const chatId = chat?.chatId ?? ev.detail.sender!.userId;
        draftMessages.delete(chatId);
        draftMessages.setReplyingTo(chatId, ev.detail);
        if (chat) {
            push(`/${chat.chatId}`);
        } else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            createDirectChat(ev.detail.sender!.userId);
        }
    }

    function forwardMessage(ev: CustomEvent<Message>) {
        messageToForward = ev.detail;
        modal = ModalType.SelectChat;
    }

    function showParticipants() {
        if ($selectedChatStore !== undefined) {
            rightPanelHistory = [...rightPanelHistory, { kind: "show_participants" }];
        }
    }

    function showProfile() {
        if ($selectedChatStore !== undefined) {
            replace(`/${$selectedChatStore.chatId}`);
        }
        rightPanelHistory = [{ kind: "user_profile" }];
    }

    function openThread(
        ev: CustomEvent<{ rootEvent: EventWrapper<Message>; focusThreadMessageIndex?: number }>
    ) {
        if ($selectedChatStore !== undefined) {
            rightPanelHistory = [
                {
                    kind: "message_thread_panel",
                    rootEvent: ev.detail.rootEvent,
                    focusThreadMessageIndex: ev.detail.focusThreadMessageIndex,
                },
            ];
        }
    }

    function initiateThread(
        ev: CustomEvent<{ rootEvent: EventWrapper<Message>; focusThreadMessageIndex?: number }>
    ) {
        if ($selectedChatStore !== undefined) {
            creatingThread = true;
            replace(`/${$selectedChatStore.chatId}`);
            openThread(ev);
        }
    }

    function showGroupDetails() {
        if ($selectedChatStore !== undefined) {
            replace(`/${$selectedChatStore.chatId}`);
            rightPanelHistory = [
                {
                    kind: "group_details",
                },
            ];
        }
    }

    function showProposalFilters() {
        if ($selectedChatStore !== undefined) {
            replace(`/${$selectedChatStore.chatId}`);
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
        if ($selectedChatStore !== undefined) {
            replace(`/${$selectedChatStore.chatId}`);
            rightPanelHistory = [
                {
                    kind: "show_pinned",
                },
            ];
        }
    }

    function joinGroup(ev: CustomEvent<{ group: GroupChatSummary; select: boolean }>) {
        joining = ev.detail.group;
        const group = ev.detail.group;

        api.joinGroup(group.chatId)
            .then((resp) => {
                if (resp.kind === "group_chat") {
                    addOrReplaceChat(resp);
                    setSelectedChat(api, group.chatId);
                    return true;
                } else if (resp.kind === "already_in_group") {
                    addOrReplaceChat({
                        ...group,
                        myRole: "participant" as MemberRole,
                    });
                    setSelectedChat(api, group.chatId);
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
                if (success && ev.detail.select) {
                    hotGroups = { kind: "idle" };
                    push(`/${ev.detail.group.chatId}`);
                }
            })
            .catch((err) => {
                rollbar.error("Unable to join group", err);
                toastStore.showFailureToast("joinGroupFailed");
                return false;
            })
            .finally(() => (joining = undefined));
    }

    function cancelPreview(ev: CustomEvent<string>) {
        push("/");
        tick().then(() => {
            removeChat(ev.detail);
        });
    }

    function whatsHot() {
        push("/");
        tick().then(() => {
            interruptRecommended = false;
            hotGroups = { kind: "loading" };
            api.getRecommendedGroups((_n: number) => interruptRecommended)
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

        draftMessages.setTextContent(chatId, text);
    }

    function groupCreated(ev: CustomEvent<GroupChatSummary>) {
        addOrReplaceChat(ev.detail);
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

    function filterChatSelection(
        chats: ChatSummary[],
        selectedChatId: string | undefined
    ): ChatSummary[] {
        return chats.filter((c) => selectedChatId !== c.chatId && canSendMessages(c, $userStore));
    }

    function toggleMuteNotifications(ev: CustomEvent<{ chatId: string; mute: boolean }>) {
        const mute = ev.detail.mute;
        const chatId = ev.detail.chatId;
        const op = mute ? "muted" : "unmuted";

        mutedChatsStore.toggle(chatId, mute);

        let success = false;
        api.toggleMuteNotifications(chatId, mute)
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
                    mutedChatsStore.toggle(chatId, !mute);
                }
            });
    }

    $: bgHeight = $dimensions.height * 0.9;
    $: bgClip = (($dimensions.height - 32) / bgHeight) * 361;
</script>

<main class:fullscreen={$fullScreen}>
    {#if showLeft}
        <LeftPanel
            {api}
            {user}
            {groupSearchResults}
            {userSearchResults}
            {messageSearchResults}
            {searchTerm}
            {searchResultsAvailable}
            {searching}
            on:showAbout={() => (modal = ModalType.About)}
            on:showFaq={() => (modal = ModalType.Faq)}
            on:showRoadmap={() => (modal = ModalType.Roadmap)}
            on:searchEntered={performSearch}
            on:userAvatarSelected={userAvatarSelected}
            on:chatWith={chatWith}
            on:whatsHot={whatsHot}
            on:newGroup={newGroup}
            on:profile={showProfile}
            on:logout={logout}
            on:deleteDirectChat={deleteDirectChat}
            on:pinChat={pinChat}
            on:unpinChat={unpinChat}
            on:toggleMuteNotifications={toggleMuteNotifications}
            on:loadMessage={loadMessage} />
    {/if}
    {#if showMiddle}
        <MiddlePanel
            {hotGroups}
            {joining}
            loadingChats={$chatsLoading}
            controller={$selectedChatStore}
            on:initiateThread={initiateThread}
            on:clearSelection={() => push("/")}
            on:blockUser={blockUser}
            on:unblockUser={unblockUser}
            on:leaveGroup={triggerConfirm}
            on:chatWith={chatWith}
            on:replyPrivatelyTo={replyPrivatelyTo}
            on:addParticipants={addParticipants}
            on:showGroupDetails={showGroupDetails}
            on:showProposalFilters={showProposalFilters}
            on:openThread={openThread}
            on:showParticipants={showParticipants}
            on:updateChat={updateChat}
            on:joinGroup={joinGroup}
            on:cancelPreview={cancelPreview}
            on:cancelRecommendations={cancelRecommendations}
            on:recommend={whatsHot}
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
            controller={$selectedChatStore}
            metrics={combinedMetrics}
            bind:rightPanelHistory
            bind:thread={threadComponent}
            on:showFaqQuestion={showFaqQuestion}
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

{#if $numberOfColumns === 2 && rightPanelHistory.length > 0}
    <Overlay fade={!$mobileWidth}>
        <div
            transition:fly={{ x, duration: rightPanelSlideDuration, easing: sineInOut }}
            class="right-wrapper"
            class:rtl={$rtlStore}>
            <RightPanel
                {userId}
                controller={$selectedChatStore}
                metrics={combinedMetrics}
                bind:rightPanelHistory
                bind:thread={threadComponent}
                on:showFaqQuestion={showFaqQuestion}
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

{#if upgradeStorage && user}
    <Upgrade
        {user}
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
                chatsSummaries={filterChatSelection(
                    $chatSummariesListStore,
                    $selectedChatStore?.chatId
                )}
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
            height: 100%;
        }
    }
</style>

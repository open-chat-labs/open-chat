<script lang="ts">
    import BackgroundLogo from "../BackgroundLogo.svelte";
    import { _ } from "svelte-i18n";
    import LeftPanel from "./LeftPanel.svelte";
    import type CurrentChatMessages from "./CurrentChatMessages.svelte";
    import Toast from "../Toast.svelte";
    import SelectChatModal from "../SelectChatModal.svelte";
    import MiddlePanel from "./MiddlePanel.svelte";
    import ViewUserProfile from "./profile/ViewUserProfile.svelte";
    import EditCommunity from "./communities/edit/Edit.svelte";
    import type {
        EnhancedReplyContext,
        Rules,
        Message,
        OpenChat,
        Notification,
        CandidateGroupChat,
        EventWrapper,
        ChatType,
        CommunitySummary,
        Level,
        ChatIdentifier,
        DirectChatIdentifier,
        GroupChatIdentifier,
        CommunityIdentifier,
        MultiUserChat,
        MultiUserChatIdentifier,
        GroupChatSummary,
        ChannelIdentifier,
        UpdatedRules,
        ResourceKey,
        NervousSystemDetails,
        EnhancedAccessGate,
        GateCheckSucceeded,
    } from "openchat-client";
    import {
        ChatsUpdated,
        SelectedChatInvalid,
        SendMessageFailed,
        ThreadClosed,
        RemoteVideoCallStartedEvent,
        ThreadSelected,
        defaultChatRules,
        chatIdentifiersEqual,
        nullMembership,
        routeForChatIdentifier,
        routeForMessage,
        UserSuspensionChanged,
        RemoteVideoCallEndedEvent,
        currentUser as user,
        suspendedUser,
        anonUser,
        identityState,
        chatSummariesListStore,
        chatSummariesStore,
        selectedChatStore,
        selectedChatId,
        chatsInitialised,
        draftMessagesStore,
        chatStateStore,
        chatListScopeStore as chatListScope,
        currentCommunityRules,
        communities,
        offlineStore,
        capturePinNumberStore as pinNumberStore,
        captureRulesAcceptanceStore as rulesAcceptanceStore,
        SummonWitch,
        RegisterBot,
        UpdateBot,
        userStore,
        RemoveBot,
    } from "openchat-client";
    import Overlay from "../Overlay.svelte";
    import { getContext, onMount, tick } from "svelte";
    import { mobileWidth, screenWidth, ScreenWidth } from "../../stores/screenDimensions";
    import page from "page";
    import { pageRedirect, pageReplace, pathParams, routeForScope } from "../../routes";
    import type { RouteParams } from "../../routes";
    import { toastStore } from "../../stores/toast";
    import {
        closeNotificationsForChat,
        closeNotifications,
        subscribeToNotifications,
    } from "../../utils/notifications";
    import {
        filterByChatType,
        filterRightPanelHistory,
        pushRightPanelHistory,
        rightPanelHistory,
    } from "../../stores/rightPanel";
    import Upgrade from "./upgrade/Upgrade.svelte";
    import AreYouSure from "../AreYouSure.svelte";
    import { removeQueryStringParam } from "../../utils/urls";
    import { fullWidth, layoutStore } from "../../stores/layout";
    import { dimensions } from "../../stores/screenDimensions";
    import { messageToForwardStore } from "../../stores/messageToForward";
    import type { Share } from "../../utils/share";
    import {
        currentTheme,
        currentThemeName,
        preferredDarkThemeName,
        themeType,
    } from "../../theme/themes";
    import SuspendedModal from "../SuspendedModal.svelte";
    import NoAccess from "./NoAccess.svelte";
    import CreateOrUpdateGroup from "./createOrUpdateGroup/CreateOrUpdateGroup.svelte";
    import AccountsModal from "./profile/AccountsModal.svelte";
    import { querystring } from "../../routes";
    import { eventListScrollTop } from "../../stores/scrollPos";
    import GateCheckFailed from "./access/AccessGateCheckFailed.svelte";
    import HallOfFame from "./ChitHallOfFame.svelte";
    import LeftNav from "./nav/LeftNav.svelte";
    import MakeProposalModal from "./MakeProposalModal.svelte";
    import { createCandidateCommunity } from "../../stores/community";
    import Convert from "./communities/Convert.svelte";
    import type { ProfileLinkClickedEvent } from "../web-components/profileLink";
    import Register from "../register/Register.svelte";
    import LoggingInModal from "./LoggingInModal.svelte";
    import AnonFooter from "./AnonFooter.svelte";
    import OfflineFooter from "../OfflineFooter.svelte";
    import RightPanel from "./RightPanelWrapper.svelte";
    import EditLabel from "../EditLabel.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import NotFound from "../NotFound.svelte";
    import { activeVideoCall, incomingVideoCall } from "../../stores/video";
    import PinNumberModal from "./PinNumberModal.svelte";
    import AcceptRulesModal from "./AcceptRulesModal.svelte";
    import DailyChitModal from "./DailyChitModal.svelte";
    import ChallengeModal from "./ChallengeModal.svelte";
    import ChitEarned from "./ChitEarned.svelte";
    import { chitPopup } from "../../stores/settings";
    import AccessGateEvaluator from "./access/AccessGateEvaluator.svelte";
    import SetPinNumberModal from "./profile/SetPinNumberModal.svelte";
    import { scream } from "../../utils/scream";
    import BotBuilderModal from "../bots/BotBuilderModal.svelte";
    import VerifyHumanity from "./profile/VerifyHumanity.svelte";

    type ViewProfileConfig = {
        userId: string;
        chatButton: boolean;
        alignTo?: DOMRect;
        inGlobalContext: boolean;
    };

    const client = getContext<OpenChat>("client");

    let convertGroup: GroupChatSummary | undefined = undefined;
    let showProfileCard: ViewProfileConfig | undefined = undefined;

    type ConfirmActionEvent =
        | ConfirmLeaveEvent
        | ConfirmDeleteEvent
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
        doubleCheck: { challenge: ResourceKey; response: ResourceKey };
    };

    type ConfirmDeleteCommunityEvent = {
        kind: "delete_community";
        communityId: CommunityIdentifier;
        doubleCheck: { challenge: ResourceKey; response: ResourceKey };
    };

    type ModalType =
        | { kind: "none" }
        | { kind: "verify_humanity" }
        | { kind: "select_chat" }
        | { kind: "register_bot" }
        | { kind: "update_bot" }
        | { kind: "remove_bot" }
        | { kind: "suspended" }
        | { kind: "no_access" }
        | { kind: "new_group"; embeddedContent: boolean; candidate: CandidateGroupChat }
        | { kind: "wallet" }
        | { kind: "gate_check_failed"; gates: EnhancedAccessGate[] }
        | { kind: "hall_of_fame" }
        | { kind: "edit_community"; community: CommunitySummary; communityRules: Rules }
        | { kind: "make_proposal"; chat: MultiUserChat; nervousSystem: NervousSystemDetails }
        | { kind: "registering" }
        | { kind: "logging_in" }
        | { kind: "not_found" }
        | { kind: "claim_daily_chit" }
        | { kind: "challenge" }
        | {
              kind: "evaluating_access_gates";
              group: MultiUserChat;
              select: boolean;
              gates: EnhancedAccessGate[];
              level: Level;
          };

    let modal: ModalType = { kind: "none" };
    let confirmActionEvent: ConfirmActionEvent | undefined;
    let joining: MultiUserChat | undefined = undefined;
    let showUpgrade: boolean = false;
    let share: Share = { title: "", text: "", url: "", files: [] };
    let messageToForward: Message | undefined = undefined;
    let creatingThread = false;
    let currentChatMessages: CurrentChatMessages | undefined;

    $: confirmMessage = getConfirmMessage(confirmActionEvent);

    $: selectedMultiUserChat =
        $selectedChatStore?.kind === "group_chat" || $selectedChatStore?.kind === "channel"
            ? $selectedChatStore
            : undefined;
    $: governanceCanisterId =
        selectedMultiUserChat !== undefined
            ? selectedMultiUserChat.subtype?.governanceCanisterId
            : undefined;
    $: nervousSystem = client.tryGetNervousSystem(governanceCanisterId);
    $: {
        if ($identityState.kind === "registering") {
            modal = { kind: "registering" };
        } else if ($identityState.kind === "logging_in") {
            modal = { kind: "logging_in" };
        } else if ($identityState.kind === "logged_in" && modal.kind === "registering") {
            console.log("We are now logged in so we are closing the register modal");
            closeModal();
        } else if ($identityState.kind === "challenging") {
            modal = { kind: "challenge" };
        }
        if (
            $identityState.kind === "logged_in" &&
            $identityState.postLogin?.kind === "join_group" &&
            $chatsInitialised
        ) {
            const ev = new CustomEvent("joinGroup", { detail: { ...$identityState.postLogin } });
            client.clearPostLoginState();
            tick().then(() => joinGroup(ev));
        }
    }

    $: {
        tick().then(() => {
            routeChange($chatsInitialised, $pathParams);
        });
    }

    onMount(() => {
        subscribeToNotifications(client, (n) => client.notificationReceived(n));
        client.addEventListener("openchat_event", clientEvent);

        if ($suspendedUser) {
            modal = { kind: "suspended" };
        }

        return () => {
            client.removeEventListener("openchat_event", clientEvent);
        };
    });

    function clientEvent(ev: Event): void {
        if (ev instanceof ThreadSelected) {
            openThread(ev.detail);
        } else if (ev instanceof RegisterBot) {
            modal = { kind: "register_bot" };
        } else if (ev instanceof UpdateBot) {
            modal = { kind: "update_bot" };
        } else if (ev instanceof RemoveBot) {
            modal = { kind: "remove_bot" };
        } else if (ev instanceof SummonWitch) {
            summonWitch();
        } else if (ev instanceof RemoteVideoCallStartedEvent) {
            remoteVideoCallStarted(ev);
        } else if (ev instanceof RemoteVideoCallEndedEvent) {
            remoteVideoCallEnded(ev);
        } else if (ev instanceof ThreadClosed) {
            closeThread();
        } else if (ev instanceof SendMessageFailed) {
            // This can occur either for chat messages or thread messages so we'll just handle it here
            if (ev.detail.alert) {
                toastStore.showFailureToast(i18nKey("errorSendingMessage"));
            }
        } else if (ev instanceof ChatsUpdated) {
            closeNotifications((notification: Notification) => {
                if (
                    notification.kind === "channel_notification" ||
                    notification.kind === "direct_notification" ||
                    notification.kind === "group_notification"
                ) {
                    return client.isMessageRead(
                        {
                            chatId: notification.chatId,
                        },
                        notification.messageIndex,
                        undefined,
                    );
                }

                return false;
            });
        } else if (ev instanceof SelectedChatInvalid) {
            pageReplace(routeForScope(client.getDefaultScope()));
        } else if (ev instanceof UserSuspensionChanged) {
            // The latest suspension details will be picked up on reload when user_index::current_user is called
            window.location.reload();
        }
    }

    function summonWitch() {
        const isHalloweenTheme = $currentThemeName === "halloween";
        if (!isHalloweenTheme) {
            themeType.set("dark");
            preferredDarkThemeName.set("halloween");
        }
        document.body.classList.add("witch");
        scream.currentTime = 0;
        scream.play();
        window.setTimeout(() => {
            document.body.classList.remove("witch");
        }, 2000);
    }

    function remoteVideoCallEnded(ev: RemoteVideoCallEndedEvent) {
        if ($incomingVideoCall?.messageId === ev.detail.messageId) {
            incomingVideoCall.set(undefined);
        }
    }

    function remoteVideoCallStarted(ev: RemoteVideoCallStartedEvent) {
        // If current user is already in the call, or has previously been in the call, or the call started more than an hour ago, exit
        if (
            chatIdentifiersEqual($activeVideoCall?.chatId, ev.detail.chatId) ||
            ev.detail.currentUserIsParticipant ||
            Number(ev.detail.timestamp) < Date.now() - 60 * 60 * 1000
        ) {
            return;
        }

        incomingVideoCall.set(ev.detail);
    }

    async function newChatSelected(
        chatId: ChatIdentifier,
        messageIndex?: number,
        threadMessageIndex?: number,
    ): Promise<void> {
        let chat = $chatSummariesStore.get(chatId);
        let autojoin = false;

        // if this is an unknown chat let's preview it
        if (chat === undefined) {
            // if the scope is favourite let's redirect to the non-favourite counterpart and try again
            // this is necessary if the link is no longer in our favourites or came from another user and was *never* in our favourites.
            if ($chatListScope.kind === "favourite") {
                pageRedirect(
                    routeForChatIdentifier(
                        $chatListScope.communityId === undefined ? "group_chat" : "community",
                        chatId,
                    ),
                );
                return;
            }
            if (chatId.kind === "direct_chat") {
                await createDirectChat(chatId);
            } else if (chatId.kind === "group_chat" || chatId.kind === "channel") {
                autojoin = $querystring.has("autojoin");
                const code = $querystring.get("code");
                if (code) {
                    client.groupInvite = {
                        chatId: chatId,
                        code,
                    };
                }
                const preview = await client.previewChat(chatId);
                if (preview.kind === "group_moved") {
                    if (messageIndex !== undefined) {
                        if (threadMessageIndex !== undefined) {
                            pageReplace(
                                routeForMessage(
                                    "community",
                                    {
                                        chatId: preview.location,
                                        threadRootMessageIndex: messageIndex,
                                    },
                                    threadMessageIndex,
                                ),
                            );
                        } else {
                            pageReplace(
                                routeForMessage(
                                    "community",
                                    { chatId: preview.location },
                                    messageIndex,
                                ),
                            );
                        }
                    } else {
                        pageReplace(routeForChatIdentifier($chatListScope.kind, preview.location));
                    }
                } else if (preview.kind === "failure") {
                    modal = { kind: "not_found" };
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

            if (autojoin && chat.kind !== "direct_chat") {
                joinGroup(new CustomEvent("joinGroup", { detail: { group: chat, select: true } }));
            }
        }
    }

    // the currentChatMessages component may not exist straight away
    async function waitAndScrollToMessageIndex(index: number, preserveFocus: boolean, retries = 0) {
        if (!currentChatMessages && retries < 5) {
            window.requestAnimationFrame(() =>
                waitAndScrollToMessageIndex(index, preserveFocus, retries + 1),
            );
        } else {
            currentChatMessages?.scrollToMessageIndex(index, preserveFocus);
        }
    }

    async function selectCommunity(id: CommunityIdentifier, clearChat = true): Promise<boolean> {
        const found = await client.setSelectedCommunity(id, $querystring.get("code"), clearChat);
        if (!found) {
            modal = { kind: "no_access" };
        }
        return found;
    }

    function selectFirstChat(): boolean {
        if (!$mobileWidth) {
            const first = $chatSummariesListStore.find((c) => !c.membership.archived);
            if (first !== undefined) {
                pageRedirect(routeForChatIdentifier($chatListScope.kind, first.id));
                return true;
            }
        }
        return false;
    }

    let communityLoaded = false;

    // extracting to a function to try to control more tightly what this reacts to
    async function routeChange(initialised: boolean, pathParams: RouteParams): Promise<void> {
        // wait until we have loaded the chats
        if (initialised) {
            filterRightPanelHistory((state) => state.kind !== "community_filters");
            if (
                $anonUser &&
                pathParams.kind === "chat_list_route" &&
                (pathParams.scope.kind === "direct_chat" || pathParams.scope.kind === "favourite")
            ) {
                client.updateIdentityState({ kind: "logging_in" });
                pageRedirect("/group");
                return;
            }

            if ("scope" in pathParams) {
                client.setChatListScope(pathParams.scope);
            }

            // When we have a middle panel and this route is for a chat list then select the first chat
            if (pathParams.kind === "chat_list_route" && selectFirstChat()) {
                return;
            }

            if (pathParams.kind === "home_route") {
                client.clearSelectedChat();
                closeThread();
                filterChatSpecificRightPanelStates();
            } else if (pathParams.kind === "communities_route") {
                client.clearSelectedChat();
                rightPanelHistory.set($fullWidth ? [{ kind: "community_filters" }] : []);
            } else if (pathParams.kind === "selected_community_route") {
                await selectCommunity(pathParams.communityId);
                if (selectFirstChat()) {
                    communityLoaded = true;
                    return;
                }
            } else if (
                pathParams.kind === "global_chat_selected_route" ||
                pathParams.kind === "selected_channel_route"
            ) {
                if (pathParams.kind === "selected_channel_route") {
                    if (!communityLoaded) {
                        await selectCommunity(pathParams.communityId, false);
                    }
                    communityLoaded = false;
                }

                // first close any open thread
                closeThread();

                // if the chat in the url is different from the chat we already have selected
                if (!chatIdentifiersEqual(pathParams.chatId, $selectedChatId)) {
                    newChatSelected(
                        pathParams.chatId,
                        pathParams.messageIndex,
                        pathParams.threadMessageIndex,
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
                    pageReplace(routeForScope(client.getDefaultScope()));
                    modal = { kind: "select_chat" };
                }
            }

            // regardless of the path params, we *always* check the query string
            const diamond = $querystring.get("diamond");
            if (diamond !== null) {
                showUpgrade = true;
                pageReplace(removeQueryStringParam("diamond"));
            }

            const wallet = $querystring.get("wallet");
            if (wallet !== null) {
                modal = { kind: "wallet" };
                pageReplace(removeQueryStringParam("wallet"));
            }

            const faq = $querystring.get("faq");
            if (faq !== null) {
                pageReplace(`/faq?q=${faq}`);
            }

            const hof = $querystring.get("hof");
            if (hof !== null) {
                modal = { kind: "hall_of_fame" };
                pageReplace(removeQueryStringParam("hof"));
            }

            const everyone = $querystring.get("everyone");
            if (everyone !== null) {
                rightPanelHistory.set([{ kind: "show_group_members" }]);
                pageReplace(removeQueryStringParam("everyone"));
            }

            const usergroup = $querystring.get("usergroup");
            if (usergroup !== null) {
                const userGroupId = Number(usergroup);
                rightPanelHistory.set([{ kind: "show_community_members", userGroupId }]);
                pageReplace(removeQueryStringParam("usergroup"));
            }

            if (client.captureReferralCode()) {
                pageReplace(removeQueryStringParam("ref"));
            }

            if (modal?.kind === "claim_daily_chit") {
                modal = { kind: "none" };
            }
        }
    }

    // Note: very important (and hacky) that this is hidden in a function rather than inline in the top level reactive
    // statement because we don't want that reactive statement to execute in reponse to changes in rightPanelHistory :puke:
    function filterChatSpecificRightPanelStates() {
        filterRightPanelHistory((panel) => panel.kind === "user_profile");
    }

    function closeThread() {
        if (creatingThread) {
            creatingThread = false;
            return;
        }
        tick().then(() => {
            activeVideoCall?.threadOpen(false);
            filterRightPanelHistory((panel) => panel.kind !== "message_thread_panel");
        });
    }

    function resetRightPanel() {
        filterByChatType($selectedChatStore);
    }

    function goToMessageIndex(ev: CustomEvent<{ index: number; preserveFocus: boolean }>) {
        waitAndScrollToMessageIndex(ev.detail.index, ev.detail.preserveFocus);
    }

    function leaderboard() {
        modal = { kind: "hall_of_fame" };
    }

    function closeModal() {
        modal = { kind: "none" };
        joining = undefined;
    }

    function closeNoAccess() {
        closeModal();
        page(routeForScope(client.getDefaultScope()));
    }

    function onUnarchiveChat(ev: CustomEvent<ChatIdentifier>) {
        unarchiveChat(ev.detail);
    }

    function unarchiveChat(chatId: ChatIdentifier) {
        client.unarchiveChat(chatId).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("unarchiveChatFailed"));
            }
        });
    }

    function getConfirmMessage(
        confirmActionEvent: ConfirmActionEvent | undefined,
    ): ResourceKey | undefined {
        if (confirmActionEvent === undefined) return undefined;

        switch (confirmActionEvent.kind) {
            case "leave":
                return i18nKey("confirmLeaveGroup", undefined, confirmActionEvent.level, true);
            case "leave_community":
                return i18nKey("communities.leaveMessage");
            case "delete_community":
                return i18nKey("communities.deleteMessage");
            case "delete":
                return i18nKey("irreversible", undefined, confirmActionEvent.level, true);
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
                return deleteCommunity(confirmActionEvent.communityId).then((_) => {
                    rightPanelHistory.set([]);
                });
            case "delete":
                return deleteGroup(confirmActionEvent.chatId, confirmActionEvent.level).then(
                    (_) => {
                        rightPanelHistory.set([]);
                    },
                );
            default:
                return Promise.reject();
        }
    }

    function deleteGroup(chatId: MultiUserChatIdentifier, level: Level): Promise<void> {
        if (chatId.kind === "channel") {
            page(`/community/${chatId.communityId}`);
        } else {
            page(routeForScope($chatListScope));
        }
        return client.deleteGroup(chatId).then((success) => {
            if (success) {
                toastStore.showSuccessToast(i18nKey("deleteGroupSuccess", undefined, level));
            } else {
                toastStore.showFailureToast(i18nKey("deleteGroupFailure", undefined, level, true));
                page(routeForChatIdentifier($chatListScope.kind, chatId));
            }
        });
    }

    function deleteCommunity(id: CommunityIdentifier): Promise<void> {
        page(routeForScope(client.getDefaultScope()));

        client.deleteCommunity(id).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("communities.errors.deleteFailed"));
                page(`/community/${id.communityId}`);
            }
        });

        return Promise.resolve();
    }

    function leaveCommunity(id: CommunityIdentifier): Promise<void> {
        page(routeForScope(client.getDefaultScope()));

        client.leaveCommunity(id).then((success) => {
            if (!success) {
                toastStore.showFailureToast(i18nKey("communities.errors.leaveFailed"));
                page(`/community/${id.communityId}`);
            }
        });

        return Promise.resolve();
    }

    function leaveGroup(chatId: MultiUserChatIdentifier, level: Level): Promise<void> {
        page(routeForScope($chatListScope));

        client.leaveGroup(chatId).then((resp) => {
            if (resp !== "success") {
                if (resp === "owner_cannot_leave") {
                    toastStore.showFailureToast(i18nKey("ownerCantLeave", undefined, level, true));
                } else {
                    toastStore.showFailureToast(
                        i18nKey("failedToLeaveGroup", undefined, level, true),
                    );
                }
                page(routeForChatIdentifier($chatListScope.kind, chatId));
            }
        });

        return Promise.resolve();
    }

    function chatWith(ev: CustomEvent<DirectChatIdentifier>) {
        const chat = $chatSummariesListStore.find((c) => {
            return c.kind === "direct_chat" && c.them === ev.detail;
        });

        page(routeForChatIdentifier(chat ? $chatListScope.kind : "direct_chat", ev.detail));
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
        draftMessagesStore.setTextContent({ chatId }, "");
        draftMessagesStore.setReplyingTo({ chatId }, ev.detail);
        if (chat) {
            page(routeForChatIdentifier($chatListScope.kind, chatId));
        } else {
            createDirectChat(chatId as DirectChatIdentifier);
        }
    }

    function forwardMessage(ev: CustomEvent<Message>) {
        messageToForward = ev.detail;
        modal = { kind: "select_chat" };
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
            pageReplace(routeForChatIdentifier($chatListScope.kind, $selectedChatId));
        }
        rightPanelHistory.set([{ kind: "user_profile" }]);
    }

    function openThread(ev: { threadRootEvent: EventWrapper<Message>; initiating: boolean }) {
        if ($selectedChatId !== undefined) {
            if (ev.initiating) {
                creatingThread = true;
                pageReplace(routeForChatIdentifier($chatListScope.kind, $selectedChatId));
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

    function showProposalFilters() {
        if ($selectedChatId !== undefined) {
            pageReplace(routeForChatIdentifier($chatListScope.kind, $selectedChatId));
            rightPanelHistory.set([
                {
                    kind: "proposal_filters",
                },
            ]);
        }
    }

    function showMakeProposalModal() {
        if (nervousSystem !== undefined && selectedMultiUserChat !== undefined) {
            modal = { kind: "make_proposal", chat: selectedMultiUserChat, nervousSystem };
        }
    }

    async function joinGroup(
        ev: CustomEvent<{ group: MultiUserChat; select: boolean }>,
    ): Promise<void> {
        if ($anonUser) {
            client.updateIdentityState({
                kind: "logging_in",
                postLogin: { kind: "join_group", ...ev.detail },
            });
            return;
        }
        const { group, select } = ev.detail;

        // it's possible that we got here via a postLogin capture in which case it's possible
        // that we are actually already a member of this group, so we should double check here
        // that we actually *need* to join the group
        let chat = $chatSummariesStore.get(group.id);
        if (chat === undefined || chat.membership.role === "none" || client.isLapsed(chat.id)) {
            doJoinGroup(group, select, undefined);
        }
    }

    function accessGatesEvaluated(ev: CustomEvent<GateCheckSucceeded>) {
        if (modal.kind === "evaluating_access_gates") {
            const { group, select } = modal;
            closeModal();
            doJoinGroup(group, select, ev.detail);
        }
    }

    /**
     * When we try to join a group we need to first scrutinise the access gates and
     * see whether any of them require client side action before we can proceed with the
     * call to the back end. If there are gates which require action, we need to perform
     * those actions one by one until they are all done and then feed their results
     * back into this function.
     */

    async function doJoinGroup(
        group: MultiUserChat,
        select: boolean,
        gateCheck: GateCheckSucceeded | undefined,
    ): Promise<void> {
        joining = group;
        const credentials = gateCheck?.credentials ?? [];
        const paymentApprovals = gateCheck?.paymentApprovals ?? new Map();

        if (gateCheck === undefined) {
            const gates = client.accessGatesForChat(group, true);
            const passed = client.doesUserMeetAccessGates(gates);

            if (!passed) {
                /**
                 * If we cannot already tell that the user passes the access gate(s), check if there are any gates that require front end
                 * pre-processing.
                 */
                if (client.gatePreprocessingRequired(gates)) {
                    modal = {
                        kind: "evaluating_access_gates",
                        group,
                        select,
                        gates,
                        level: group.level,
                    };
                    return Promise.resolve();
                }
            }
        }

        return client
            .joinGroup(group, credentials, paymentApprovals)
            .then((resp) => {
                if (resp.kind === "blocked") {
                    toastStore.showFailureToast(i18nKey("youreBlocked"));
                    joining = undefined;
                } else if (resp.kind === "gate_check_failed") {
                    const gates = client.accessGatesForChat(group);
                    modal = { kind: "gate_check_failed", gates };
                } else if (resp.kind !== "success") {
                    toastStore.showFailureToast(
                        i18nKey("joinGroupFailed", undefined, group.level, true),
                    );
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

        draftMessagesStore.setTextContent({ chatId }, text);
    }

    function groupCreated(
        ev: CustomEvent<{ chatId: GroupChatIdentifier; isPublic: boolean; rules: Rules }>,
    ) {
        const { chatId, isPublic, rules } = ev.detail;
        chatStateStore.setProp(chatId, "rules", { ...rules, version: 0 });
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
                : [],
        );
    }

    function showWallet() {
        modal = { kind: "wallet" };
    }

    function newChannel(ev: CustomEvent<boolean>) {
        newGroup("channel", ev.detail);
    }

    function newGroup(level: Level = "group", embeddedContent: boolean = false) {
        if (level === "channel" && $chatListScope.kind !== "community") {
            return;
        }
        const id: MultiUserChatIdentifier =
            level === "channel" && $chatListScope.kind === "community"
                ? { kind: "channel", communityId: $chatListScope.id.communityId, channelId: 0 }
                : { kind: "group_chat", groupId: "" };

        modal = {
            kind: "new_group",
            embeddedContent,
            candidate: {
                id,
                kind: "candidate_group_chat",
                name: "",
                description: "",
                historyVisible: true,
                public: false,
                frozen: false,
                members: [],
                permissions: {
                    changeRoles: "admin",
                    removeMembers: "moderator",
                    deleteMessages: "moderator",
                    updateGroup: "admin",
                    pinMessages: "admin",
                    inviteUsers: "admin",
                    addMembers: "admin",
                    mentionAllMembers: "member",
                    reactToMessages: "member",
                    startVideoCall: "member",
                    messagePermissions: {
                        default: "member",
                        p2pSwap: "none",
                    },
                    threadPermissions: undefined,
                },
                rules: { ...defaultChatRules(level), newVersion: false },
                gateConfig: { gate: { kind: "no_gate" }, expiry: undefined },
                level,
                membership: {
                    ...nullMembership(),
                    role: "owner",
                },
                messagesVisibleToNonMembers: false,
                externalUrl: embeddedContent ? "" : undefined,
            },
        };
    }

    function editGroup(ev: CustomEvent<{ chat: MultiUserChat; rules: UpdatedRules | undefined }>) {
        const chat = ev.detail.chat;
        let level: Level = chat.id.kind === "group_chat" ? "group" : "channel";
        let rules = ev.detail.rules ?? { ...defaultChatRules(level), newVersion: false };
        modal = {
            kind: "new_group",
            embeddedContent: chat.kind === "channel" && chat.externalUrl !== undefined,
            candidate: {
                id: chat.id,
                kind: "candidate_group_chat",
                name: chat.name,
                description: chat.description,
                historyVisible: chat.historyVisible,
                public: chat.public,
                frozen: chat.frozen,
                members: [],
                permissions: { ...chat.permissions },
                rules,
                avatar: {
                    blobUrl: chat.blobUrl,
                    blobData: chat.blobData,
                },
                gateConfig: { ...chat.gateConfig },
                level,
                membership: chat.membership,
                eventsTTL: chat.eventsTTL,
                messagesVisibleToNonMembers: chat.messagesVisibleToNonMembers,
                externalUrl: chat.kind === "channel" ? chat.externalUrl : undefined,
            },
        };
    }

    function toggleMuteNotifications(ev: CustomEvent<{ chatId: ChatIdentifier; mute: boolean }>) {
        const op = ev.detail.mute ? "muted" : "unmuted";
        client.toggleMuteNotifications(ev.detail.chatId, ev.detail.mute).then((success) => {
            if (!success) {
                toastStore.showFailureToast(
                    i18nKey("toggleMuteNotificationsFailed", {
                        operation: $_(op),
                    }),
                );
            }
        });
    }

    async function createDirectChat(chatId: DirectChatIdentifier): Promise<boolean> {
        if (!(await client.createDirectChat(chatId))) {
            modal = { kind: "not_found" };
            return false;
        }

        page(routeForChatIdentifier("direct_chat", chatId));
        return true;
    }

    function createCommunity() {
        const maxIndex = $communities
            .values()
            .reduce((m, c) => (c.membership.index > m ? c.membership.index : m), 0);
        modal = {
            kind: "edit_community",
            community: createCandidateCommunity("", maxIndex + 1),
            communityRules: defaultChatRules("community"),
        };
    }

    function editCommunity(ev: CustomEvent<CommunitySummary>) {
        modal = {
            kind: "edit_community",
            community: ev.detail,
            communityRules: $currentCommunityRules ?? defaultChatRules("community"),
        };
    }

    function convertGroupToCommunity(ev: CustomEvent<GroupChatSummary>) {
        rightPanelHistory.set([]);
        convertGroup = ev.detail;
    }

    function successfulImport(ev: CustomEvent<ChannelIdentifier>) {
        page(`/community/${ev.detail.communityId}`);
    }

    function profileLinkClicked(ev: CustomEvent<ProfileLinkClickedEvent>) {
        showProfileCard = {
            userId: ev.detail.userId,
            chatButton: ev.detail.chatButton,
            inGlobalContext: ev.detail.inGlobalContext,
            alignTo: ev.target ? (ev.target as HTMLElement).getBoundingClientRect() : undefined,
        };
    }

    function chatWithFromProfileCard() {
        if (showProfileCard === undefined) return;
        chatWith(
            new CustomEvent("chatWith", {
                detail: { kind: "direct_chat", userId: showProfileCard.userId },
            }),
        );
        showProfileCard = undefined;
    }

    let forgotPin = false;

    function onForgotPin() {
        forgotPin = true;
    }

    function onPinNumberComplete(ev: CustomEvent<string>) {
        $pinNumberStore?.resolve(ev.detail);
    }

    function onPinNumberClose() {
        $pinNumberStore?.reject();
    }

    function verifyHumanity() {
        modal = { kind: "verify_humanity" };
    }

    function claimDailyChit() {
        modal = { kind: "claim_daily_chit" };
    }

    $: bgHeight = $dimensions.height * 0.9;
    $: bgClip = (($dimensions.height - 32) / bgHeight) * 361;
</script>

{#if showProfileCard !== undefined}
    {@const profileUser = $userStore.get(showProfileCard.userId)}
    {#if profileUser?.kind !== "bot"}
        <ViewUserProfile
            userId={showProfileCard.userId}
            inGlobalContext={showProfileCard.inGlobalContext}
            chatButton={showProfileCard.chatButton}
            alignTo={showProfileCard.alignTo}
            on:openDirectChat={chatWithFromProfileCard}
            on:close={() => (showProfileCard = undefined)} />
    {/if}
{/if}

<main class:anon={$anonUser} class:offline={$offlineStore}>
    {#if $layoutStore.showNav}
        <LeftNav
            on:profile={showProfile}
            on:wallet={showWallet}
            on:halloffame={() => (modal = { kind: "hall_of_fame" })}
            on:newGroup={() => newGroup("group")}
            on:communityDetails={communityDetails}
            on:newChannel={newChannel}
            on:leaveCommunity={triggerConfirm}
            on:deleteCommunity={triggerConfirm}
            on:upgrade={upgrade}
            on:claimDailyChit={claimDailyChit} />
    {/if}

    {#if $layoutStore.showLeft}
        <LeftPanel
            on:chatWith={chatWith}
            on:halloffame={() => (modal = { kind: "hall_of_fame" })}
            on:newGroup={() => newGroup("group")}
            on:profile={showProfile}
            on:communityDetails={communityDetails}
            on:logout={() => client.logout()}
            on:wallet={showWallet}
            on:upgrade={upgrade}
            on:unarchiveChat={onUnarchiveChat}
            on:toggleMuteNotifications={toggleMuteNotifications}
            on:newChannel={newChannel}
            on:editCommunity={editCommunity}
            on:leaveCommunity={triggerConfirm}
            on:deleteCommunity={triggerConfirm}
            on:leaveGroup={triggerConfirm}
            on:askToSpeak
            on:hangup />
    {/if}
    {#if $layoutStore.showMiddle}
        <MiddlePanel
            {joining}
            bind:currentChatMessages
            on:startVideoCall
            on:successfulImport={successfulImport}
            on:clearSelection={() => page(routeForScope($chatListScope))}
            on:leaveGroup={triggerConfirm}
            on:chatWith={chatWith}
            on:replyPrivatelyTo={replyPrivatelyTo}
            on:showInviteGroupUsers={showInviteGroupUsers}
            on:showProposalFilters={showProposalFilters}
            on:makeProposal={showMakeProposalModal}
            on:showGroupMembers={showGroupMembers}
            on:joinGroup={joinGroup}
            on:upgrade={upgrade}
            on:verifyHumanity={verifyHumanity}
            on:claimDailyChit={claimDailyChit}
            on:toggleMuteNotifications={toggleMuteNotifications}
            on:goToMessageIndex={goToMessageIndex}
            on:forward={forwardMessage}
            on:convertGroupToCommunity={convertGroupToCommunity}
            on:createCommunity={createCommunity} />
    {/if}
    <RightPanel
        on:goToMessageIndex={goToMessageIndex}
        on:replyPrivatelyTo={replyPrivatelyTo}
        on:showInviteGroupUsers={showInviteGroupUsers}
        on:showGroupMembers={showGroupMembers}
        on:chatWith={chatWith}
        on:upgrade={upgrade}
        on:startVideoCall
        on:deleteGroup={triggerConfirm}
        on:editGroup={editGroup}
        on:editCommunity={editCommunity}
        on:deleteCommunity={triggerConfirm}
        on:newChannel={newChannel}
        on:groupCreated={groupCreated}
        on:verifyHumanity={verifyHumanity} />
</main>

{#if $anonUser}
    <AnonFooter />
{/if}

{#if $offlineStore}
    <OfflineFooter />
{/if}

{#if confirmActionEvent !== undefined}
    <AreYouSure
        doubleCheck={confirmActionEvent.kind === "delete" ||
        confirmActionEvent.kind === "delete_community"
            ? confirmActionEvent.doubleCheck
            : undefined}
        message={confirmMessage}
        action={onConfirmAction} />
{/if}

<Toast />

{#if showUpgrade && $user}
    <Upgrade on:cancel={() => (showUpgrade = false)} />
{/if}

{#if modal.kind === "registering"}
    <Overlay>
        <Register
            on:logout={() => client.logout()}
            on:createdUser={(ev) => client.onCreatedUser(ev.detail)} />
    </Overlay>
{:else if modal.kind !== "none"}
    <Overlay
        dismissible={modal.kind !== "select_chat" &&
            modal.kind !== "not_found" &&
            modal.kind !== "make_proposal"}
        alignLeft={modal.kind === "select_chat"}
        on:close={closeModal}>
        {#if modal.kind === "select_chat"}
            <SelectChatModal on:close={onCloseSelectChat} on:select={onSelectChat} />
        {:else if modal.kind === "suspended"}
            <SuspendedModal on:close={closeModal} />
        {:else if modal.kind === "register_bot"}
            <BotBuilderModal mode={"register"} onClose={closeModal} />
        {:else if modal.kind === "update_bot"}
            <BotBuilderModal mode={"update"} onClose={closeModal} />
        {:else if modal.kind === "remove_bot"}
            <BotBuilderModal mode={"remove"} onClose={closeModal} />
        {:else if modal.kind === "no_access"}
            <NoAccess on:close={closeNoAccess} />
        {:else if modal.kind === "not_found"}
            <NotFound on:close={closeNoAccess} />
        {:else if modal.kind === "gate_check_failed"}
            <GateCheckFailed on:close={closeModal} gates={modal.gates} />
        {:else if modal.kind === "evaluating_access_gates"}
            <AccessGateEvaluator
                gates={modal.gates}
                on:close={closeModal}
                on:success={accessGatesEvaluated} />
        {:else if modal.kind === "new_group"}
            <CreateOrUpdateGroup
                embeddedContent={modal.embeddedContent}
                candidateGroup={modal.candidate}
                on:upgrade={upgrade}
                on:close={closeModal} />
        {:else if modal.kind === "edit_community"}
            <EditCommunity
                originalRules={modal.communityRules}
                original={modal.community}
                on:close={closeModal} />
        {:else if modal.kind === "wallet"}
            <AccountsModal on:close={closeModal} />
        {:else if modal.kind === "hall_of_fame"}
            <HallOfFame
                on:streak={() => (modal = { kind: "claim_daily_chit" })}
                on:close={closeModal} />
        {:else if modal.kind === "make_proposal"}
            <MakeProposalModal
                selectedMultiUserChat={modal.chat}
                nervousSystem={modal.nervousSystem}
                on:close={closeModal} />
        {:else if modal.kind === "logging_in"}
            <LoggingInModal on:close={closeModal} />
        {:else if modal.kind === "claim_daily_chit"}
            <DailyChitModal on:leaderboard={leaderboard} on:close={closeModal} />
        {:else if modal.kind === "challenge"}
            <ChallengeModal on:close={closeModal} />
        {:else if modal.kind === "verify_humanity"}
            <VerifyHumanity on:close={closeModal} on:success={closeModal} />
        {/if}
    </Overlay>
{/if}

{#if $currentTheme.logo}
    <BackgroundLogo
        width={`${bgHeight}px`}
        bottom={"unset"}
        left={"0"}
        opacity={"0.05"}
        skew={"5deg"}
        viewBox={`0 0 361 ${bgClip}`} />
{/if}

<Convert bind:group={convertGroup} />

<EditLabel />

{#if $rulesAcceptanceStore !== undefined}
    <AcceptRulesModal />
{:else if forgotPin}
    <Overlay>
        <SetPinNumberModal
            on:pinSet={onPinNumberComplete}
            on:close={() => (forgotPin = false)}
            type={{ kind: "forgot", while: { kind: "enter" } }} />
    </Overlay>
{:else if $pinNumberStore !== undefined}
    <Overlay>
        <PinNumberModal
            on:close={onPinNumberClose}
            on:complete={onPinNumberComplete}
            on:forgot={onForgotPin} />
    </Overlay>
{/if}

<svelte:body on:profile-clicked={profileLinkClicked} />

{#if $chitPopup}
    <ChitEarned />
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

        &.anon {
            margin-bottom: toRem(50);
        }
        &.offline {
            margin-bottom: toRem(40);
        }
    }
</style>

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
        CredentialGate,
        PaymentGate,
        ResourceKey,
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
    import { currentTheme } from "../../theme/themes";
    import SuspendedModal from "../SuspendedModal.svelte";
    import NoAccess from "./NoAccess.svelte";
    import NewGroup from "./addgroup/NewGroup.svelte";
    import AccountsModal from "./profile/AccountsModal.svelte";
    import { querystring } from "../../routes";
    import { eventListScrollTop } from "../../stores/scrollPos";
    import GateCheckFailed from "./AccessGateCheckFailed.svelte";
    import InitiateCredentialCheck from "./InitiateCredentialCheck.svelte";
    import HallOfFame from "./HallOfFame.svelte";
    import LeftNav from "./nav/LeftNav.svelte";
    import MakeProposalModal from "./MakeProposalModal.svelte";
    import { createCandidateCommunity } from "../../stores/community";
    import Convert from "./communities/Convert.svelte";
    import type { ProfileLinkClickedEvent } from "../web-components/profileLink";
    import Register from "../register/Register.svelte";
    import LoggingInModal from "./LoggingInModal.svelte";
    import AnonFooter from "./AnonFooter.svelte";
    import OfflineFooter from "../OfflineFooter.svelte";
    import ApproveJoiningPaymentModal from "./ApproveJoiningPaymentModal.svelte";
    import RightPanel from "./RightPanelWrapper.svelte";
    import EditLabel from "../EditLabel.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import NotFound from "../NotFound.svelte";
    import { activeVideoCall, incomingVideoCall } from "../../stores/video";
    import PinNumberModal from "./PinNumberModal.svelte";
    import AcceptRulesModal from "./AcceptRulesModal.svelte";

    type ViewProfileConfig = {
        userId: string;
        chatButton: boolean;
        alignTo?: DOMRect;
        inGlobalContext: boolean;
    };

    const client = getContext<OpenChat>("client");
    let candidateGroup: CandidateGroupChat | undefined;
    let candidateCommunity: CommunitySummary | undefined;
    let candidateCommunityRules: Rules = defaultChatRules("community");
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

    enum ModalType {
        None,
        SelectChat,
        Suspended,
        NoAccess,
        NewGroup,
        Wallet,
        GateCheckFailed,
        VerifyCredential,
        ApproveJoinPayment,
        HallOfFame,
        EditCommunity,
        MakeProposal,
        Registering,
        LoggingIn,
        NotFound,
    }

    let modal = ModalType.None;
    let confirmActionEvent: ConfirmActionEvent | undefined;
    let joining: MultiUserChat | undefined = undefined;
    let credentialCheck:
        | { group: MultiUserChat; gate: CredentialGate; select: boolean }
        | undefined = undefined;
    let joinPaymentDetails:
        | { group: MultiUserChat; gate: PaymentGate; select: boolean }
        | undefined = undefined;
    let showUpgrade: boolean = false;
    let share: Share = { title: "", text: "", url: "", files: [] };
    let messageToForward: Message | undefined = undefined;
    let creatingThread = false;
    let currentChatMessages: CurrentChatMessages | undefined;

    $: user = client.user;
    $: suspendedUser = client.suspendedUser;
    $: anonUser = client.anonUser;
    $: identityState = client.identityState;
    $: chatSummariesListStore = client.chatSummariesListStore;
    $: chatSummariesStore = client.chatSummariesStore;
    $: selectedChatStore = client.selectedChatStore;
    $: selectedChatId = client.selectedChatId;
    $: chatsInitialised = client.chatsInitialised;
    $: draftMessagesStore = client.draftMessagesStore;
    $: chatStateStore = client.chatStateStore;
    $: confirmMessage = getConfirmMessage(confirmActionEvent);
    $: chatListScope = client.chatListScope;
    $: currentCommunityRules = client.currentCommunityRules;
    $: communities = client.communities;
    $: selectedMultiUserChat =
        $selectedChatStore?.kind === "group_chat" || $selectedChatStore?.kind === "channel"
            ? $selectedChatStore
            : undefined;
    $: governanceCanisterId =
        selectedMultiUserChat !== undefined
            ? selectedMultiUserChat.subtype?.governanceCanisterId
            : undefined;
    $: nervousSystem = client.tryGetNervousSystem(governanceCanisterId);
    $: offlineStore = client.offlineStore;
    $: pinNumberStore = client.capturePinNumberStore;
    $: rulesAcceptanceStore = client.captureRulesAcceptanceStore;

    $: {
        if ($identityState.kind === "registering") {
            modal = ModalType.Registering;
        }
        if ($identityState.kind === "logging_in") {
            modal = ModalType.LoggingIn;
        }
        if ($identityState.kind === "logged_in" && modal === ModalType.Registering) {
            console.log("We are now logged in so we are closing the register modal");
            modal = ModalType.None;
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
            modal = ModalType.Suspended;
        }

        return () => {
            client.removeEventListener("openchat_event", clientEvent);
        };
    });

    function clientEvent(ev: Event): void {
        if (ev instanceof ThreadSelected) {
            openThread(ev.detail);
        } else if (ev instanceof RemoteVideoCallStartedEvent) {
            remoteVideoCallStarted(ev);
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

    function remoteVideoCallStarted(ev: RemoteVideoCallStartedEvent) {
        incomingVideoCall.set(ev.detail);
    }

    async function newChatSelected(
        chatId: ChatIdentifier,
        messageIndex?: number,
        threadMessageIndex?: number,
    ): Promise<void> {
        let chat = $chatSummariesStore.get(chatId);

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
                    modal = ModalType.NotFound;
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
                waitAndScrollToMessageIndex(index, preserveFocus, retries + 1),
            );
        } else {
            currentChatMessages?.scrollToMessageIndex(index, preserveFocus);
        }
    }

    async function selectCommunity(id: CommunityIdentifier, clearChat = true): Promise<boolean> {
        const found = await client.setSelectedCommunity(id, $querystring.get("code"), clearChat);
        if (!found) {
            modal = ModalType.NoAccess;
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
                client.identityState.set({ kind: "logging_in" });
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
                    return;
                }
            } else if (
                pathParams.kind === "global_chat_selected_route" ||
                pathParams.kind === "selected_channel_route"
            ) {
                if (pathParams.kind === "selected_channel_route") {
                    await selectCommunity(pathParams.communityId, false);
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
                    modal = ModalType.SelectChat;
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
                modal = ModalType.Wallet;
                pageReplace(removeQueryStringParam("wallet"));
            }

            const faq = $querystring.get("faq");
            if (faq !== null) {
                pageReplace(`/faq?q=${faq}`);
            }

            const hof = $querystring.get("hof");
            if (hof !== null) {
                modal = ModalType.HallOfFame;
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

    function closeModal() {
        modal = ModalType.None;
        candidateGroup = undefined;
        candidateCommunity = undefined;
        joining = undefined;
        credentialCheck = undefined;
        joinPaymentDetails = undefined;
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
            modal = ModalType.MakeProposal;
        }
    }

    async function joinGroup(
        ev: CustomEvent<{ group: MultiUserChat; select: boolean }>,
    ): Promise<void> {
        if ($anonUser) {
            client.identityState.set({ kind: "logging_in" });
            return;
        }
        const { group, select } = ev.detail;
        doJoinGroup(group, select, undefined);
    }

    function credentialReceived(ev: CustomEvent<string>) {
        if (credentialCheck !== undefined) {
            const { group, select } = credentialCheck;
            closeModal();
            doJoinGroup(group, select, ev.detail);
        }
    }

    function onJoined() {
        if (joinPaymentDetails?.select) {
            page(routeForChatIdentifier($chatListScope.kind, joinPaymentDetails.group.id));
        }
        closeModal();
    }

    async function doJoinGroup(
        group: MultiUserChat,
        select: boolean,
        credential: string | undefined,
    ): Promise<void> {
        joining = group;
        if (group.gate.kind === "credential_gate" && credential === undefined) {
            credentialCheck = { group, select, gate: group.gate };
            modal = ModalType.VerifyCredential;
            return Promise.resolve();
        } else if (group.gate.kind === "payment_gate") {
            joinPaymentDetails = { group, select, gate: group.gate };
            modal = ModalType.ApproveJoinPayment;
            return Promise.resolve();
        } else if (group.kind === "channel") {
            const community = client.getCommunityForChannel(group.id);
            if (community?.gate.kind === "credential_gate" && credential === undefined) {
                credentialCheck = { group, select, gate: community.gate };
                modal = ModalType.VerifyCredential;
                return Promise.resolve();
            } else if (community?.gate.kind === "payment_gate") {
                joinPaymentDetails = { group, select, gate: community.gate };
                modal = ModalType.ApproveJoinPayment;
                return Promise.resolve();
            }
        }

        return client
            .joinGroup(group, credential)
            .then((resp) => {
                if (resp.kind === "blocked") {
                    toastStore.showFailureToast(i18nKey("youreBlocked"));
                    joining = undefined;
                } else if (resp.kind === "gate_check_failed") {
                    modal = ModalType.GateCheckFailed;
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
        modal = ModalType.Wallet;
    }

    function newChannel() {
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
            gate: { kind: "no_gate" },
            level,
            membership: {
                ...nullMembership(),
                role: "owner",
            },
        };
    }

    function editGroup(ev: CustomEvent<{ chat: MultiUserChat; rules: UpdatedRules | undefined }>) {
        modal = ModalType.NewGroup;
        const chat = ev.detail.chat;
        let level: Level = chat.id.kind === "group_chat" ? "group" : "channel";
        let rules = ev.detail.rules ?? { ...defaultChatRules(level), newVersion: false };
        candidateGroup = {
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
            gate: chat.gate,
            level,
            membership: chat.membership,
            eventsTTL: chat.eventsTTL,
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
            modal = ModalType.NotFound;
            return false;
        }

        page(routeForChatIdentifier("direct_chat", chatId));
        return true;
    }

    function createCommunity() {
        const maxIndex = $communities
            .values()
            .reduce((m, c) => (c.membership.index > m ? c.membership.index : m), 0);
        candidateCommunity = createCandidateCommunity("", maxIndex + 1);
        candidateCommunityRules = defaultChatRules("community");
        modal = ModalType.EditCommunity;
    }

    function editCommunity(ev: CustomEvent<CommunitySummary>) {
        candidateCommunity = ev.detail;
        candidateCommunityRules = $currentCommunityRules ?? defaultChatRules("community");
        modal = ModalType.EditCommunity;
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

    function onPinNumberComplete(ev: CustomEvent<string>) {
        $pinNumberStore?.resolve(ev.detail);
    }

    function onPinNumberClose() {
        $pinNumberStore?.reject();
    }

    $: bgHeight = $dimensions.height * 0.9;
    $: bgClip = (($dimensions.height - 32) / bgHeight) * 361;
</script>

{#if showProfileCard !== undefined}
    <ViewUserProfile
        userId={showProfileCard.userId}
        inGlobalContext={showProfileCard.inGlobalContext}
        chatButton={showProfileCard.chatButton}
        alignTo={showProfileCard.alignTo}
        on:openDirectChat={chatWithFromProfileCard}
        on:close={() => (showProfileCard = undefined)} />
{/if}

<main class:anon={$anonUser} class:offline={$offlineStore}>
    {#if $layoutStore.showNav}
        <LeftNav
            on:profile={showProfile}
            on:wallet={showWallet}
            on:halloffame={() => (modal = ModalType.HallOfFame)}
            on:newGroup={() => newGroup("group")}
            on:communityDetails={communityDetails}
            on:newChannel={newChannel}
            on:leaveCommunity={triggerConfirm}
            on:deleteCommunity={triggerConfirm}
            on:upgrade={upgrade} />
    {/if}

    {#if $layoutStore.showLeft}
        <LeftPanel
            on:chatWith={chatWith}
            on:halloffame={() => (modal = ModalType.HallOfFame)}
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
        on:groupCreated={groupCreated} />
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

{#if modal === ModalType.Registering}
    <Overlay>
        <Register
            on:logout={() => client.logout()}
            on:createdUser={(ev) => client.onCreatedUser(ev.detail)} />
    </Overlay>
{:else if modal !== ModalType.None}
    <Overlay
        dismissible={modal !== ModalType.SelectChat &&
            modal !== ModalType.Wallet &&
            modal !== ModalType.NotFound &&
            modal !== ModalType.MakeProposal}
        alignLeft={modal === ModalType.SelectChat}
        on:close={closeModal}>
        {#if modal === ModalType.SelectChat}
            <SelectChatModal on:close={onCloseSelectChat} on:select={onSelectChat} />
        {:else if modal === ModalType.Suspended}
            <SuspendedModal on:close={closeModal} />
        {:else if modal === ModalType.NoAccess}
            <NoAccess on:close={closeNoAccess} />
        {:else if modal === ModalType.NotFound}
            <NotFound on:close={closeNoAccess} />
        {:else if modal === ModalType.GateCheckFailed && joining !== undefined}
            <GateCheckFailed on:close={closeModal} gate={joining.gate} />
        {:else if modal === ModalType.VerifyCredential && credentialCheck !== undefined}
            <InitiateCredentialCheck
                level={credentialCheck.group.level}
                on:close={closeModal}
                on:credentialReceived={credentialReceived}
                gate={credentialCheck.gate} />
        {:else if modal === ModalType.ApproveJoinPayment && joinPaymentDetails !== undefined}
            <ApproveJoiningPaymentModal
                on:close={closeModal}
                on:joined={onJoined}
                group={joinPaymentDetails.group}
                gate={joinPaymentDetails.gate} />
        {:else if modal === ModalType.NewGroup && candidateGroup !== undefined}
            <NewGroup {candidateGroup} on:upgrade={upgrade} on:close={closeModal} />
        {:else if modal === ModalType.EditCommunity && candidateCommunity !== undefined}
            <EditCommunity
                originalRules={candidateCommunityRules}
                original={candidateCommunity}
                on:close={closeModal} />
        {:else if modal === ModalType.Wallet}
            <AccountsModal on:close={closeModal} />
        {:else if modal === ModalType.HallOfFame}
            <HallOfFame on:close={closeModal} />
        {:else if modal === ModalType.MakeProposal && selectedMultiUserChat !== undefined && nervousSystem !== undefined}
            <MakeProposalModal {selectedMultiUserChat} {nervousSystem} on:close={closeModal} />
        {:else if modal === ModalType.LoggingIn}
            <LoggingInModal on:close={closeModal} />
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
{:else if $pinNumberStore !== undefined}
    <Overlay>
        <PinNumberModal on:close={onPinNumberClose} on:complete={onPinNumberComplete} />
    </Overlay>
{/if}

<svelte:body on:profile-clicked={profileLinkClicked} />

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

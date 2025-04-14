<script lang="ts">
    import { trackedEffect } from "@src/utils/effects.svelte";
    import type {
        CandidateGroupChat,
        ChannelIdentifier,
        ChatIdentifier,
        CommunityIdentifier,
        CommunitySummary,
        DirectChatIdentifier,
        EnhancedAccessGate,
        EnhancedReplyContext,
        EventWrapper,
        GateCheckSucceeded,
        GroupChatSummary,
        Level,
        Message,
        MultiUserChat,
        MultiUserChatIdentifier,
        NervousSystemDetails,
        Notification,
        OpenChat,
        PubSubEvents,
        ResourceKey,
        Rules,
        UpdatedRules,
    } from "openchat-client";
    import {
        anonUser,
        chatIdentifiersEqual,
        chatListScopeStore as chatListScope,
        chatsInitialised,
        chatSummariesListStore,
        chatSummariesStore,
        communities,
        currentCommunityRules,
        defaultChatRules,
        draftMessagesStore,
        identityState,
        nullMembership,
        offlineStore,
        pathState,
        capturePinNumberStore as pinNumberStore,
        routeForChatIdentifier,
        routeForMessage,
        captureRulesAcceptanceStore as rulesAcceptanceStore,
        selectedChatId,
        selectedChatStore,
        subscribe,
        suspendedUser,
        ui,
        currentUser as user,
        userStore,
    } from "openchat-client";
    import page from "page";
    import { getContext, onMount, tick, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import type { RouteParams } from "../../routes";
    import { pageRedirect, pageReplace, routeForScope } from "../../routes";
    import { createCandidateCommunity } from "../../stores/community";
    import { messageToForwardStore } from "../../stores/messageToForward";
    import { eventListScrollTop } from "../../stores/scrollPos";
    import { chitPopup, disableChit } from "../../stores/settings";
    import { toastStore } from "../../stores/toast";
    import { activeVideoCall, incomingVideoCall } from "../../stores/video";
    import {
        currentTheme,
        currentThemeName,
        preferredDarkThemeName,
        themeType,
    } from "../../theme/themes";
    import {
        closeNotifications,
        closeNotificationsForChat,
        initialiseNotifications,
    } from "../../utils/notifications";
    import { scream } from "../../utils/scream";
    import type { Share } from "../../utils/share";
    import { removeQueryStringParam } from "../../utils/urls";
    import AreYouSure from "../AreYouSure.svelte";
    import BackgroundLogo from "../BackgroundLogo.svelte";
    import BotBuilderModal from "../bots/BotBuilderModal.svelte";
    import EditLabel from "../EditLabel.svelte";
    import NotFound from "../NotFound.svelte";
    import OfflineFooter from "../OfflineFooter.svelte";
    import Overlay from "../Overlay.svelte";
    import Register from "../register/Register.svelte";
    import SelectChatModal from "../SelectChatModal.svelte";
    import SuspendedModal from "../SuspendedModal.svelte";
    import Toast from "../Toast.svelte";
    import type { ProfileLinkClickedEvent } from "../web-components/profileLink";
    import AcceptRulesModal from "./AcceptRulesModal.svelte";
    import GateCheckFailed from "./access/AccessGateCheckFailed.svelte";
    import AccessGateEvaluator from "./access/AccessGateEvaluator.svelte";
    import AnonFooter from "./AnonFooter.svelte";
    import ChallengeModal from "./ChallengeModal.svelte";
    import ChitEarned from "./ChitEarned.svelte";
    import HallOfFame from "./ChitHallOfFame.svelte";
    import Convert from "./communities/Convert.svelte";
    import EditCommunity from "./communities/edit/Edit.svelte";
    import CreateOrUpdateGroup from "./createOrUpdateGroup/CreateOrUpdateGroup.svelte";
    import type CurrentChatMessages from "./CurrentChatMessages.svelte";
    import DailyChitModal from "./DailyChitModal.svelte";
    import LeftPanel from "./LeftPanel.svelte";
    import LoggingInModal from "./LoggingInModal.svelte";
    import MiddlePanel from "./MiddlePanel.svelte";
    import LeftNav from "./nav/LeftNav.svelte";
    import NoAccess from "./NoAccess.svelte";
    import PinNumberModal from "./PinNumberModal.svelte";
    import AccountsModal from "./profile/AccountsModal.svelte";
    import SetPinNumberModal from "./profile/SetPinNumberModal.svelte";
    import VerifyHumanity from "./profile/VerifyHumanity.svelte";
    import ViewUserProfile from "./profile/ViewUserProfile.svelte";
    import MakeProposalModal from "./proposal/MakeProposalModal.svelte";
    import RightPanel from "./RightPanelWrapper.svelte";
    import Upgrade from "./upgrade/Upgrade.svelte";

    type ViewProfileConfig = {
        userId: string;
        chatButton: boolean;
        alignTo?: DOMRect;
        inGlobalContext: boolean;
    };

    const client = getContext<OpenChat>("client");

    let convertGroup: GroupChatSummary | undefined = $state(undefined);
    let showProfileCard: ViewProfileConfig | undefined = $state(undefined);

    type ConfirmActionEvent =
        | ConfirmLeaveEvent
        | ConfirmDeleteEvent
        | ConfirmLeaveCommunityEvent
        | ConfirmDeleteCommunityEvent;

    type ConfirmLeaveCommunityEvent = {
        kind: "leave_community";
        communityId: CommunityIdentifier;
    };

    type ConfirmLeaveEvent = {
        kind: "leave";
        chatId: MultiUserChatIdentifier;
        level: Level;
    };

    type ConfirmDeleteEvent = {
        kind: "delete";
        chatId: MultiUserChatIdentifier;
        level: Level;
        doubleCheck: { challenge: ResourceKey; response: ResourceKey };
        after?: () => void;
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

    let modal: ModalType = $state({ kind: "none" });
    let confirmActionEvent: ConfirmActionEvent | undefined = $state();
    let joining: MultiUserChat | undefined = $state(undefined);
    let showUpgrade: boolean = $state(false);
    let share: Share = { title: "", text: "", url: "", files: [] };
    let messageToForward: Message | undefined = undefined;
    let creatingThread = false;
    let currentChatMessages: CurrentChatMessages | undefined = $state();

    onMount(() => {
        const unsubEvents = [
            subscribe("chatWith", chatWith),
            subscribe("showInviteGroupUsers", showInviteGroupUsers),
            subscribe("replyPrivatelyTo", replyPrivatelyTo),
            subscribe("showGroupMembers", showGroupMembers),
            subscribe("upgrade", upgrade),
            subscribe("verifyHumanity", verifyHumanity),
            subscribe("deleteGroup", onTriggerConfirm),
            subscribe("deleteCommunity", onTriggerConfirm),
            subscribe("communityDetails", communityDetails),
            subscribe("editCommunity", editCommunity),
            subscribe("leaveCommunity", onTriggerConfirm),
            subscribe("makeProposal", showMakeProposalModal),
            subscribe("leaveGroup", onTriggerConfirm),
            subscribe("newGroup", () => newGroup("group")),
            subscribe("wallet", showWallet),
            subscribe("profile", showProfile),
            subscribe("claimDailyChit", claimDailyChit),
            subscribe("joinGroup", joinGroup),
            subscribe("createCommunity", createCommunity),
            subscribe("unarchiveChat", unarchiveChat),
            subscribe("forward", forwardMessage),
            subscribe("toggleMuteNotifications", toggleMuteNotifications),
            subscribe("newChannel", newChannel),
            subscribe("successfulImport", successfulImport),
            subscribe("showProposalFilters", showProposalFilters),
            subscribe("convertGroupToCommunity", convertGroupToCommunity),
            subscribe("clearSelection", () => page(routeForScope($chatListScope))),
            subscribe("editGroup", editGroup),
            subscribe("chatsUpdated", chatsUpdated),
            subscribe("userSuspensionChanged", () => window.location.reload()),
            subscribe("selectedChatInvalid", selectedChatInvalid),
            subscribe("sendMessageFailed", sendMessageFailed),
            subscribe("summonWitch", summonWitch),
            subscribe("registerBot", registerBot),
            subscribe("updateBot", updateBot),
            subscribe("removeBot", removeBot),
            subscribe("threadSelected", openThread),
            subscribe("threadClosed", closeThread),
            subscribe("remoteVideoCallStarted", remoteVideoCallStarted),
            subscribe("remoteVideoCallEnded", remoteVideoCallEnded),
            subscribe("notification", (n) => client.notificationReceived(n)),
        ];
        //TODO push all of this inside the OC client itself
        initialiseNotifications(client);
        document.body.addEventListener("profile-clicked", (event) => {
            profileLinkClicked(event as CustomEvent<ProfileLinkClickedEvent>);
        });

        if ($suspendedUser) {
            modal = { kind: "suspended" };
        }

        return () => {
            unsubEvents.forEach((u) => u());
        };
    });

    function chatsUpdated() {
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
    }

    function selectedChatInvalid() {
        pageReplace(routeForScope(client.getDefaultScope()));
    }

    function sendMessageFailed(alert: boolean) {
        if (alert) {
            toastStore.showFailureToast(i18nKey("errorSendingMessage"));
        }
    }

    function registerBot() {
        modal = { kind: "register_bot" };
    }

    function updateBot() {
        modal = { kind: "update_bot" };
    }

    function removeBot() {
        modal = { kind: "remove_bot" };
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

    function remoteVideoCallEnded(messageId: bigint) {
        if ($incomingVideoCall?.messageId === messageId) {
            incomingVideoCall.set(undefined);
        }
    }

    function remoteVideoCallStarted(ev: PubSubEvents["remoteVideoCallStarted"]) {
        // If current user is already in the call, or has previously been in the call, or the call started more than an hour ago, exit
        if (
            chatIdentifiersEqual($activeVideoCall?.chatId, ev.chatId) ||
            ev.currentUserIsParticipant ||
            Number(ev.timestamp) < Date.now() - 60 * 60 * 1000
        ) {
            return;
        }

        incomingVideoCall.set(ev);
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
                autojoin = pathState.querystring.has("autojoin");
                const code = pathState.querystring.get("code");
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
                joinGroup({ group: chat, select: true });
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
        const found = await client.setSelectedCommunity(
            id,
            pathState.querystring.get("code"),
            clearChat,
        );
        if (!found) {
            modal = { kind: "no_access" };
        }
        return found;
    }

    function selectFirstChat(): boolean {
        if (!ui.mobileWidth) {
            const first = $chatSummariesListStore.find((c) => !c.membership.archived);
            if (first !== undefined) {
                pageRedirect(routeForChatIdentifier($chatListScope.kind, first.id));
                return true;
            }
        }
        return false;
    }

    let communityLoaded = false;

    async function routeChange(initialised: boolean, route: RouteParams): Promise<void> {
        // wrap the whole thing in untrack because we don't want it to react to everything it reads in here
        untrack(async () => {
            // wait until we have loaded the chats
            if (initialised) {
                ui.filterRightPanelHistory((state) => state.kind !== "community_filters");
                if (
                    $anonUser &&
                    route.kind === "chat_list_route" &&
                    (route.scope.kind === "direct_chat" || route.scope.kind === "favourite")
                ) {
                    client.updateIdentityState({ kind: "logging_in" });
                    pageRedirect("/group");
                    return;
                }

                if ("scope" in route) {
                    client.setChatListScope(route.scope);
                }

                // When we have a middle panel and this route is for a chat list then select the first chat
                if (route.kind === "chat_list_route" && selectFirstChat()) {
                    return;
                }

                // first close any open thread
                closeThread();

                if (route.kind === "home_route") {
                    client.clearSelectedChat();
                    filterChatSpecificRightPanelStates();
                } else if (route.kind === "communities_route") {
                    client.clearSelectedChat();
                    ui.rightPanelHistory = ui.fullWidth ? [{ kind: "community_filters" }] : [];
                } else if (route.kind === "selected_community_route") {
                    await selectCommunity(route.communityId);
                    if (selectFirstChat()) {
                        communityLoaded = true;
                        return;
                    }
                } else if (
                    route.kind === "global_chat_selected_route" ||
                    route.kind === "selected_channel_route"
                ) {
                    if (route.kind === "selected_channel_route") {
                        if (!communityLoaded) {
                            await selectCommunity(route.communityId, false);
                        }
                        communityLoaded = false;
                    }

                    // if the chat in the url is different from the chat we already have selected
                    if (!chatIdentifiersEqual(route.chatId, $selectedChatId)) {
                        newChatSelected(route.chatId, route.messageIndex, route.threadMessageIndex);
                    } else {
                        // if the chat in the url is *the same* as the selected chat
                        // *and* if we have a messageIndex specified in the url
                        if (route.messageIndex !== undefined) {
                            waitAndScrollToMessageIndex(route.messageIndex, false);
                        }
                    }
                } else {
                    // any other route with no associated chat therefore we must clear any selected chat and potentially close the right panel
                    if ($selectedChatId !== undefined) {
                        client.clearSelectedChat();
                    }
                    filterChatSpecificRightPanelStates();

                    if (route.kind === "share_route") {
                        share = {
                            title: route.title,
                            text: route.text,
                            url: route.url,
                            files: [],
                        };
                        pageReplace(routeForScope(client.getDefaultScope()));
                        modal = { kind: "select_chat" };
                    }
                }

                // regardless of the path params, we *always* check the query string
                const diamond = pathState.querystring.get("diamond");
                if (diamond !== null) {
                    showUpgrade = true;
                    pageReplace(removeQueryStringParam("diamond"));
                }

                const wallet = pathState.querystring.get("wallet");
                if (wallet !== null) {
                    modal = { kind: "wallet" };
                    pageReplace(removeQueryStringParam("wallet"));
                }

                const faq = pathState.querystring.get("faq");
                if (faq !== null) {
                    pageReplace(`/faq?q=${faq}`);
                }

                const hof = pathState.querystring.get("hof");
                if (hof !== null) {
                    modal = { kind: "hall_of_fame" };
                    pageReplace(removeQueryStringParam("hof"));
                }

                const everyone = pathState.querystring.get("everyone");
                if (everyone !== null) {
                    ui.rightPanelHistory = [{ kind: "show_group_members" }];
                    pageReplace(removeQueryStringParam("everyone"));
                }

                const usergroup = pathState.querystring.get("usergroup");
                if (usergroup !== null) {
                    const userGroupId = Number(usergroup);
                    ui.rightPanelHistory = [{ kind: "show_community_members", userGroupId }];
                    pageReplace(removeQueryStringParam("usergroup"));
                }

                if (client.captureReferralCode()) {
                    pageReplace(removeQueryStringParam("ref"));
                }

                if (modal?.kind === "claim_daily_chit") {
                    modal = { kind: "none" };
                }
            }
        });
    }

    // Note: very important (and hacky) that this is hidden in a function rather than inline in the top level reactive
    // statement because we don't want that reactive statement to execute in reponse to changes in rightPanelHistory :puke:
    function filterChatSpecificRightPanelStates() {
        ui.filterRightPanelHistory((panel) => panel.kind === "user_profile");
    }

    function closeThread() {
        if (creatingThread) {
            creatingThread = false;
            return;
        }
        tick().then(() => {
            activeVideoCall?.threadOpen(false);
            ui.filterRightPanelHistory((panel) => panel.kind !== "message_thread_panel");
        });
    }

    function resetRightPanel() {
        ui.filterRightPanelHistoryByChatType($selectedChatStore);
    }

    function goToMessageIndex(detail: { index: number; preserveFocus: boolean }) {
        waitAndScrollToMessageIndex(detail.index, detail.preserveFocus);
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

    function onTriggerConfirm(detail: ConfirmActionEvent) {
        confirmActionEvent = detail;
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
                    ui.rightPanelHistory = [];
                });
            case "delete":
                return deleteGroup(confirmActionEvent.chatId, confirmActionEvent.level).then(
                    (_) => {
                        ui.rightPanelHistory = [];
                        confirmActionEvent.after?.();
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

    function chatWith(chatId: DirectChatIdentifier) {
        const chat = $chatSummariesListStore.find((c) => {
            return c.kind === "direct_chat" && c.them === chatId;
        });

        page(routeForChatIdentifier(chat ? $chatListScope.kind : "direct_chat", chatId));
    }

    function showInviteGroupUsers(show: boolean) {
        if ($selectedChatId !== undefined) {
            if (show) {
                ui.rightPanelHistory = [{ kind: "invite_group_users" }];
            } else {
                ui.pushRightPanelHistory({ kind: "invite_group_users" });
            }
        }
    }

    function replyPrivatelyTo(context: EnhancedReplyContext) {
        if (context.sender === undefined) return;

        const chat = $chatSummariesListStore.find((c) => {
            return (
                c.kind === "direct_chat" &&
                chatIdentifiersEqual(c.them, {
                    kind: "direct_chat",
                    userId: context.sender!.userId,
                })
            );
        });

        const chatId = chat?.id ?? { kind: "direct_chat", userId: context.sender.userId };
        draftMessagesStore.setTextContent({ chatId }, "");
        draftMessagesStore.setReplyingTo({ chatId }, context);
        if (chat) {
            page(routeForChatIdentifier($chatListScope.kind, chatId));
        } else {
            createDirectChat(chatId as DirectChatIdentifier);
        }
    }

    function forwardMessage(message: Message) {
        messageToForward = message;
        modal = { kind: "select_chat" };
    }

    function showGroupMembers() {
        if ($selectedChatId !== undefined) {
            ui.rightPanelHistory = [{ kind: "show_group_members" }];
        }
    }

    function showProfile() {
        if ($selectedChatId !== undefined) {
            pageReplace(routeForChatIdentifier($chatListScope.kind, $selectedChatId));
        }
        ui.rightPanelHistory = [{ kind: "user_profile" }];
    }

    function openThread(ev: { threadRootEvent: EventWrapper<Message>; initiating: boolean }) {
        if ($selectedChatId !== undefined) {
            if (ev.initiating) {
                creatingThread = true;
                pageReplace(routeForChatIdentifier($chatListScope.kind, $selectedChatId));
            }

            tick().then(() => {
                ui.rightPanelHistory = [
                    {
                        kind: "message_thread_panel",
                        threadRootMessageIndex: ev.threadRootEvent.event.messageIndex,
                        threadRootMessageId: ev.threadRootEvent.event.messageId,
                    },
                ];
            });
        }
    }

    function communityDetails(_: CommunitySummary) {
        // what do we do here if the community is not selected
        // do we select it?
        if ($chatListScope.kind === "community") {
            ui.rightPanelHistory = [{ kind: "community_details" }];
        }
    }

    function showProposalFilters() {
        if ($selectedChatId !== undefined) {
            pageReplace(routeForChatIdentifier($chatListScope.kind, $selectedChatId));
            ui.rightPanelHistory = [
                {
                    kind: "proposal_filters",
                },
            ];
        }
    }

    function showMakeProposalModal() {
        if (nervousSystem !== undefined && selectedMultiUserChat !== undefined) {
            modal = { kind: "make_proposal", chat: selectedMultiUserChat, nervousSystem };
        }
    }

    async function joinGroup(detail: { group: MultiUserChat; select: boolean }): Promise<void> {
        if ($anonUser) {
            client.updateIdentityState({
                kind: "logging_in",
                postLogin: { kind: "join_group", ...detail },
            });
            return;
        }
        const { group, select } = detail;

        // it's possible that we got here via a postLogin capture in which case it's possible
        // that we are actually already a member of this group, so we should double check here
        // that we actually *need* to join the group
        let chat = $chatSummariesStore.get(group.id);
        if (chat === undefined || chat.membership.role === "none" || client.isLapsed(chat.id)) {
            doJoinGroup(group, select, undefined);
        }
    }

    function accessGatesEvaluated(success: GateCheckSucceeded) {
        if (modal.kind === "evaluating_access_gates") {
            const { group, select } = modal;
            closeModal();
            doJoinGroup(group, select, success);
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

    function onSelectChat(chatId: ChatIdentifier) {
        closeModal();
        if (messageToForward !== undefined) {
            forwardToChat(chatId);
            messageToForward = undefined;
        } else {
            shareWithChat(chatId);
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

    function showWallet() {
        modal = { kind: "wallet" };
    }

    function newChannel(embeddedContent: boolean) {
        newGroup("channel", embeddedContent);
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
                verified: false,
            },
        };
    }

    function editGroup(detail: { chat: MultiUserChat; rules: UpdatedRules | undefined }) {
        const chat = detail.chat;
        let level: Level = chat.id.kind === "group_chat" ? "group" : "channel";
        let rules = detail.rules ?? { ...defaultChatRules(level), newVersion: false };
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
                verified: chat.kind === "group_chat" ? chat.verified : false,
            },
        };
    }

    function toggleMuteNotifications(detail: { chatId: ChatIdentifier; mute: boolean }) {
        const op = detail.mute ? "muted" : "unmuted";
        client.toggleMuteNotifications(detail.chatId, detail.mute).then((success) => {
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

    function editCommunity(community: CommunitySummary) {
        modal = {
            kind: "edit_community",
            community,
            communityRules: $currentCommunityRules ?? defaultChatRules("community"),
        };
    }

    function convertGroupToCommunity(group: GroupChatSummary) {
        ui.rightPanelHistory = [];
        convertGroup = group;
    }

    function successfulImport(id: ChannelIdentifier) {
        page(`/community/${id.communityId}`);
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
        chatWith({ kind: "direct_chat", userId: showProfileCard.userId });
        showProfileCard = undefined;
    }

    let forgotPin = $state(false);

    function onForgotPin() {
        forgotPin = true;
    }

    function onPinNumberComplete(pin: string | undefined) {
        if (pin) {
            $pinNumberStore?.resolve(pin);
        }
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

    let confirmMessage = $derived(getConfirmMessage(confirmActionEvent));
    let selectedMultiUserChat = $derived(
        $selectedChatStore?.kind === "group_chat" || $selectedChatStore?.kind === "channel"
            ? $selectedChatStore
            : undefined,
    );
    let governanceCanisterId = $derived(
        selectedMultiUserChat !== undefined
            ? selectedMultiUserChat.subtype?.governanceCanisterId
            : undefined,
    );
    let nervousSystem = $derived(client.tryGetNervousSystem(governanceCanisterId));
    // $: nervousSystem = client.tryGetNervousSystem("rrkah-fqaaa-aaaaa-aaaaq-cai");
    trackedEffect("identity-state", () => {
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
            const join = { ...$identityState.postLogin };
            client.clearPostLoginState();
            tick().then(() => joinGroup(join));
        }
    });
    trackedEffect("route-change", () => {
        routeChange($chatsInitialised, pathState.route);
    });
    let bgHeight = $derived(ui.dimensions.height * 0.9);
    let bgClip = $derived(((ui.dimensions.height - 32) / bgHeight) * 361);
</script>

{#if showProfileCard !== undefined}
    {@const profileUser = $userStore.get(showProfileCard.userId)}
    {#if profileUser?.kind !== "bot"}
        <ViewUserProfile
            userId={showProfileCard.userId}
            inGlobalContext={showProfileCard.inGlobalContext}
            chatButton={showProfileCard.chatButton}
            alignTo={showProfileCard.alignTo}
            onOpenDirectChat={chatWithFromProfileCard}
            onClose={() => (showProfileCard = undefined)} />
    {/if}
{/if}

<main class:anon={$anonUser} class:offline={$offlineStore}>
    <LeftNav />
    <LeftPanel />
    <MiddlePanel {joining} bind:currentChatMessages onGoToMessageIndex={goToMessageIndex} />
    <RightPanel onGoToMessageIndex={goToMessageIndex} />
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
    <Upgrade onCancel={() => (showUpgrade = false)} />
{/if}

{#if modal.kind !== "none"}
    <Overlay
        dismissible={modal.kind !== "select_chat" &&
            modal.kind !== "not_found" &&
            modal.kind !== "registering" &&
            modal.kind !== "make_proposal"}
        alignLeft={modal.kind === "select_chat"}
        onClose={closeModal}>
        {#if modal.kind === "select_chat"}
            <SelectChatModal onClose={onCloseSelectChat} onSelect={onSelectChat} />
        {:else if modal.kind === "registering"}
            <Register onCreatedUser={(user) => client.onRegisteredUser(user)} />
        {:else if modal.kind === "suspended"}
            <SuspendedModal onClose={closeModal} />
        {:else if modal.kind === "register_bot"}
            <BotBuilderModal mode={"register"} onClose={closeModal} />
        {:else if modal.kind === "update_bot"}
            <BotBuilderModal mode={"update"} onClose={closeModal} />
        {:else if modal.kind === "remove_bot"}
            <BotBuilderModal mode={"remove"} onClose={closeModal} />
        {:else if modal.kind === "no_access"}
            <NoAccess onClose={closeNoAccess} />
        {:else if modal.kind === "not_found"}
            <NotFound onClose={closeNoAccess} />
        {:else if modal.kind === "gate_check_failed"}
            <GateCheckFailed onClose={closeModal} gates={modal.gates} />
        {:else if modal.kind === "evaluating_access_gates"}
            <AccessGateEvaluator
                gates={modal.gates}
                onClose={closeModal}
                onSuccess={accessGatesEvaluated} />
        {:else if modal.kind === "new_group"}
            <CreateOrUpdateGroup
                embeddedContent={modal.embeddedContent}
                bind:candidateGroup={modal.candidate}
                onClose={closeModal} />
        {:else if modal.kind === "edit_community"}
            <EditCommunity
                originalRules={modal.communityRules}
                original={modal.community}
                onClose={closeModal} />
        {:else if modal.kind === "wallet"}
            <AccountsModal onClose={closeModal} />
        {:else if modal.kind === "hall_of_fame"}
            <HallOfFame
                onStreak={() => (modal = { kind: "claim_daily_chit" })}
                onClose={closeModal} />
        {:else if modal.kind === "make_proposal"}
            <MakeProposalModal
                selectedMultiUserChat={modal.chat}
                nervousSystem={modal.nervousSystem}
                onClose={closeModal} />
        {:else if modal.kind === "logging_in"}
            <LoggingInModal onClose={closeModal} />
        {:else if modal.kind === "claim_daily_chit"}
            <DailyChitModal onLeaderboard={leaderboard} onClose={closeModal} />
        {:else if modal.kind === "challenge"}
            <ChallengeModal on:close={closeModal} />
        {:else if modal.kind === "verify_humanity"}
            <VerifyHumanity onClose={closeModal} onSuccess={closeModal} />
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
            onPinSet={onPinNumberComplete}
            onClose={() => (forgotPin = false)}
            type={{ kind: "forgot", while: { kind: "enter" } }} />
    </Overlay>
{:else if $pinNumberStore !== undefined}
    <Overlay>
        <PinNumberModal
            onClose={onPinNumberClose}
            onComplete={onPinNumberComplete}
            onForgot={onForgotPin} />
    </Overlay>
{/if}

<!-- <svelte:body onprofile-clicked={profileLinkClicked} /> -->

{#if $chitPopup && !$disableChit}
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

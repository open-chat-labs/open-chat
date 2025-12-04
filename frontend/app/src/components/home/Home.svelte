<script lang="ts">
    import { trackedEffect } from "@src/utils/effects.svelte";
    import type { ProfileLinkClickedEvent } from "@webcomponents/profileLink";
    import type {
        CandidateGroupChat,
        ChannelIdentifier,
        ChatIdentifier,
        CommunityIdentifier,
        CommunitySummary,
        DirectChatIdentifier,
        EnhancedAccessGate,
        EnhancedReplyContext,
        FullWebhookDetails,
        GateCheckSucceeded,
        GroupChatSummary,
        Level,
        Message,
        MultiUserChat,
        MultiUserChatIdentifier,
        NervousSystemDetails,
        OpenChat,
        PubSubEvents,
        ResourceKey,
        RouteParams,
        Rules,
        UpdatedRules,
    } from "openchat-client";
    import {
        allUsersStore,
        anonUserStore,
        chatIdentifiersEqual,
        chatListScopeStore,
        chatsInitialisedStore,
        chatSummariesListStore,
        chatSummariesStore,
        communitiesStore,
        currentUserStore,
        defaultChatRules,
        dimensionsHeight,
        fullWidth,
        identityStateStore,
        localUpdates,
        offlineStore,
        pageRedirect,
        pageReplace,
        pinNumberResolverStore,
        querystringStore,
        ROLE_NONE,
        routeForChatIdentifier,
        routeForScope,
        routeStore,
        captureRulesAcceptanceStore as rulesAcceptanceStore,
        selectedChatIdStore,
        selectedChatSummaryStore,
        selectedCommunityRulesStore,
        setRightPanelHistory,
        subscribe,
        suspendedUserStore,
    } from "openchat-client";
    import page from "page";
    import { getContext, onMount, tick, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import { createCandidateCommunity } from "../../stores/community";
    import { messageToForwardStore } from "../../stores/messageToForward";
    import { chitPopup, disableChit } from "../../stores/settings";
    import { toastStore } from "../../stores/toast";
    import { activeVideoCall, incomingVideoCall } from "../../stores/video";
    import {
        currentTheme,
        currentThemeName,
        preferredDarkThemeName,
        themeType,
    } from "../../theme/themes";
    import { scream } from "../../utils/scream";
    import type { Share } from "../../utils/share";
    import { removeQueryStringParam } from "../../utils/urls";
    import AreYouSure from "../AreYouSure.svelte";
    import BackgroundLogo from "../BackgroundLogo.svelte";
    import BotBuilderModal from "../bots/BotBuilderModal.svelte";
    import WebhookModal from "../bots/WebhookModal.svelte";
    import EditLabel from "../EditLabel.svelte";
    import NativeOnboardModal from "../mobile/NativeOnboardModal.svelte";
    import NotFound from "../NotFound.svelte";
    import OfflineFooter from "../OfflineFooter.svelte";
    import OnboardModal from "../onboard/OnboardModal.svelte";
    import Overlay from "../Overlay.svelte";
    import SelectChatModal from "../SelectChatModal.svelte";
    import SuspendedModal from "../SuspendedModal.svelte";
    import Toast from "../Toast.svelte";
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
    import DailyChitModal from "./DailyChitModal.svelte";
    import LeftPanel from "./LeftPanel.svelte";
    import MiddlePanel from "./MiddlePanel.svelte";
    import LeftNav from "./nav/LeftNav.svelte";
    import NoAccess from "./NoAccess.svelte";
    import PinNumberModal from "./PinNumberModal.svelte";
    import AccountsModal from "./profile/AccountsModal.svelte";
    import SetPinNumberModal from "./profile/SetPinNumberModal.svelte";
    import VerifyHumanity from "./profile/VerifyHumanity.svelte";
    import ViewUserProfile from "./profile/ViewUserProfileModal.svelte";
    import MakeProposalModal from "./proposal/MakeProposalModal.svelte";
    import RightPanel from "./RightPanelWrapper.svelte";
    import SuspendModal from "./SuspendModal.svelte";
    import Upgrade from "./upgrade/Upgrade.svelte";

    type ViewProfileConfig = {
        userId: string;
        chatButton: boolean;
        alignTo?: HTMLElement;
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
        | { kind: "register_webhook" }
        | { kind: "update_webhook"; webhook: FullWebhookDetails }
        | { kind: "suspended" }
        | { kind: "suspending"; userId: string }
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
            subscribe("clearSelection", () => page(routeForScope($chatListScopeStore))),
            subscribe("editGroup", editGroup),
            subscribe("userSuspensionChanged", () => window.location.reload()),
            subscribe("selectedChatInvalid", selectedChatInvalid),
            subscribe("sendMessageFailed", sendMessageFailed),
            subscribe("summonWitch", summonWitch),
            subscribe("registerBot", registerBot),
            subscribe("updateBot", updateBot),
            subscribe("removeBot", removeBot),
            subscribe("registerWebhook", registerWebhook),
            subscribe("updateWebhook", updateWebhook),
            subscribe("remoteVideoCallStarted", remoteVideoCallStarted),
            subscribe("remoteVideoCallEnded", remoteVideoCallEnded),
            subscribe("notification", (n) => client.notificationReceived(n)),
            subscribe("noAccess", () => (modal = { kind: "no_access" })),
            subscribe("notFound", () => (modal = { kind: "not_found" })),
            subscribe("copyUrl", copyUrl),
            subscribe("suspendUser", suspendUser),
        ];
        client.initialiseNotifications();
        document.body.addEventListener("profile-clicked", profileClicked);

        if ($suspendedUserStore) {
            modal = { kind: "suspended" };
        }

        return () => {
            unsubEvents.forEach((u) => u());
            document.body.removeEventListener("profile-clicked", profileClicked);
        };
    });

    function suspendUser(userId: string) {
        modal = { kind: "suspending", userId };
    }

    function profileClicked(event: Event) {
        profileLinkClicked(event as CustomEvent<ProfileLinkClickedEvent>);
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

    function registerWebhook() {
        modal = { kind: "register_webhook" };
    }

    function updateWebhook({ hook }: { hook: FullWebhookDetails; chat: MultiUserChat }) {
        modal = { kind: "update_webhook", webhook: hook };
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
        // If current user is already in the call, or has previously been in the call, or the call started more than 2 hours ago, exit
        if (
            chatIdentifiersEqual($activeVideoCall?.chatId, ev.chatId) ||
            ev.currentUserIsParticipant ||
            Number(ev.timestamp) < Date.now() - 2 * 60 * 60 * 1000
        ) {
            return;
        }

        incomingVideoCall.set(ev);
    }

    async function routeChange(initialised: boolean, route: RouteParams): Promise<void> {
        // wrap the whole thing in untrack because we don't want it to react to everything it reads in here
        untrack(async () => {
            // wait until we have loaded the chats
            if (initialised) {
                client.filterRightPanelHistory((state) => state.kind !== "community_filters");
                if (
                    $anonUserStore &&
                    client.isChatListRoute(route) &&
                    route.scope.kind === "favourite"
                ) {
                    client.updateIdentityState({ kind: "logging_in" });
                    pageRedirect("/chats");
                    return;
                }

                if (client.setChatListScopeAndRedirect(route)) {
                    return;
                }

                if (client.isHomeRoute(route)) {
                    filterChatSpecificRightPanelStates();
                } else if (client.isCommunitiesRoute(route)) {
                    setRightPanelHistory($fullWidth ? [{ kind: "community_filters" }] : []);
                } else {
                    // any other route with no associated chat therefore we must clear any selected chat and potentially close the right panel
                    if (client.isShareRoute(route)) {
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

                if (modal?.kind === "claim_daily_chit") {
                    modal = { kind: "none" };
                }
            }
        });
    }

    // Note: very important (and hacky) that this is hidden in a function rather than inline in the top level reactive
    // statement because we don't want that reactive statement to execute in reponse to changes in rightPanelHistory :puke:
    function filterChatSpecificRightPanelStates() {
        client.filterRightPanelHistory((panel) => panel.kind === "user_profile");
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
                    setRightPanelHistory([]);
                });
            case "delete":
                return deleteGroup(confirmActionEvent.chatId, confirmActionEvent.level).then(
                    (_) => {
                        setRightPanelHistory([]);
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
            page(routeForScope($chatListScopeStore));
        }
        return client.deleteGroup(chatId).then((success) => {
            if (success) {
                toastStore.showSuccessToast(i18nKey("deleteGroupSuccess", undefined, level));
            } else {
                toastStore.showFailureToast(i18nKey("deleteGroupFailure", undefined, level, true));
                page(routeForChatIdentifier($chatListScopeStore.kind, chatId));
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
        page(routeForScope($chatListScopeStore));

        client.leaveGroup(chatId).then((resp) => {
            if (resp !== "success") {
                if (resp === "owner_cannot_leave") {
                    toastStore.showFailureToast(i18nKey("ownerCantLeave", undefined, level, true));
                } else {
                    toastStore.showFailureToast(
                        i18nKey("failedToLeaveGroup", undefined, level, true),
                    );
                }
                page(routeForChatIdentifier($chatListScopeStore.kind, chatId));
            }
        });

        return Promise.resolve();
    }

    function chatWith(chatId: DirectChatIdentifier) {
        const chat = $chatSummariesListStore.find((c) => {
            return c.kind === "direct_chat" && c.them === chatId;
        });

        page(routeForChatIdentifier(chat ? $chatListScopeStore.kind : "chats", chatId));
    }

    function showInviteGroupUsers(show: boolean) {
        if ($selectedChatIdStore !== undefined) {
            if (show) {
                setRightPanelHistory([{ kind: "invite_group_users" }]);
            } else {
                client.pushRightPanelHistory({ kind: "invite_group_users" });
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
        localUpdates.draftMessages.setTextContent({ chatId }, "");
        localUpdates.draftMessages.setReplyingTo({ chatId }, context);
        if (chat) {
            page(routeForChatIdentifier($chatListScopeStore.kind, chatId));
        } else {
            createDirectChat(chatId as DirectChatIdentifier);
        }
    }

    function forwardMessage(message: Message) {
        messageToForward = message;
        modal = { kind: "select_chat" };
    }

    function showGroupMembers() {
        if ($selectedChatIdStore !== undefined) {
            setRightPanelHistory([{ kind: "show_group_members" }]);
        }
    }

    function showProfile() {
        setRightPanelHistory([{ kind: "user_profile" }]);
    }

    function communityDetails(_: CommunitySummary) {
        // what do we do here if the community is not selected
        // do we select it?
        if ($chatListScopeStore.kind === "community") {
            setRightPanelHistory([{ kind: "community_details" }]);
        }
    }

    function showProposalFilters() {
        if ($selectedChatIdStore !== undefined) {
            setRightPanelHistory([
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

    async function joinGroup(detail: { group: MultiUserChat; select: boolean }): Promise<void> {
        if ($anonUserStore) {
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
        if (chat === undefined || chat.membership.role === ROLE_NONE || client.isLapsed(chat.id)) {
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
                    page(routeForChatIdentifier($chatListScopeStore.kind, group.id));
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
        page(routeForChatIdentifier($chatListScopeStore.kind, chatId));
        messageToForwardStore.set(messageToForward);
    }

    function shareWithChat(chatId: ChatIdentifier) {
        page(routeForChatIdentifier($chatListScopeStore.kind, chatId));

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

        localUpdates.draftMessages.setTextContent({ chatId }, text);
    }

    function showWallet() {
        modal = { kind: "wallet" };
    }

    function newChannel(embeddedContent: boolean) {
        newGroup("channel", embeddedContent);
    }

    function newGroup(level: Level = "group", embeddedContent: boolean = false) {
        const candidate = client.createCandidateGroup(level, embeddedContent);
        if (candidate === undefined) return;

        modal = {
            kind: "new_group",
            embeddedContent,
            candidate,
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

    function toggleMuteNotifications(detail: {
        chatId: ChatIdentifier;
        mute: boolean | undefined;
        muteAtEveryone: boolean | undefined;
    }) {
        const op = detail.mute ? "muted" : "unmuted";
        client
            .toggleMuteNotifications(detail.chatId, detail.mute, detail.muteAtEveryone)
            .then((success) => {
                if (!success) {
                    toastStore.showFailureToast(
                        i18nKey("toggleMuteNotificationsFailed", {
                            operation: $_(op),
                        }),
                    );
                }
            });
    }

    function copyUrl() {
        const url = window.location.href;

        navigator.clipboard.writeText(url).then(
            () => {
                toastStore.showSuccessToast(i18nKey("urlCopiedToClipboard"));
            },
            () => {
                toastStore.showFailureToast(i18nKey("failedToCopyUrlToClipboard", { url }));
            },
        );
    }

    async function createDirectChat(chatId: DirectChatIdentifier): Promise<boolean> {
        if (!(await client.createDirectChat(chatId))) {
            modal = { kind: "not_found" };
            return false;
        }

        page(routeForChatIdentifier("chats", chatId));
        return true;
    }

    function createCommunity() {
        const maxIndex = $communitiesStore.reduce(
            (m, [_, c]) => (c.membership.index > m ? c.membership.index : m),
            0,
        );
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
            communityRules: $selectedCommunityRulesStore ?? defaultChatRules("community"),
        };
    }

    function convertGroupToCommunity(group: GroupChatSummary) {
        setRightPanelHistory([]);
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
            alignTo: ev.target ? (ev.target as HTMLElement) : undefined,
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
            $pinNumberResolverStore?.resolve(pin);
        }
    }

    function onPinNumberClose() {
        $pinNumberResolverStore?.reject();
    }

    function verifyHumanity() {
        modal = { kind: "verify_humanity" };
    }

    function claimDailyChit() {
        modal = { kind: "claim_daily_chit" };
    }

    let confirmMessage = $derived(getConfirmMessage(confirmActionEvent));
    let selectedMultiUserChat = $derived(
        $selectedChatSummaryStore?.kind === "group_chat" ||
            $selectedChatSummaryStore?.kind === "channel"
            ? $selectedChatSummaryStore
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
        if ($identityStateStore.kind === "registering") {
            modal = { kind: "registering" };
        } else if ($identityStateStore.kind === "logging_in") {
            modal = { kind: "logging_in" };
        } else if ($identityStateStore.kind === "logged_in" && modal.kind === "registering") {
            console.log("We are now logged in so we are closing the register modal");
            closeModal();
        } else if ($identityStateStore.kind === "challenging") {
            modal = { kind: "challenge" };
        }
        if (
            $identityStateStore.kind === "logged_in" &&
            $identityStateStore.postLogin?.kind === "join_group" &&
            $chatsInitialisedStore
        ) {
            const join = { ...$identityStateStore.postLogin };
            client.clearPostLoginState();
            tick().then(() => joinGroup(join));
        }
    });

    trackedEffect("route-change", () => {
        routeChange($chatsInitialisedStore, $routeStore);
    });

    $effect(() => {
        if ($chatsInitialisedStore) {
            if ($querystringStore.get("diamond") !== null) {
                showUpgrade = true;
                pageReplace(removeQueryStringParam("diamond"));
            }
            const faq = $querystringStore.get("faq");
            if (faq !== null) {
                pageReplace(`/faq?q=${faq}`);
            }
            if ($querystringStore.get("wallet") !== null) {
                showWallet();
                pageReplace(removeQueryStringParam("wallet"));
            }
            if ($querystringStore.get("hof") !== null) {
                modal = { kind: "hall_of_fame" };
                pageReplace(removeQueryStringParam("hof"));
            }
            if ($querystringStore.get("everyone") !== null) {
                setRightPanelHistory([{ kind: "show_group_members" }]);
                pageReplace(removeQueryStringParam("everyone"));
            }
            const usergroup = $querystringStore.get("usergroup");
            if (usergroup !== null) {
                const userGroupId = Number(usergroup);
                setRightPanelHistory([{ kind: "show_community_members", userGroupId }]);
                pageReplace(removeQueryStringParam("usergroup"));
            }
        }
    });

    let bgHeight = $derived($dimensionsHeight * 0.9);
    let bgClip = $derived((($dimensionsHeight - 32) / bgHeight) * 361);
</script>

{#if showProfileCard !== undefined}
    {@const profileUser = $allUsersStore.get(showProfileCard.userId)}
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

<main class:anon={$anonUserStore} class:offline={$offlineStore}>
    <LeftNav />
    <LeftPanel />
    <MiddlePanel {joining} />
    <RightPanel />
</main>

{#if $anonUserStore}
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

{#if showUpgrade && $currentUserStore}
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
        {:else if modal.kind === "suspended"}
            <SuspendedModal onClose={closeModal} />
        {:else if modal.kind === "register_bot"}
            <BotBuilderModal mode={"register"} onClose={closeModal} />
        {:else if modal.kind === "update_bot"}
            <BotBuilderModal mode={"update"} onClose={closeModal} />
        {:else if modal.kind === "remove_bot"}
            <BotBuilderModal mode={"remove"} onClose={closeModal} />
        {:else if modal.kind === "register_webhook" && ($selectedChatIdStore?.kind === "group_chat" || $selectedChatIdStore?.kind === "channel")}
            <WebhookModal
                chatId={$selectedChatIdStore}
                mode={{ kind: "register" }}
                onClose={closeModal} />
        {:else if modal.kind === "update_webhook" && ($selectedChatIdStore?.kind === "group_chat" || $selectedChatIdStore?.kind === "channel")}
            <WebhookModal
                chatId={$selectedChatIdStore}
                mode={{ kind: "update", webhook: modal.webhook }}
                onClose={closeModal} />
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
        {:else if modal.kind === "logging_in" || modal.kind === "registering"}
            {#if client.isNativeAndroid()}
                <NativeOnboardModal onClose={closeModal} />
            {:else}
                <OnboardModal
                    step={modal.kind === "registering" ? "sign_up" : "select_mode"}
                    onClose={closeModal} />
            {/if}
        {:else if modal.kind === "claim_daily_chit"}
            <DailyChitModal onLeaderboard={leaderboard} onClose={closeModal} />
        {:else if modal.kind === "challenge"}
            <ChallengeModal on:close={closeModal} />
        {:else if modal.kind === "verify_humanity"}
            <VerifyHumanity onClose={closeModal} onSuccess={closeModal} />
        {:else if modal.kind === "suspending"}
            <SuspendModal userId={modal.userId} onClose={closeModal} />
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
{:else if $pinNumberResolverStore !== undefined}
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

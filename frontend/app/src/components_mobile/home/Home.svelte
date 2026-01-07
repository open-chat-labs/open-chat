<script lang="ts">
    import { trackedEffect } from "@src/utils/effects.svelte";
    import type { ProfileLinkClickedEvent } from "@webcomponents/profileLink";
    import { Container } from "component-lib";
    import type {
        ChannelIdentifier,
        ChatIdentifier,
        CommunityIdentifier,
        DirectChatIdentifier,
        EnhancedReplyContext,
        Level,
        MultiUserChat,
        MultiUserChatIdentifier,
        NervousSystemDetails,
        OpenChat,
        PubSubEvents,
        ResourceKey,
        RouteParams,
    } from "openchat-client";
    import {
        allUsersStore,
        anonUserStore,
        chatIdentifiersEqual,
        chatListScopeStore,
        chatsInitialisedStore,
        chatSummariesListStore,
        identityStateStore,
        localUpdates,
        offlineStore,
        pageRedirect,
        pageReplace,
        pinNumberResolverStore,
        publish,
        querystringStore,
        routeForChatIdentifier,
        routeForScope,
        routeStore,
        captureRulesAcceptanceStore as rulesAcceptanceStore,
        selectedChatSummaryStore,
        subscribe,
        suspendedUserStore,
    } from "openchat-client";
    import page from "page";
    import { getContext, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import { chitPopup, disableChit } from "../../stores/settings";
    import { toastStore } from "../../stores/toast";
    import { activeVideoCall, incomingVideoCall } from "../../stores/video";
    import { removeQueryStringParam } from "../../utils/urls";
    import AreYouSure from "../AreYouSure.svelte";
    import NotFound from "../NotFound.svelte";
    import OfflineFooter from "../OfflineFooter.svelte";
    import OnboardModal from "../onboard/OnboardModal.svelte";
    import Overlay from "../Overlay.svelte";
    import SuspendedModal from "../SuspendedModal.svelte";
    import Toast from "../Toast.svelte";
    import AcceptRulesModal from "./AcceptRulesModal.svelte";
    import AnonFooter from "./AnonFooter.svelte";
    import ChallengeModal from "./ChallengeModal.svelte";
    import ChitEarned from "./ChitEarned.svelte";
    import LeftPanel from "./LeftPanel.svelte";
    import MiddlePanel from "./MiddlePanel.svelte";
    import NoAccess from "./NoAccess.svelte";
    import PinNumberModal from "./PinNumberModal.svelte";
    import VerifyHumanity from "./profile/VerifyHumanity.svelte";
    import ViewUserProfile from "./profile/ViewUserProfileModal.svelte";
    import MakeProposalModal from "./proposal/MakeProposalModal.svelte";
    import SuspendModal from "./SuspendModal.svelte";
    import SetPinNumberModal from "./wallet/SetPinNumberModal.svelte";

    type ViewProfileConfig = {
        userId: string;
        chatButton: boolean;
        alignTo?: HTMLElement;
        inGlobalContext: boolean;
    };

    const client = getContext<OpenChat>("client");

    let showProfileCard = $state<ViewProfileConfig>();

    type ConfirmActionEvent =
        | ConfirmLeaveEvent
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

    type ConfirmDeleteCommunityEvent = {
        kind: "delete_community";
        communityId: CommunityIdentifier;
        doubleCheck: { challenge: ResourceKey; response: ResourceKey };
    };

    type ModalType =
        | { kind: "none" }
        | { kind: "verify_humanity" }
        | { kind: "suspended" }
        | { kind: "suspending"; userId: string }
        | { kind: "no_access" }
        | { kind: "hall_of_fame" }
        | { kind: "make_proposal"; chat: MultiUserChat; nervousSystem: NervousSystemDetails }
        | { kind: "not_found" }
        | { kind: "challenge" };

    let modal: ModalType = $state({ kind: "none" });
    let confirmActionEvent: ConfirmActionEvent | undefined = $state();

    onMount(() => {
        const unsubEvents = [
            subscribe("chatWith", chatWith),
            subscribe("replyPrivatelyTo", replyPrivatelyTo),
            subscribe("verifyHumanity", verifyHumanity),
            subscribe("deleteCommunity", onTriggerConfirm),
            subscribe("leaveCommunity", onTriggerConfirm),
            subscribe("makeProposal", showMakeProposalModal),
            subscribe("leaveGroup", onTriggerConfirm),
            subscribe("unarchiveChat", unarchiveChat),
            subscribe("toggleMuteNotifications", toggleMuteNotifications),
            subscribe("successfulImport", successfulImport),
            subscribe("clearSelection", () => pageReplace(routeForScope($chatListScopeStore))),
            subscribe("userSuspensionChanged", () => window.location.reload()),
            subscribe("selectedChatInvalid", selectedChatInvalid),
            subscribe("sendMessageFailed", sendMessageFailed),
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
                if (
                    $anonUserStore &&
                    client.isChatListRoute(route) &&
                    route.scope.kind === "favourite"
                ) {
                    client.updateIdentityState({ kind: "logging_in" });
                    pageRedirect("/chats");
                    return;
                }

                if (client.isHomeRoute(route) && $anonUserStore) {
                    showOnboarding = true;
                    return;
                }

                if (client.setChatListScopeAndRedirect(route)) {
                    return;
                }

                if (client.isShareRoute(route)) {
                    publish("shareMessage", {
                        title: route.title,
                        text: route.text,
                        url: route.url,
                        files: [],
                    });
                    pageReplace(routeForScope(client.getDefaultScope()));
                }
            }
        });
    }

    function closeModal() {
        modal = { kind: "none" };
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
                return deleteCommunity(confirmActionEvent.communityId);
            default:
                return Promise.reject();
        }
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
            } else {
                publish("closeModalStack");
            }
        });

        return Promise.resolve();
    }

    function chatWith(chatId: DirectChatIdentifier) {
        publish("closeModalStack");
        const chat = $chatSummariesListStore.find((c) => {
            return c.kind === "direct_chat" && c.them === chatId;
        });

        page(routeForChatIdentifier(chat ? $chatListScopeStore.kind : "chats", chatId));
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

    function showMakeProposalModal() {
        if (nervousSystem !== undefined && selectedMultiUserChat !== undefined) {
            modal = { kind: "make_proposal", chat: selectedMultiUserChat, nervousSystem };
        }
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

    let showOnboarding = $derived(client.isHomeRoute($routeStore) && $anonUserStore);

    trackedEffect("identity-state", () => {
        if ($identityStateStore.kind === "challenging") {
            modal = { kind: "challenge" };
        }
        if (
            $identityStateStore.kind === "logged_in" &&
            $identityStateStore.postLogin?.kind === "join_group" &&
            $chatsInitialisedStore
        ) {
            // const join = { ...$identityStateStore.postLogin };
            client.clearPostLoginState();
            // tick().then(() => joinGroup(join));
        }
    });

    trackedEffect("route-change", () => {
        routeChange($chatsInitialisedStore, $routeStore);
    });

    $effect(() => {
        if ($chatsInitialisedStore) {
            const faq = $querystringStore.get("faq");
            if (faq !== null) {
                pageReplace(`/faq?q=${faq}`);
            }
            if ($querystringStore.get("hof") !== null) {
                modal = { kind: "hall_of_fame" };
                pageReplace(removeQueryStringParam("hof"));
            }
        }
    });

    let mainClass = $derived.by(() => {
        const cls = [];
        if ($offlineStore) {
            cls.push("offline");
        }
        return cls.join(" ");
    });
</script>

{#if showProfileCard !== undefined}
    {@const profileUser = $allUsersStore.get(showProfileCard.userId)}
    {#if profileUser?.kind !== "bot"}
        <ViewUserProfile
            userId={showProfileCard.userId}
            inGlobalContext={showProfileCard.inGlobalContext}
            chatButton={showProfileCard.chatButton}
            onOpenDirectChat={chatWithFromProfileCard}
            onClose={() => (showProfileCard = undefined)} />
    {/if}
{/if}

<Container height={"fill"} width={"fill"} supplementalClass={mainClass} tag="main">
    {#if showOnboarding}
        <OnboardModal />
    {:else}
        <LeftPanel />
        <MiddlePanel />
    {/if}
</Container>

{#if $anonUserStore && !showOnboarding && $routeStore.kind !== "communities_route"}
    <AnonFooter />
{/if}

{#if $offlineStore}
    <OfflineFooter />
{/if}

{#if confirmActionEvent !== undefined}
    <AreYouSure
        doubleCheck={confirmActionEvent.kind === "delete_community"
            ? confirmActionEvent.doubleCheck
            : undefined}
        message={confirmMessage}
        action={onConfirmAction} />
{/if}

<Toast />

{#if modal.kind !== "none"}
    {#if modal.kind === "not_found"}
        <NotFound onClose={closeNoAccess} />
    {:else if modal.kind === "suspended"}
        <SuspendedModal onClose={closeModal} />
    {:else if modal.kind === "suspending"}
        <SuspendModal userId={modal.userId} onClose={closeModal} />
    {:else if modal.kind === "verify_humanity"}
        <VerifyHumanity onClose={closeModal} onSuccess={closeModal} />
    {:else if modal.kind === "no_access"}
        <NoAccess onClose={closeNoAccess} />
    {:else if modal.kind === "challenge"}
        <ChallengeModal on:close={closeModal} />
    {:else}
        <Overlay dismissible={modal.kind !== "make_proposal"} onClose={closeModal}>
            {#if modal.kind === "make_proposal"}
                <MakeProposalModal
                    selectedMultiUserChat={modal.chat}
                    nervousSystem={modal.nervousSystem}
                    onClose={closeModal} />
            {/if}
        </Overlay>
    {/if}
{/if}

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

{#if $chitPopup && !$disableChit}
    <ChitEarned />
{/if}

<style lang="scss">
    :global(.edited-msg) {
        @include font(light, normal, fs-70);
    }

    :global(main.offline) {
        margin-bottom: toRem(50);
    }
</style>

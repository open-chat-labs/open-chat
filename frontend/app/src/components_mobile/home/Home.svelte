<script lang="ts">
    import { muteChat } from "@src/logic/chats/muteChat";
    import { trackedEffect } from "@src/utils/effects.svelte";
    import type { CashtagClickedEvent } from "@webcomponents/cashTag";
    import type { ProfileLinkClickedEvent } from "@webcomponents/profileLink";
    import { Container, Sheet } from "component-lib";
    import type {
        ChannelIdentifier,
        ChatIdentifier,
        CommunityIdentifier,
        DirectChatIdentifier,
        EnhancedReplyContext,
        LeaveOrDelete,
        LeaveOrDeleteOutcome,
        Level,
        MultiUserChat,
        MultiUserChatIdentifier,
        NervousSystemDetails,
        OpenChat,
        PriceSubject,
        ResourceKey,
        RouteParams,
    } from "@client";
    import { navigate } from "@utils/navigation";
    import {
        allUsersStore,
        anonUserStore,
        ANON_USER_ID,
        CURRENT_TERMS_VERSION,
        currentUserStore,
        allChatsStore,
        chatListScopeStore,
        chatsInitialisedStore,
        identityStateStore,
        localUpdates,
        offlineStore,
        pinNumberResolverStore,
        postLoginJoin,
        publish,
        querystringStore,
        routeForChatIdentifier,
        routeForScope,
        routeStore,
        captureRulesAcceptanceStore as rulesAcceptanceStore,
        selectedChatSummaryStore,
        subscribe,
        suspendedUserStore,
    } from "@client";
    import { getContext, onMount, tick, untrack } from "svelte";
    import { openCommunityCreation } from "./communities/createOrUpdate/createCommunity";
    import { communityPreviewState, groupPreviewState } from "@src/utils/preview.svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import { chitPopup, disableChit } from "../../stores/settings";
    import { toastStore } from "../../stores/toast";
    import { dismissedRoute, subscribeAppEvents } from "@src/logic/appEvents/appEvents";
    import {
        profileCard,
        profileCardChat,
        profileCardShows,
        type ProfileCard,
    } from "@src/logic/profile/profileCard";
    import { copyPageUrl, removeQueryStringParam } from "../../utils/urls";
    import AreYouSure from "../AreYouSure.svelte";
    import LegacyInstallBanner from "../LegacyInstallBanner.svelte";
    import NativeUpgradeBanner from "../NativeUpgradeBanner.svelte";
    import NotFound from "../NotFound.svelte";
    import OfflineFooter from "../OfflineFooter.svelte";
    import OnboardModal from "../onboard/OnboardModal.svelte";
    import SuspendedModal from "../SuspendedModal.svelte";
    import TermsUpdatedModal from "../TermsUpdatedModal.svelte";
    import Toast from "../Toast.svelte";
    import AcceptRulesModal from "./AcceptRulesModal.svelte";
    import AnonFooter from "./AnonFooter.svelte";
    import ChitEarned from "./ChitEarned.svelte";
    import LeftPanel from "./LeftPanel.svelte";
    import MiddlePanel from "./MiddlePanel.svelte";
    import NoAccess from "./NoAccess.svelte";
    import PinNumberModal from "./PinNumberModal.svelte";
    import VerifyHumanity from "./profile/VerifyHumanity.svelte";
    import ViewUserProfile from "./profile/ViewUserProfileModal.svelte";
    import TokenPriceCard from "./TokenPriceCard.svelte";
    import MakeProposalModal from "./proposal/MakeProposalModal.svelte";
    import SlidingModals from "./SlidingModals.svelte";
    import SuspendModal from "./SuspendModal.svelte";
    import SetPinNumberModal from "./wallet/SetPinNumberModal.svelte";

    const client = getContext<OpenChat>("client");

    let showProfileCard = $state<ProfileCard>();
    let showTokenCard = $state<{ subject: PriceSubject }>();

    type ConfirmActionEvent =
        | ConfirmLeaveEvent
        | ConfirmLeaveCommunityEvent
        | ConfirmDeleteDirectChatEvent
        | ConfirmDeleteEvent
        | ConfirmDeleteCommunityEvent;

    type ConfirmLeaveCommunityEvent = {
        kind: "leave_community";
        communityId: CommunityIdentifier;
    };

    type ConfirmDeleteDirectChatEvent = {
        kind: "delete_direct_chat";
        chatId: DirectChatIdentifier;
        blockUser: boolean;
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
        | { kind: "suspended" }
        | { kind: "suspending"; userId: string }
        | { kind: "no_access" }
        | { kind: "hall_of_fame" }
        | { kind: "make_proposal"; chat: MultiUserChat; nervousSystem: NervousSystemDetails }
        | { kind: "not_found" }
        | { kind: "restricted_content" };

    let modal: ModalType = $state({ kind: "none" });
    let confirmActionEvent: ConfirmActionEvent | undefined = $state();

    onMount(() => {
        const unsubEvents = [
            subscribeAppEvents(client, (outcome) => {
                if (outcome.kind === "show") {
                    modal = outcome.dialog;
                } else {
                    if (outcome.closeDialogs) publish("closeModalStack");
                    navigate(outcome.path);
                }
            }),
            subscribe("replyPrivatelyTo", replyPrivatelyTo),
            subscribe("verifyHumanity", verifyHumanity),
            subscribe("deleteDirectChat", onTriggerConfirm),
            subscribe("deleteCommunity", onTriggerConfirm),
            subscribe("leaveCommunity", onTriggerConfirm),
            subscribe("makeProposal", showMakeProposalModal),
            subscribe("leaveGroup", onTriggerConfirm),
            subscribe("deleteGroup", onTriggerConfirm),
            subscribe("unarchiveChatFailed", unarchiveChatFailed),
            subscribe("joinGroup", (group) => groupPreviewState.joinGroup(client, group)),
            subscribe("toggleMuteNotifications", toggleMuteNotifications),
            subscribe("successfulImport", successfulImport),
            subscribe("clearSelection", () => navigate(routeForScope($chatListScopeStore))),
            subscribe("sendMessageFailed", sendMessageFailed),
            subscribe("copyUrl", () => copyPageUrl(client)),
        ];
        client.initialiseNotifications();
        document.body.addEventListener("profile-clicked", profileClicked);
        document.body.addEventListener("cashtag-clicked", cashtagClicked);

        if ($suspendedUserStore) {
            modal = { kind: "suspended" };
        }

        return () => {
            unsubEvents.forEach((u) => u());
            document.body.removeEventListener("profile-clicked", profileClicked);
            document.body.removeEventListener("cashtag-clicked", cashtagClicked);
        };
    });

    function profileClicked(event: Event) {
        profileLinkClicked(event as CustomEvent<ProfileLinkClickedEvent>);
    }

    function cashtagClicked(event: Event) {
        showTokenCard = { subject: (event as CustomEvent<CashtagClickedEvent>).detail };
    }

    function sendMessageFailed(alert: boolean) {
        if (alert) {
            toastStore.showFailureToast(i18nKey("errorSendingMessage"));
        }
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
                    navigate("/chats");
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
                    navigate(routeForScope(client.getDefaultScope()));
                }
            }
        });
    }

    function closeModal() {
        modal = { kind: "none" };
    }

    function closeNoAccess() {
        closeModal();
        navigate(dismissedRoute(client));
    }

    function unarchiveChatFailed() {
        toastStore.showFailureToast(i18nKey("unarchiveChatFailed"));
    }

    function getConfirmMessage(
        confirmActionEvent: ConfirmActionEvent | undefined,
    ): ResourceKey | undefined {
        if (confirmActionEvent === undefined) return undefined;

        switch (confirmActionEvent.kind) {
            case "leave":
                return i18nKey("confirmLeaveGroup", undefined, confirmActionEvent.level, true);
            case "delete_direct_chat":
                return i18nKey("confirmDeleteDirectChat", undefined, undefined, true);
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
                // not awaited, as the list already shows it gone
                leaveOrDelete({ kind: "leave", chatId: confirmActionEvent.chatId }).then(
                    (outcome) => {
                        if (outcome.kind === "success") publish("closeModalStack");
                    },
                );
                return Promise.resolve();
            case "delete_direct_chat":
                return leaveOrDelete({
                    kind: "delete_direct_chat",
                    chatId: confirmActionEvent.chatId,
                    blockUser: confirmActionEvent.blockUser,
                }).then(() => undefined);
            case "leave_community":
                leaveOrDelete({ kind: "leave_community", id: confirmActionEvent.communityId });
                return Promise.resolve();
            case "delete_community":
                leaveOrDelete({ kind: "delete_community", id: confirmActionEvent.communityId });
                return Promise.resolve();
            case "delete":
                return leaveOrDelete({ kind: "delete", chatId: confirmActionEvent.chatId }).then(
                    () => confirmActionEvent.after?.(),
                );
            default:
                return Promise.reject();
        }
    }

    async function leaveOrDelete(action: LeaveOrDelete): Promise<LeaveOrDeleteOutcome> {
        const outcome = await client.leaveOrDelete(action);
        toastStore.showOutcome(outcome);
        return outcome;
    }

    function replyPrivatelyTo(context: EnhancedReplyContext) {
        if (context.sender === undefined) return;

        const chatId: DirectChatIdentifier = { kind: "direct_chat", userId: context.sender.userId };
        localUpdates.draftMessages.setTextContent({ chatId }, "");
        localUpdates.draftMessages.setReplyingTo({ chatId }, context);
        // Look the chat up across all scopes, since the message being replied to is usually in a
        // group or channel, in which case the current scope won't include any direct chats
        if ($allChatsStore.has(chatId)) {
            navigate(routeForChatIdentifier("chats", chatId));
        } else {
            createDirectChat(chatId);
        }
    }

    function showMakeProposalModal() {
        if (nervousSystem !== undefined && selectedMultiUserChat !== undefined) {
            modal = { kind: "make_proposal", chat: selectedMultiUserChat, nervousSystem };
        }
    }

    async function toggleMuteNotifications(detail: {
        chatId: ChatIdentifier;
        mute: boolean | undefined;
        muteAtEveryone: boolean | undefined;
    }) {
        const failed = await muteChat(client, detail.chatId, detail.mute, detail.muteAtEveryone, $_);
        if (failed !== undefined) toastStore.showFailureToast(failed);
    }


    async function createDirectChat(chatId: DirectChatIdentifier): Promise<boolean> {
        const directChatId = await client.createDirectChat(chatId);
        if (directChatId === undefined) {
            modal = { kind: "not_found" };
            return false;
        }

        navigate(routeForChatIdentifier("chats", directChatId));
        return true;
    }

    function successfulImport(id: ChannelIdentifier) {
        navigate(`/community/${id.communityId}`);
    }

    function profileLinkClicked(ev: CustomEvent<ProfileLinkClickedEvent>) {
        showProfileCard = profileCard(ev.detail);
    }

    function chatWithFromProfileCard() {
        if (showProfileCard === undefined) return;
        publish("chatWith", profileCardChat(showProfileCard));
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
    // let nervousSystem = $derived(client.tryGetNervousSystem("rrkah-fqaaa-aaaaa-aaaaq-cai"));

    let showOnboarding = $derived(client.isHomeRoute($routeStore) && $anonUserStore);

    trackedEffect("identity-state", () => {
        const join = postLoginJoin($identityStateStore, $chatsInitialisedStore);
        if (join !== undefined) {
            client.clearPostLoginState();
            tick().then(() =>
                join.kind === "join_group"
                    ? groupPreviewState.joinGroup(client, join.group)
                    : communityPreviewState.joinCommunity(client, join.community),
            );
        } else if (
            $identityStateStore.kind === "logged_in" &&
            $identityStateStore.postLogin?.kind === "create_community"
        ) {
            client.clearPostLoginState();
            tick().then(() => openCommunityCreation(client));
        }
    });

    trackedEffect("route-change", () => {
        routeChange($chatsInitialisedStore, $routeStore);
    });

    $effect(() => {
        if ($chatsInitialisedStore) {
            const faq = $querystringStore.get("faq");
            if (faq !== null) {
                navigate(`/faq?q=${faq}`);
            }
            if ($querystringStore.get("hof") !== null) {
                modal = { kind: "hall_of_fame" };
                navigate(removeQueryStringParam("hof"));
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
    {#if profileCardShows(profileUser)}
        <ViewUserProfile
            userId={showProfileCard.userId}
            inGlobalContext={showProfileCard.inGlobalContext}
            chatButton={showProfileCard.chatButton}
            onOpenDirectChat={chatWithFromProfileCard}
            onClose={() => (showProfileCard = undefined)}
        />
    {/if}
{/if}

{#if showTokenCard !== undefined}
    <!-- another cashtag is another card -->
    {#key showTokenCard}
        <TokenPriceCard
            subject={showTokenCard.subject}
            onClose={() => (showTokenCard = undefined)} />
    {/key}
{/if}

<SlidingModals />

<Container height={"fill"} width={"fill"} supplementalClass={mainClass} tag="main">
    {#if showOnboarding}
        <OnboardModal />
    {:else}
        {#if client.isNativeApp()}
            <NativeUpgradeBanner />
            <LegacyInstallBanner />
        {/if}
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
        doubleCheck={confirmActionEvent.kind === "delete" ||
        confirmActionEvent.kind === "delete_community"
            ? confirmActionEvent.doubleCheck
            : undefined}
        message={confirmMessage}
        action={onConfirmAction}
    />
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
    {:else if modal.kind === "restricted_content"}
        <NoAccess
            onClose={closeNoAccess}
            titleKey={"appStore.notAvailableTitle"}
            textKey={"appStore.notAvailable"}
        />
    {:else if modal.kind === "make_proposal"}
        <MakeProposalModal
            selectedMultiUserChat={modal.chat}
            nervousSystem={modal.nervousSystem}
            onClose={closeModal}
        />
    {/if}
{/if}

<!-- Not shown while the suspension notice is up (parity with desktop): the notice explains
     the account state first; the gate re-asserts once it is dismissed -->
{#if modal.kind !== "suspended" && $currentUserStore.userId !== ANON_USER_ID && ($currentUserStore.acceptedTermsVersion ?? 0) < ($currentUserStore.currentTermsVersion ?? CURRENT_TERMS_VERSION)}
    <TermsUpdatedModal />
{/if}

{#if $rulesAcceptanceStore !== undefined}
    <AcceptRulesModal />
{:else if forgotPin}
    <Sheet onDismiss={() => (forgotPin = false)}>
        <SetPinNumberModal
            onPinSet={onPinNumberComplete}
            onClose={() => (forgotPin = false)}
            type={{ kind: "forgot", while: { kind: "enter" } }}
        />
    </Sheet>
{:else if $pinNumberResolverStore !== undefined}
    <PinNumberModal
        onClose={onPinNumberClose}
        onComplete={onPinNumberComplete}
        onForgot={onForgotPin}
    />
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

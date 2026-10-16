<script lang="ts">
    import "@styles/global.scss";

    import "@i18n/i18n";
    import { localeLoadFailed, reviewingTranslations } from "@i18n/i18n";
    import Reload from "@shared_components/Reload.svelte";
    import { trackedEffect } from "@src/utils/effects.svelte";
    import { detectNeedsSafeInset, setupKeyboardTracking } from "@src/utils/safe_area";
    import { snowing } from "@stores/snow";
    import { incomingVideoCall } from "@stores/video";
    import { currentTheme } from "@theme/themes";
    import "@utils/markdown";
    import {
        expectNewFcmToken,
        expectNotificationTap,
        expectPushNotifications,
    } from "@utils/native/notification_channels";
    import {
        isLandingPageRoute,
        isScrollingRoute,
        redirectLandingPageLinksIfNecessary,
    } from "@utils/urls";
    import { portalState } from "component-lib";
    import {
        type ChatIdentifier,
        type DexId,
        type DiamondMembershipFees,
        OpenChat,
        PremiumItem,
        type UpdateMarketMakerConfigArgs,
        type VideoCallType,
        anonUserStore,
        botState,
        chatListScopeStore,
        fontSize,
        identityStateStore,
        notFoundStore,
        routeForChatIdentifier,
        routeForScope,
        routeStore,
        subscribe,
    } from "@client";
    import { navigate } from "@utils/navigation";
    import { warmRichTextEditor } from "@shared_components/richTextEditorLoader";
    import {
        boundaryErrorHandler,
        followDocumentDirection,
        initialiseAppLogger,
        subscribeToSessionEvents,
    } from "@utils/appRoot.svelte";
    import { createOpenChatClient } from "@utils/openchatClient";
    import { handleUnhandledError } from "@utils/unhandledError";
    import { onMount, setContext } from "svelte";
    import { overrideItemIdKeyNameBeforeInitialisingDndZones } from "svelte-dnd-action";
    import { _, isLoading, locale } from "svelte-i18n";
    import {
        clearAllNotifications,
        deleteFcmToken,
        getFcmToken,
        svelteReady,
    } from "tauri-plugin-oc-api";
    import Head from "./Head.svelte";
    import Profiler from "./Profiler.svelte";
    import Router from "./Router.svelte";
    import UpgradeBanner from "./UpgradeBanner.svelte";
    import Witch from "@shared_components/Witch.svelte";
    import InstallPrompt from "./home/InstallPrompt.svelte";
    import NotificationsBar from "./home/NotificationsBar.svelte";
    import ActiveCall from "./home/video/ActiveCall.svelte";
    import IncomingCall from "./home/video/IncomingCall.svelte";
    import VideoCallAccessRequests from "./home/video/VideoCallAccessRequests.svelte";

    overrideItemIdKeyNameBeforeInitialisingDndZones("_id");

    const logger = initialiseAppLogger();

    const client: OpenChat = createOpenChatClient($_, logger);
    setContext<OpenChat>("client", client);

    const profileTrace = client.showTrace();
    // I can't (yet) find a way to avoid using "any" here. Will try to improve but need to commit this crime for the time being
    let videoCallElement: ReturnType<typeof ActiveCall> | undefined;
    let landingPageRoute = $derived(isLandingPageRoute($routeStore));
    let homeRoute = $derived($routeStore.kind === "home_route");
    let showLandingPage = $derived(
        landingPageRoute || (homeRoute && $identityStateStore.kind === "anon" && $anonUserStore),
    );
    const isFirefox = navigator.userAgent.indexOf("Firefox") >= 0;
    let burstPath = $derived(
        $currentTheme.mode === "dark" ? "/assets/burst_dark" : "/assets/burst_light",
    );
    let burstUrl = $derived(isFirefox ? `${burstPath}.png` : `${burstPath}.svg`);
    let burstFixed = $derived(isScrollingRoute($routeStore));

    followDocumentDirection();

    trackedEffect("landing-page", () => {
        if (!$notFoundStore && showLandingPage) {
            document.body.classList.add("landing-page");
        } else {
            document.body.classList.remove("landing-page");
        }
    });

    trackedEffect("font-size", () => {
        console.log("Setting font size to: ", $fontSize);
        document.documentElement.style.setProperty("--font-size", `${$fontSize}px`);
    });

    trackedEffect("calculate-height", calculateHeight);

    $effect(() => {
        botState.messageFormatter = $_;
    });

    onMount(() => {
        const unsubs = [
            subscribe("startVideoCall", startVideoCall),
            subscribe("hangup", hangup),
            subscribe("askToSpeak", askToSpeak),
            subscribeToSessionEvents(client, { onLoggedIn: onUserLoggedIn }),
        ];
        window.addEventListener("orientationchange", calculateHeight);
        window.addEventListener("unhandledrejection", unhandledError);
        if (!client.isNativeApp()) {
            window.visualViewport?.addEventListener("resize", calculateHeight);
        }

        redirectLandingPageLinksIfNecessary();

        // @ts-expect-error debug hooks attached to window for the console
        window.platformModerator = {
            addHotGroupExclusion,
            deleteFrozenGroup,
            deleteMessage,
            deleteChannelMessage,
            freezeGroup,
            removeHotGroupExclusion,
            setCommunityModerationFlags,
            setGroupModerationFlags,
            unfreezeGroup,
            addMessageFilter,
            removeMessageFilter,
            reportedMessages,
            unsuspendUser,
        };

        // @ts-expect-error debug hooks attached to window for the console
        window.platformOperator = {
            addRemoveSwapProvider,
            setGroupUpgradeConcurrency,
            setCommunityUpgradeConcurrency,
            markLocalGroupIndexFull,
            reinstateMissedDailyClaims,
            setAirdropConfig,
            setDiamondMembershipFees,
            setTokenEnabled,
            stakeNeuronForSubmittingProposals,
            topUpNeuronForSubmittingProposals,
            updateMarketMakerConfig,
            setPremiumItemCost,
            updateBlockedUsernamePatterns,
            pauseEventLoop: () => client.pauseEventLoop(),
            resumeEventLoop: () => client.resumeEventLoop(),
        };


        if (client.isNativeApp()) {
            // Inform the native app that svelte code is ready! SetTimeout
            // delays the fn execution until the call stack is empty, just to
            // make sure anything else non-async that needs to run is done.
            //
            // Once Svelte app is ready, native code can start pushing events.
            setTimeout(svelteReady);
        }

        const unsubKeyboard = setupKeyboardTracking();

        return () => {
            window.removeEventListener("orientationchange", calculateHeight);
            window.removeEventListener("unhandledrejection", unhandledError);
            if (!client.isNativeApp()) {
                window.visualViewport?.removeEventListener("resize", calculateHeight);
            }
            unsubs.forEach((u) => u());
            unsubKeyboard();
        };
    });

    // Guards the one-time native setup (listeners + logout hook) so it runs once
    // per page session. setupNativeApp() itself runs again on every userLoggedIn
    // (account switch), but only the FCM token registration should repeat —
    // re-registering listeners or the logout hook would stack duplicate handlers.
    let nativeSetupDone = false;

    // Sets up push notifications and FCM token management for native apps
    function setupNativeApp() {
        const addFcmToken = (token: string) => {
            client
                .addFcmToken(token)
                .then(() => console.info("FCM token updated successfully"))
                .catch(console.error);
        };

        if (!client.isNativeApp()) {
            return;
        }

        // Ask for the current FCM token and register it unconditionally on every
        // login. Registration is last-login-wins on the backend, so this also
        // reclaims a token still bound to a previous account on this device (a
        // fcm_token_exists pre-check would wrongly skip that).
        getFcmToken().then((token) => {
            if (!token) {
                // TODO do we handle this somehow? Debounce, try again?
                console.error("No FCM token received");
                return;
            }

            addFcmToken(token);
        });

        // Everything below registers session-scoped handlers and must run once.
        if (nativeSetupDone) {
            return;
        }
        nativeSetupDone = true;

        // Listen for incoming push notifications from Firebase; also asks
        // for permission to show notifications if not already granted.
        expectPushNotifications().catch(console.error);

        // Listen for notifications user has tapped on
        expectNotificationTap().catch(console.error);

        // Expect FCM token refreshes
        expectNewFcmToken(addFcmToken);

        // Best-effort push hygiene on sign-out, while the identity is
        // still valid: unbind this device's token from the account,
        // delete the device token (pushes to it then dead-end at FCM,
        // and the next login mints + registers a fresh one), and empty
        // the tray so nothing from this account lingers.
        client.onLogout(async () => {
            const token = await getFcmToken().catch(() => null);
            if (token) {
                await client.removeFcmToken(token).catch(console.error);
            }
            await deleteFcmToken().catch(console.error);
            await clearAllNotifications().catch(console.error);
        });
    }

    if ($identityStateStore.kind === "logged_in") {
        setupNativeApp();
        warmRichTextEditor();
    }

    function onUserLoggedIn() {
        setupNativeApp();
        warmRichTextEditor();
    }

    function addHotGroupExclusion(chatId: string): void {
        client.addHotGroupExclusion({ kind: "group_chat", groupId: chatId }).then((success) => {
            if (success) {
                console.log("Hot group exclusion added", chatId);
            } else {
                console.log("Failed to add hot group exclusion", chatId);
            }
        });
    }

    function deleteFrozenGroup(chatId: string): void {
        client.deleteFrozenGroup({ kind: "group_chat", groupId: chatId }).then((success) => {
            if (success) {
                console.log("Group deleted", chatId);
            } else {
                console.log("Failed to delete frozen group", chatId);
            }
        });
    }

    function freezeGroup(chatId: string, reason: string | undefined): void {
        client.freezeGroup({ kind: "group_chat", groupId: chatId }, reason).then((success) => {
            if (success) {
                console.log("Group frozen", chatId);
            } else {
                console.log("Failed to freeze group", chatId);
            }
        });
    }

    function removeHotGroupExclusion(chatId: string): void {
        client.removeHotGroupExclusion({ kind: "group_chat", groupId: chatId }).then((success) => {
            if (success) {
                console.log("Hot group exclusion removed", chatId);
            } else {
                console.log("Failed to remove hot group exclusion", chatId);
            }
        });
    }

    function setCommunityModerationFlags(communityId: string, flags: number): void {
        client.setCommunityModerationFlags(communityId, flags).then((success) => {
            if (success) {
                console.log("Community moderation flags updated", communityId);
            } else {
                console.log("Failed to set community moderation flags", communityId);
            }
        });
    }

    function setGroupModerationFlags(chatId: string, flags: number): void {
        client.setGroupModerationFlags(chatId, flags).then((success) => {
            if (success) {
                console.log("Group moderation flags updated", chatId);
            } else {
                console.log("Failed to set group moderation flags", chatId);
            }
        });
    }

    function unfreezeGroup(chatId: string): void {
        client.unfreezeGroup({ kind: "group_chat", groupId: chatId }).then((success) => {
            if (success) {
                console.log("Group unfrozen", chatId);
            } else {
                console.log("Failed to unfreeze group", chatId);
            }
        });
    }

    function addMessageFilter(regex: string): void {
        client.addMessageFilter(regex);
    }

    function removeMessageFilter(id: bigint): void {
        client.removeMessageFilter(id);
    }

    function reportedMessages(userId?: string): void {
        client.reportedMessages(userId).then((json) => console.log(JSON.parse(json)));
    }

    function unsuspendUser(userId: string): void {
        client.unsuspendUser(userId).then((success) => {
            console.log(success ? "User unsuspended" : "Failed to unsuspend user", userId);
        });
    }

    function deleteChannelMessage(
        communityId: string,
        channelId: number,
        messageId: bigint,
        threadRootMessageIndex?: number | undefined,
    ): void {
        client
            .deleteMessage(
                { kind: "channel", communityId, channelId },
                threadRootMessageIndex,
                messageId,
                true,
            )
            .then((success) => {
                if (success) {
                    console.log(
                        "Message deleted",
                        communityId,
                        channelId,
                        messageId,
                        threadRootMessageIndex,
                    );
                } else {
                    console.log(
                        "Failed to delete message",
                        communityId,
                        channelId,
                        messageId,
                        threadRootMessageIndex,
                    );
                }
            });
    }

    function deleteMessage(
        chatId: string,
        messageId: bigint,
        threadRootMessageIndex?: number | undefined,
    ): void {
        client
            .deleteMessage(
                { kind: "group_chat", groupId: chatId },
                threadRootMessageIndex,
                messageId,
                true,
            )
            .then((success) => {
                if (success) {
                    console.log("Message deleted", chatId, messageId, threadRootMessageIndex);
                } else {
                    console.log(
                        "Failed to delete message",
                        chatId,
                        messageId,
                        threadRootMessageIndex,
                    );
                }
            });
    }

    function addRemoveSwapProvider(swapProvider: DexId, add: boolean): void {
        client.addRemoveSwapProvider(swapProvider, add).then((success) => {
            if (success) {
                const action = add ? "Added" : "Removed";
                console.log(`${action} swap provider`, swapProvider);
            } else {
                console.error("Failed to add/remove swap provider");
            }
        });
    }

    function setGroupUpgradeConcurrency(value: number): void {
        client.setGroupUpgradeConcurrency(value).then((success) => {
            if (success) {
                console.log("Group upgrade concurrency set", value);
            } else {
                console.error("Failed to set group upgrade concurrency", value);
            }
        });
    }

    function setCommunityUpgradeConcurrency(value: number): void {
        client.setCommunityUpgradeConcurrency(value).then((success) => {
            if (success) {
                console.log("Community upgrade concurrency set", value);
            } else {
                console.error("Failed to set community upgrade concurrency", value);
            }
        });
    }

    function markLocalGroupIndexFull(canisterId: string, full: boolean): void {
        client.markLocalGroupIndexFull(canisterId, full).then((success) => {
            if (success) {
                console.log("LocalGroupIndex marked as full", full);
            } else {
                console.error("Failed to mark LocalGroupIndex as full", full);
            }
        });
    }

    function reinstateMissedDailyClaims(userId: string, days: number[]): void {
        client.reinstateMissedDailyClaims(userId, days).then((success) => {
            if (success) {
                console.log("Reinstated missed daily claims");
            } else {
                console.error("Failed to reinstate missed daily claims");
            }
        });
    }

    function setAirdropConfig(
        channelId: number,
        channelName: string,
        communityId?: string,
        communityName?: string,
    ): void {
        client
            .setAirdropConfig(channelId, channelName, communityId, communityName)
            .then((success) => {
                if (success) {
                    console.log("Airdrop config set");
                } else {
                    console.error("Failed to set airdrop config");
                }
            });
    }

    function setDiamondMembershipFees(fees: DiamondMembershipFees[]): void {
        client.setDiamondMembershipFees(fees).then((success) => {
            if (success) {
                console.log("Diamond membership fees set", fees);
            } else {
                console.error("Failed to set diamond membership fees", fees);
            }
        });
    }

    function setTokenEnabled(ledger: string, enabled: boolean): void {
        client.setTokenEnabled(ledger, enabled).then((success) => {
            const status = enabled ? "enabled" : "disabled";
            if (success) {
                console.log(`Token ${status}`);
            } else {
                console.error(`Failed to set token ${status}`);
            }
        });
    }

    function stakeNeuronForSubmittingProposals(governanceCanisterId: string, stake: bigint): void {
        client.stakeNeuronForSubmittingProposals(governanceCanisterId, stake).then((success) => {
            if (success) {
                console.log("Neuron staked successfully");
            } else {
                console.error("Failed to stake neuron");
            }
        });
    }

    function topUpNeuronForSubmittingProposals(governanceCanisterId: string, amount: bigint): void {
        client.topUpNeuronForSubmittingProposals(governanceCanisterId, amount).then((success) => {
            if (success) {
                console.log("Neuron topped up successfully");
            } else {
                console.error("Failed to top up neuron");
            }
        });
    }

    function updateMarketMakerConfig(config: UpdateMarketMakerConfigArgs): void {
        client.updateMarketMakerConfig(config).then((resp) => {
            if (resp === "success") {
                console.log("Market maker config updated");
            } else {
                console.error("Failed to update market maker config", resp);
            }
        });
    }

    function setPremiumItemCost(item: PremiumItem, chitCost: number): void {
        client.setPremiumItemCost(item, chitCost);
    }

    function updateBlockedUsernamePatterns(pattern: string, add: boolean) {
        client.updateBlockedUsernamePatterns(pattern, add);
    }

    function calculateHeight() {
        // fix the issue with 100vh layouts in various mobile browsers.
        // In PWA (home-screen) mode on iOS, window.innerHeight does NOT shrink
        // when the virtual keyboard appears, but visualViewport.height does.
        // The native Tauri app has its own keyboard handling via expectWindowInsetChange,
        // so we only use visualViewport.height for non-native builds.
        const viewportHeight =
            !client.isNativeApp() && window.visualViewport
                ? window.visualViewport.height
                : window.innerHeight;
        document.documentElement.style.setProperty("--vh", `${viewportHeight * 0.01}px`);
    }

    function unhandledError(ev: Event) {
        handleUnhandledError(ev, () => client.logout());
    }

    const boundaryError = boundaryErrorHandler(logger);

    function resize() {
        portalState.close();
        calculateHeight();
    }

    function startVideoCall(payload: {
        chatId: ChatIdentifier;
        callType: VideoCallType;
        join: boolean;
    }) {
        videoCallElement?.startOrJoinVideoCall(payload.chatId, payload.callType, payload.join);
    }

    function askToSpeak() {
        videoCallElement?.askToSpeak();
    }

    function hangup() {
        videoCallElement?.hangup();
    }

    function joinVideoCall(chatId: ChatIdentifier, callType: VideoCallType) {
        incomingVideoCall.set(undefined);
        navigate(routeForChatIdentifier("none", chatId));
        videoCallElement?.startOrJoinVideoCall(chatId, callType, true);
    }

    if (client.isNativeAndroid()) {
        document.body.classList.add("native-android");
    } else if (client.isNativeIos()) {
        document.body.classList.add("native-ios");
    }
    detectNeedsSafeInset();
</script>

<svelte:boundary onerror={boundaryError}>
    {#if $currentTheme.burst}
        <div
            class:fixed={burstFixed}
            class="burst-wrapper"
            style={`background-image: url(${burstUrl})`}>
        </div>
    {/if}

    <Head />

    <ActiveCall
        {showLandingPage}
        onClearSelection={() => navigate(routeForScope($chatListScopeStore))}
        bind:this={videoCallElement} />

    <VideoCallAccessRequests />

    <IncomingCall onJoinVideoCall={joinVideoCall} />

    <Witch background />

    {#if !client.isNativeApp()}
        <InstallPrompt />
    {/if}

    <NotificationsBar />

    {#if $identityStateStore.kind === "anon" || $identityStateStore.kind === "logging_in" || $identityStateStore.kind === "registering" || $identityStateStore.kind === "logged_in" || $identityStateStore.kind === "loading_user"}
        <!-- a failed locale load clears isLoading with no locale set, and translating then throws; if English fails too nothing can be translated (#9636) -->
        {#if $localeLoadFailed}
            <Reload>Couldn't load OpenChat.</Reload>
        {:else if ($locale && !$isLoading) || $reviewingTranslations}
            <Router {showLandingPage} />
        {/if}
    {/if}

    {#if profileTrace}
        <Profiler />
    {/if}

    <UpgradeBanner />

    {#if $snowing}
        {#await import("@shared_components/Snow.svelte") then { default: Snow }}
            <Snow />
        {:catch}
            <!-- snow is cosmetic; ignore a failed chunk load -->
        {/await}
    {/if}

    {#snippet failed(error, reset)}
        <div class="boundary-failed">
            <h2>Something went wrong</h2>
            <p>The app hit an unexpected error.</p>
            <pre>{String(error)}</pre>
            <div class="boundary-buttons">
                <button onclick={reset}>Try again</button>
                <button onclick={() => window.location.reload()}>Reload</button>
            </div>
        </div>
    {/snippet}
</svelte:boundary>

<svelte:window onresize={resize} onerror={unhandledError} onorientationchange={resize} />

<style lang="scss">
    .burst-wrapper {
        overflow: hidden;
        max-width: 100%;
        width: 100%;
        position: absolute;
        height: 100vh;
        min-height: 100%;
        pointer-events: none;
        background-repeat: no-repeat;
        background-size: 1400px;
        background-origin: 50% 50%;
        background-position: right 20% top toRem(150);

        &.fixed {
            position: fixed;
        }

        @include mobile() {
            background-size: 800px;
            background-position: left 0 top toRem(150);
        }
    }

    .boundary-failed {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        height: 100vh;
        padding: 24px;
        text-align: center;
        color: var(--txt);
        background-color: var(--bg);

        pre {
            max-width: 100%;
            max-height: 40vh;
            overflow: auto;
            white-space: pre-wrap;
            word-break: break-word;
            font-size: 12px;
            color: var(--txt-light);
        }
    }

    .boundary-buttons {
        display: flex;
        gap: 12px;

        button {
            padding: 8px 16px;
            cursor: pointer;
        }
    }
</style>

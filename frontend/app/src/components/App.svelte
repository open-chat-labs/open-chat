<script lang="ts">
    import "@styles/global.scss";
    import "spoilerjs/spoiler-span";

    import "@i18n/i18n";
    import { reviewingTranslations } from "@i18n/i18n";
    import { trackedEffect } from "@src/utils/effects.svelte";
    import { detectNeedsSafeInset, setupKeyboardTracking } from "@src/utils/safe_area";
    import { rtlStore } from "@stores/rtl";
    import { snowing } from "@stores/snow";
    import { incomingVideoCall } from "@stores/video";
    import { broadcastLoggedInUser } from "@stores/xframe";
    import { currentTheme } from "@theme/themes";
    import "@utils/markdown";
    import {
        expectNewFcmToken,
        expectNotificationTap,
        expectPushNotifications,
    } from "@utils/native/notification_channels";
    import "@utils/scream";
    import {
        isCanisterUrl,
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
        inititaliseLogger,
        notFoundStore,
        routeForChatIdentifier,
        routeForScope,
        routeStore,
        subscribe,
    } from "openchat-client";
    import page from "page";
    import { onMount, setContext } from "svelte";
    import { overrideItemIdKeyNameBeforeInitialisingDndZones } from "svelte-dnd-action";
    import { _, isLoading } from "svelte-i18n";
    import { getFcmToken, svelteReady } from "tauri-plugin-oc-api";
    import Head from "./Head.svelte";
    import Profiler from "./Profiler.svelte";
    import Router from "./Router.svelte";
    import Snow from "./Snow.svelte";
    import SwitchDomain from "./SwitchDomain.svelte";
    import UpgradeBanner from "./UpgradeBanner.svelte";
    import Witch from "./Witch.svelte";
    import InstallPrompt from "./home/InstallPrompt.svelte";
    import NotificationsBar from "./home/NotificationsBar.svelte";
    import ActiveCall from "./home/video/ActiveCall.svelte";
    import IncomingCall from "./home/video/IncomingCall.svelte";
    import VideoCallAccessRequests from "./home/video/VideoCallAccessRequests.svelte";
    import Upgrading from "./upgrading/Upgrading.svelte";
    import "./web-components/customEmoji";
    import "./web-components/profileLink";

    overrideItemIdKeyNameBeforeInitialisingDndZones("_id");

    const logger = inititaliseLogger(
        import.meta.env.OC_ROLLBAR_ACCESS_TOKEN!,
        import.meta.env.OC_WEBSITE_VERSION!,
        import.meta.env.OC_BUILD_ENV!,
    );

    function createOpenChatClient(): OpenChat {
        const client = new OpenChat({
            appType: import.meta.env.OC_APP_TYPE,
            mobileLayout: import.meta.env.OC_MOBILE_LAYOUT,
            icUrl: import.meta.env.OC_IC_URL,
            webAuthnOrigin: import.meta.env.OC_WEBAUTHN_ORIGIN,
            iiDerivationOrigin: import.meta.env.OC_II_DERIVATION_ORIGIN,
            openStorageIndexCanister: import.meta.env.OC_STORAGE_INDEX_CANISTER!,
            groupIndexCanister: import.meta.env.OC_GROUP_INDEX_CANISTER!,
            notificationsCanister: import.meta.env.OC_NOTIFICATIONS_CANISTER!,
            identityCanister: import.meta.env.OC_IDENTITY_CANISTER!,
            onlineCanister: import.meta.env.OC_ONLINE_CANISTER!,
            userIndexCanister: import.meta.env.OC_USER_INDEX_CANISTER!,
            translationsCanister: import.meta.env.OC_TRANSLATIONS_CANISTER!,
            registryCanister: import.meta.env.OC_REGISTRY_CANISTER!,
            internetIdentityUrl: import.meta.env.OC_INTERNET_IDENTITY_URL!,
            nfidUrl: import.meta.env.OC_NFID_URL!,
            userGeekApiKey: import.meta.env.OC_USERGEEK_APIKEY!,
            videoBridgeUrl: import.meta.env.OC_VIDEO_BRIDGE_URL!,
            meteredApiKey: import.meta.env.OC_METERED_APIKEY!,
            blobUrlPattern: import.meta.env.OC_BLOB_URL_PATTERN!,
            canisterUrlPath: import.meta.env.OC_CANISTER_URL_PATH!,
            proposalBotCanister: import.meta.env.OC_PROPOSALS_BOT_CANISTER!,
            marketMakerCanister: import.meta.env.OC_MARKET_MAKER_CANISTER!,
            signInWithEmailCanister: import.meta.env.OC_SIGN_IN_WITH_EMAIL_CANISTER!,
            signInWithEthereumCanister: import.meta.env.OC_SIGN_IN_WITH_ETHEREUM_CANISTER!,
            signInWithSolanaCanister: import.meta.env.OC_SIGN_IN_WITH_SOLANA_CANISTER!,
            oneSecForwarderCanister: import.meta.env.OC_ONESEC_FORWARDER_CANISTER!,
            oneSecMinterCanister: import.meta.env.OC_ONESEC_MINTER_CANISTER!,
            i18nFormatter: $_,
            logger,
            websiteVersion: import.meta.env.OC_WEBSITE_VERSION!,
            rollbarApiKey: import.meta.env.OC_ROLLBAR_ACCESS_TOKEN!,
            env: import.meta.env.OC_BUILD_ENV!,
            bitcoinMainnetEnabled: import.meta.env.OC_BITCOIN_MAINNET_ENABLED! === "true",
            vapidPublicKey: import.meta.env.OC_VAPID_PUBLIC_KEY!,
            accountLinkingCodesEnabled:
                import.meta.env.OC_ACCOUNT_LINKING_CODES_ENABLED! === "true",
        });

        return client;
    }

    let client: OpenChat = createOpenChatClient();
    setContext<OpenChat>("client", client);

    let profileTrace = client.showTrace();
    // I can't (yet) find a way to avoid using "any" here. Will try to improve but need to commit this crime for the time being
    let videoCallElement: any;
    let landingPageRoute = $derived(isLandingPageRoute($routeStore));
    let homeRoute = $derived($routeStore.kind === "home_route");
    let showLandingPage = $derived(
        landingPageRoute || (homeRoute && $identityStateStore.kind === "anon" && $anonUserStore),
    );
    let isFirefox = navigator.userAgent.indexOf("Firefox") >= 0;
    let burstPath = $derived(
        $currentTheme.mode === "dark" ? "/assets/burst_dark" : "/assets/burst_light",
    );
    let burstUrl = $derived(isFirefox ? `${burstPath}.png` : `${burstPath}.svg`);
    let burstFixed = $derived(isScrollingRoute($routeStore));

    let upgrading = $derived(
        $identityStateStore.kind === "upgrading_user" ||
            $identityStateStore.kind === "upgrade_user",
    );

    trackedEffect("rtl", () => {
        // subscribe to the rtl store so that we can set the overall page direction at the right time
        document.dir = $rtlStore ? "rtl" : "ltr";
    });

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

    onMount(() => {
        const unsubs = [
            subscribe("startVideoCall", startVideoCall),
            subscribe("hangup", hangup),
            subscribe("askToSpeak", askToSpeak),
            subscribe("userLoggedIn", onUserLoggedIn),
        ];
        window.addEventListener("orientationchange", calculateHeight);
        window.addEventListener("unhandledrejection", unhandledError);

        redirectLandingPageLinksIfNecessary();

        //@ts-ignore
        window.platformModerator = {
            addHotGroupExclusion,
            deleteFrozenGroup,
            deleteMessage,
            deleteChannelMessage,
            freezeGroup,
            removeHotGroupExclusion,
            setCommunityModerationFlags,
            unfreezeGroup,
            addMessageFilter,
            removeMessageFilter,
            reportedMessages,
        };

        //@ts-ignore
        window.platformOperator = {
            addRemoveSwapProvider,
            setGroupUpgradeConcurrency,
            setCommunityUpgradeConcurrency,
            setUserUpgradeConcurrency,
            markLocalGroupIndexFull,
            reinstateMissedDailyClaims,
            setAirdropConfig,
            setDiamondMembershipFees,
            setTokenEnabled,
            stakeNeuronForSubmittingProposals,
            topUpNeuronForSubmittingProposals,
            updateMarketMakerConfig,
            withdrawFromIcpSwap,
            setPremiumItemCost,
            pauseEventLoop: () => client.pauseEventLoop(),
            resumeEventLoop: () => client.resumeEventLoop(),
        };

        const unsub = _.subscribe((formatter) => {
            botState.messageFormatter = formatter;
        });

        if (client.isNativeAndroid()) {
            // Inform the native android app that svelte code is ready! SetTimeout
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
            unsubs.forEach((u) => u());
            unsub();
            unsubKeyboard();
        };
    });

    // Sets up push notifications and FCM token management for native apps
    function setupNativeApp() {
        const addFcmToken = (token: string) => {
            client
                .addFcmToken(token)
                .then(() => console.info("FCM token updated successfully"))
                .catch(console.error);
        };

        if (client.isNativeApp()) {
            // Listen for incoming push notifications from Firebase; also asks
            // for permission to show notifications if not already granted.
            expectPushNotifications().catch(console.error);

            // Listen for notifications user has tapped on
            expectNotificationTap().catch(console.error);

            // Expect FCM token refreshes
            expectNewFcmToken(addFcmToken);

            // Ask for the current FCM token
            getFcmToken().then((token) => {
                if (!token) {
                    // TODO do we handle this somehow? Debounce, try again?
                    console.error("No FCM token received");
                    return;
                }

                client.checkFcmTokenExists(token).then((exists) => {
                    if (!exists) {
                        console.log("Adding FCM token for the first time!");
                        addFcmToken(token);
                    } else {
                        console.log("FCM token already registered");
                    }
                });
            });
        }
    }

    if ($identityStateStore.kind === "logged_in") {
        setupNativeApp();
    }

    function onUserLoggedIn(userId: string) {
        setupNativeApp();
        broadcastLoggedInUser(userId);
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
        console.log(client.reportedMessages(userId));
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

    function setUserUpgradeConcurrency(value: number): void {
        client.setUserUpgradeConcurrency(value).then((success) => {
            if (success) {
                console.log("User upgrade concurrency set", value);
            } else {
                console.error("Failed to set user upgrade concurrency", value);
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

    function withdrawFromIcpSwap(
        userId: string,
        swapId: bigint,
        inputToken: boolean,
        amount: bigint | undefined,
        fee: bigint | undefined,
    ): void {
        client.withdrawFromIcpSwap(userId, swapId, inputToken, amount, fee);
    }

    function setPremiumItemCost(item: PremiumItem, chitCost: number): void {
        client.setPremiumItemCost(item, chitCost);
    }

    function calculateHeight() {
        // fix the issue with 100vh layouts in various mobile browsers
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty("--vh", `${vh}px`);
    }

    function unhandledError(ev: Event) {
        if (
            ev instanceof ErrorEvent &&
            (ev.message.includes("ResizeObserver loop completed with undelivered notifications") ||
                ev.message.includes("ResizeObserver loop limit exceeded"))
        ) {
            return;
        }

        logger?.error("Unhandled error: ", ev);
        if (
            ev instanceof PromiseRejectionEvent &&
            (ev.reason?.name === "SessionExpiryError" ||
                ev.reason?.name === "InvalidDelegationError")
        ) {
            client.logout();
            ev.preventDefault();
        }
    }

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
        page(routeForChatIdentifier("none", chatId));
        videoCallElement?.startOrJoinVideoCall(chatId, callType, true);
    }

    if (client.isNativeAndroid()) {
        document.body.classList.add("native-android");
    }
    detectNeedsSafeInset();
</script>

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
    onClearSelection={() => page(routeForScope($chatListScopeStore))}
    bind:this={videoCallElement} />

<VideoCallAccessRequests />

<IncomingCall onJoinVideoCall={joinVideoCall} />

<Witch background />

{#if !client.isNativeApp()}
    <InstallPrompt />
{/if}

<NotificationsBar />

{#if isCanisterUrl}
    <SwitchDomain />
{:else if upgrading}
    <Upgrading />
{:else if $identityStateStore.kind === "anon" || $identityStateStore.kind === "logging_in" || $identityStateStore.kind === "registering" || $identityStateStore.kind === "logged_in" || $identityStateStore.kind === "loading_user" || $identityStateStore.kind === "challenging"}
    {#if !$isLoading || $reviewingTranslations}
        <Router {showLandingPage} />
    {/if}
{/if}

{#if profileTrace}
    <Profiler />
{/if}

<UpgradeBanner />

{#if $snowing}
    <Snow />
{/if}

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
</style>

<script lang="ts">
    import "@styles/global.scss";

    import "@i18n/i18n";
    import { trackedEffect } from "@src/utils/effects.svelte";
    import { detectNeedsSafeInset, setupKeyboardTracking } from "@src/utils/safe_area";
    import { rtlStore } from "@stores/rtl";
    import { snowing } from "@stores/snow";
    import { incomingVideoCall } from "@stores/video";
    import { broadcastLoggedInUser } from "@stores/xframe";
    import "@utils/markdown";
    import {
        expectNewFcmToken,
        expectNotificationTap,
        expectPushNotifications,
    } from "@utils/native/notification_channels";
    import "@utils/scream";
    import { portalState } from "component-lib";
    import {
        type ChatIdentifier,
        OpenChat,
        type VideoCallType,
        botState,
        chatListScopeStore,
        fontSize,
        identityStateStore,
        inititaliseLogger,
        routeForChatIdentifier,
        routeForScope,
        subscribe,
    } from "openchat-client";
    import page from "page";
    import { onMount, setContext } from "svelte";
    import { overrideItemIdKeyNameBeforeInitialisingDndZones } from "svelte-dnd-action";
    import { _, isLoading } from "svelte-i18n";
    import { getFcmToken, svelteReady } from "tauri-plugin-oc-api";
    import Head from "./Head.svelte";
    import Router from "./Router.svelte";
    import Snow from "./Snow.svelte";
    import UpgradeBanner from "./UpgradeBanner.svelte";
    import NotificationsBar from "./home/NotificationsBar.svelte";
    import ActiveCall from "./home/video/ActiveCall.svelte";
    import IncomingCall from "./home/video/IncomingCall.svelte";
    import VideoCallAccessRequests from "./home/video/VideoCallAccessRequests.svelte";

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

    // I can't (yet) find a way to avoid using "any" here. Will try to improve but need to commit this crime for the time being
    let videoCallElement: any;

    trackedEffect("rtl", () => {
        // subscribe to the rtl store so that we can set the overall page direction at the right time
        document.dir = $rtlStore ? "rtl" : "ltr";
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

    document.body.classList.add("native-android");
    detectNeedsSafeInset();
</script>

<Head />

<ActiveCall
    onClearSelection={() => page(routeForScope($chatListScopeStore))}
    bind:this={videoCallElement} />

<VideoCallAccessRequests />

<IncomingCall onJoinVideoCall={joinVideoCall} />

<NotificationsBar />

<!-- should we perhaps just _always_ render the router -->
{#if $identityStateStore.kind === "anon" || $identityStateStore.kind === "logging_in" || $identityStateStore.kind === "registering" || $identityStateStore.kind === "logged_in" || $identityStateStore.kind === "loading_user" || $identityStateStore.kind === "challenging"}
    {#if !$isLoading}
        <Router />
    {/if}
{/if}

<UpgradeBanner />

{#if $snowing}
    <Snow />
{/if}

<svelte:window onresize={resize} onerror={unhandledError} onorientationchange={resize} />

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
        OpenChat,
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
    import { installConsoleHooks } from "@src/logic/moderation/consoleHooks";
    import { onMount, setContext } from "svelte";
    import { overrideItemIdKeyNameBeforeInitialisingDndZones } from "svelte-dnd-action";
    import { _, isLoading, locale } from "svelte-i18n";
    import {
        expectPushDeviceRefresh,
        registerPushDevice,
        unregisterPushDevice,
    } from "@utils/native/push_device";
    import { clearAllNotifications, svelteReady } from "tauri-plugin-oc-api";
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

        const uninstallConsoleHooks = installConsoleHooks(client);

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
            uninstallConsoleHooks();
        };
    });

    // Guards the one-time native setup (listeners + logout hook) so it runs once
    // per page session. setupNativeApp() itself runs again on every userLoggedIn
    // (account switch), but only the FCM token registration should repeat —
    // re-registering listeners or the logout hook would stack duplicate handlers.
    let nativeSetupDone = false;

    // Sets up push notifications and FCM token management for native apps
    function setupNativeApp() {
        if (!client.isNativeApp()) {
            return;
        }

        // Register this device's push token on every login (FCM on Android,
        // APNs on iOS). Registration is last-login-wins on the backend, so this
        // also reclaims a token still bound to a previous account on this device.
        registerPushDevice(client);

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

        // Expect push token refreshes
        expectPushDeviceRefresh(client).catch(console.error);

        // Best-effort push hygiene on sign-out, while the identity is
        // still valid: unbind this device's token from the account,
        // delete the device token (pushes to it then dead-end at FCM,
        // and the next login mints + registers a fresh one), and empty
        // the tray and chat shortcuts so nothing from this account lingers.
        // Separate tasks, which logout runs side by side under one time cap:
        // the clear is local and must not wait on the token's network calls.
        client.onLogout(() => clearAllNotifications().catch(console.error));
        client.onLogout(() => unregisterPushDevice(client));
    }

    if ($identityStateStore.kind === "logged_in") {
        setupNativeApp();
        warmRichTextEditor();
    }

    function onUserLoggedIn() {
        setupNativeApp();
        warmRichTextEditor();
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
        // On a phone, focusing a field in an open menu (such as the token picker's search box)
        // brings up the keyboard, which can resize the window. Closing the menu then takes away
        // the field the user is about to type into, so leave it open.
        if (!focusIsInPortalMenu()) {
            portalState.close();
        }
        calculateHeight();
    }

    function orientationChanged() {
        portalState.close();
        calculateHeight();
    }

    function focusIsInPortalMenu(): boolean {
        return document.activeElement?.closest("[data-portal-menu]") != null;
    }

    function startVideoCall(payload: {
        chatId: ChatIdentifier;
        callType: VideoCallType;
        join: boolean;
        answer?: boolean;
    }) {
        videoCallElement?.startOrJoinVideoCall(
            payload.chatId,
            payload.callType,
            payload.join,
            payload.answer,
        );
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

<svelte:window
    onresize={resize}
    onerror={unhandledError}
    onorientationchange={orientationChanged} />

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

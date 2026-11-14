<script lang="ts">
    import "@styles/global.scss";

    import "@i18n/i18n";
    import { localeLoadFailed } from "@i18n/i18n";
    import Reload from "@shared_components/Reload.svelte";
    import { trackedEffect } from "@src/utils/effects.svelte";
    import { detectNeedsSafeInset, setupKeyboardTracking } from "@src/utils/safe_area";
    import {
        setStatusAndNavBarSizesForNativeApp,
        updateAndroidInterfaceSizes,
    } from "@stores/androidInterfaceSizes";
    import { snowing } from "@stores/snow";
    import { incomingVideoCall } from "@stores/video";
    import "@utils/markdown";
    import { followWindowInsets } from "@utils/native/notification_channels";
    import { followThemeInSystemBars } from "@utils/native/systemBarsStyle";
    import { notifyCallJoined } from "@utils/native/call_bridge";
    import {
        clearChatShortcutsOnLogout,
        setupNativeApp,
        startAgain,
    } from "@utils/native/nativeApp";
    import { portalState } from "component-lib";
    import {
        type ChatIdentifier,
        OpenChat,
        type VideoCallType,
        botState,
        chatListScopeStore,
        fontSize,
        identityStateStore,
        routeForChatIdentifier,
        routeForScope,
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
    import { createOpenChatClient, videoBridgeUrl } from "@utils/openchatClient";
    import { handleUnhandledError } from "@utils/unhandledError";
    import { onMount, setContext } from "svelte";
    import { overrideItemIdKeyNameBeforeInitialisingDndZones } from "svelte-dnd-action";
    import { _, isLoading, locale } from "svelte-i18n";
    import Head from "./Head.svelte";
    import NotificationsBar from "./home/NotificationsBar.svelte";
    import ActiveCall from "./home/video/ActiveCall.svelte";
    import IncomingCall from "./home/video/IncomingCall.svelte";
    import VideoCallAccessRequests from "./home/video/VideoCallAccessRequests.svelte";
    import Router from "./Router.svelte";
    import UpgradeBanner from "./UpgradeBanner.svelte";
    import LayoutSwitchBanner from "./LayoutSwitchBanner.svelte";
    import { keyboard } from "@src/stores/keyboard.svelte";

    overrideItemIdKeyNameBeforeInitialisingDndZones("_id");

    const logger = initialiseAppLogger();

    const client: OpenChat = createOpenChatClient($_, logger);
    setContext<OpenChat>("client", client);

    // I can't (yet) find a way to avoid using "any" here. Will try to improve but need to commit this crime for the time being
    let videoCallElement: ReturnType<typeof ActiveCall> | undefined;

    followDocumentDirection();

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
            subscribeToSessionEvents(client, {
                onLoggedIn: onUserLoggedIn,
                onUserIdChanged: () => startAgain(client),
            }),
        ];
        clearChatShortcutsOnLogout(client);
        window.addEventListener("orientationchange", calculateHeight);
        window.addEventListener("unhandledrejection", unhandledError);
        // visualViewport.resize fires when the iOS virtual keyboard appears/disappears
        // in PWA (home-screen) mode, where window.resize does not.
        // Guarded to non-native apps only to avoid conflicting with the native
        // keyboard handling system (expectWindowInsetChange) in the Tauri app.
        if (!client.isNativeApp()) {
            window.visualViewport?.addEventListener("resize", calculateHeight);
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

    if (client.isNativeAndroid()) {
        // the system bars' icons, dark over a light theme (for the app's lifetime)
        followThemeInSystemBars();
    }

    if (client.isNativeApp()) {
        // the current insets at once, signed in or not, then each change (followWindowInsets)
        followWindowInsets((data) => {
            // Setting these values in store should also set the CSS vars!
            // Gated so identical status/nav sizes don't re-write localStorage and
            // CSS vars on every keyboard-animation frame.
            updateAndroidInterfaceSizes(data.statusBarHeightDp, data.navHeightDp);

            keyboard.visible = data.isKeyboardOpen;
            keyboard.currentHeight = data.keyboardHeightDp;
            if (data.isKeyboardOpen) {
                document.body.classList.add("keyboard-visible");
            } else {
                document.body.classList.remove("keyboard-visible");
            }

            if (data.isGestureNavigation) {
                document.body.classList.add("has-gesture-nav");
            } else {
                document.body.classList.remove("has-gesture-nav");
            }
        }).catch(console.error);

        // We need to set the status bar height from the store, in case that
        // the webview was refreshed, but inset change didn't happen.
        setStatusAndNavBarSizesForNativeApp();
    }

    if ($identityStateStore.kind === "logged_in") {
        setupNativeApp(client, videoBridgeUrl);
        warmRichTextEditor();
    }

    function onUserLoggedIn() {
        setupNativeApp(client, videoBridgeUrl);
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
        portalState.close();
        calculateHeight();
    }

    function startVideoCall(payload: {
        chatId: ChatIdentifier;
        callType: VideoCallType;
        join: boolean;
        answer?: boolean;
    }) {
        if (payload.join) {
            // Joining from inside the app: the shell's native ring for this call, if any,
            // ends as answered here.
            const messageId = client.lookupChatSummary(payload.chatId)?.videoCallInProgress
                ?.messageId;
            if (messageId !== undefined) notifyCallJoined(messageId);
        }
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

    // The native-android class carries the shared native-webview rules (status
    // bar padding, touch-action, gesture-nav paddings) which iOS needs too;
    // native-ios is added on top for the few iOS-specific overrides.
    document.body.classList.add("native-android");
    if (client.isNativeIos()) {
        document.body.classList.add("native-ios");
    }
    detectNeedsSafeInset();
</script>

<svelte:boundary onerror={boundaryError}>
    <Head />

    <ActiveCall
        onClearSelection={() => navigate(routeForScope($chatListScopeStore))}
        bind:this={videoCallElement} />

    <VideoCallAccessRequests />

    <IncomingCall onJoinVideoCall={joinVideoCall} />

    <NotificationsBar />

    <!-- should we perhaps just _always_ render the router -->
    {#if $identityStateStore.kind === "anon" || $identityStateStore.kind === "logging_in" || $identityStateStore.kind === "registering" || $identityStateStore.kind === "logged_in" || $identityStateStore.kind === "loading_user"}
        <!-- a failed locale load clears isLoading with no locale set, and translating then throws; if English fails too nothing can be translated (#9636) -->
        {#if $localeLoadFailed}
            <Reload>Couldn't load OpenChat.</Reload>
        {:else if $locale && !$isLoading}
            <Router />
        {/if}
    {/if}

    {#if !client.isNativeApp()}
        <UpgradeBanner />
        <LayoutSwitchBanner />
    {/if}

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

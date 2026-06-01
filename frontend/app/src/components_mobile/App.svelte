<script lang="ts">
    import "@styles/global.scss";

    import "@i18n/i18n";
    import { trackedEffect } from "@src/utils/effects.svelte";
    import { detectNeedsSafeInset, setupKeyboardTracking } from "@src/utils/safe_area";
    import {
        androidInterfaceSizes,
        setStatusAndNavBarSizesForNativeApp,
    } from "@stores/androidInterfaceSizes";
    import { rtlStore } from "@stores/rtl";
    import { snowing } from "@stores/snow";
    import { incomingVideoCall } from "@stores/video";
    import { broadcastLoggedInUser } from "@stores/xframe";
    import "@utils/markdown";
    import { getProxyAdjustedBlobUrl } from "@utils/media";
    import {
        expectNewFcmToken,
        expectNotificationTap,
        expectPushNotifications,
        expectShareTarget,
        expectWindowInsetChange,
        type ShareTarget,
    } from "@utils/native/notification_channels";
    import type { Share } from "@utils/share";
    import "@utils/scream";
    import { portalState } from "component-lib";
    import {
        allChatsStore,
        allUsersStore,
        type ChatIdentifier,
        type ChatSummary,
        communitiesStore,
        compareChats,
        LazyFile,
        localUpdates,
        OpenChat,
        type VideoCallType,
        botState,
        chatListScopeStore,
        fontSize,
        identityStateStore,
        inititaliseLogger,
        publish,
        routeForChatIdentifier,
        routeForScope,
        subscribe,
    } from "openchat-client";
    import { convertFileSrc } from "@tauri-apps/api/core";
    import { derived } from "svelte/store";
    import page from "page";
    import { onMount, setContext } from "svelte";
    import { overrideItemIdKeyNameBeforeInitialisingDndZones } from "svelte-dnd-action";
    import { _, isLoading } from "svelte-i18n";
    import { getFcmToken, svelteReady, updateChatShortcuts } from "tauri-plugin-oc-api";
    import Head from "./Head.svelte";
    import NotificationsBar from "./home/NotificationsBar.svelte";
    import ActiveCall from "./home/video/ActiveCall.svelte";
    import IncomingCall from "./home/video/IncomingCall.svelte";
    import VideoCallAccessRequests from "./home/video/VideoCallAccessRequests.svelte";
    import Router from "./Router.svelte";
    import Snow from "@shared_components/Snow.svelte";
    import UpgradeBanner from "./UpgradeBanner.svelte";
    import { keyboard } from "@src/stores/keyboard.svelte";

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
            baseOrigin: import.meta.env.OC_BASE_ORIGIN!,
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
        // visualViewport.resize fires when the iOS virtual keyboard appears/disappears
        // in PWA (home-screen) mode, where window.resize does not.
        // Guarded to non-native apps only to avoid conflicting with the native
        // keyboard handling system (expectWindowInsetChange) in the Tauri app.
        if (!client.isNativeApp()) {
            window.visualViewport?.addEventListener("resize", calculateHeight);
        }

        const unsub = _.subscribe((formatter) => {
            botState.messageFormatter = formatter;
        });

        const unsubKeyboard = setupKeyboardTracking();
        return () => {
            window.removeEventListener("orientationchange", calculateHeight);
            window.removeEventListener("unhandledrejection", unhandledError);
            if (!client.isNativeApp()) {
                window.visualViewport?.removeEventListener("resize", calculateHeight);
            }
            unsubs.forEach((u) => u());
            unsub();
            unsubKeyboard();
        };
    });

    if (client.isNativeApp()) {
        expectWindowInsetChange((data) => {
            // Setting these values in store should also set the CSS vars!
            androidInterfaceSizes.set({
                statusBarHeight: data.statusBarHeightDp,
                navBarHeight: data.navHeightDp,
            });

            keyboard.visible = data.isKeyboardOpen;
            keyboard.currentHeight = data.keyboardHeightDp;
            data.isKeyboardOpen
                ? document.body.classList.add("keyboard-visible")
                : document.body.classList.remove("keyboard-visible");

            data.isGestureNavigation
                ? document.body.classList.add("has-gesture-nav")
                : document.body.classList.remove("has-gesture-nav");
        }).catch(console.error);

        // We need to set the status bar height from the store, in case that
        // the webview was refreshed, but inset change didn't happen.
        setStatusAndNavBarSizesForNativeApp();
    }

    // Shortcut ids round-trip through the Android shortcut system as opaque
    // strings, so we need a kind-prefixed encoding to reverse them back into
    // a ChatIdentifier when the share arrives. chatIdentifierToString in
    // openchat-shared drops the kind, which makes direct vs group ids
    // indistinguishable on the way back.
    function chatIdToShortcutId(id: ChatIdentifier): string {
        switch (id.kind) {
            case "direct_chat":
                return `d:${id.userId}`;
            case "group_chat":
                return `g:${id.groupId}`;
            case "channel":
                return `c:${id.communityId}:${id.channelId}`;
        }
    }

    function shortcutIdToChatId(s: string): ChatIdentifier | undefined {
        const colon = s.indexOf(":");
        if (colon < 0) return undefined;
        const kind = s.slice(0, colon);
        const rest = s.slice(colon + 1);
        switch (kind) {
            case "d":
                return { kind: "direct_chat", userId: rest };
            case "g":
                return { kind: "group_chat", groupId: rest };
            case "c": {
                const sep = rest.lastIndexOf(":");
                if (sep < 0) return undefined;
                const channelId = Number(rest.slice(sep + 1));
                if (!Number.isFinite(channelId)) return undefined;
                return {
                    kind: "channel",
                    communityId: rest.slice(0, sep),
                    channelId,
                };
            }
            default:
                return undefined;
        }
    }

    function shareToChat(chatId: ChatIdentifier, shareTarget: ShareTarget) {
        // Set the draft synchronously — the chat doesn't have to exist in
        // chatSummariesStore yet; the draft is keyed by id and the composer
        // picks it up reactively once the chat is selected.
        const text = shareTarget.text ?? "";
        if (text.length > 0) {
            localUpdates.draftMessages.setTextContent({ chatId }, text);
        }
        const firstFile = shareTarget.files[0];
        if (firstFile) {
            const lazy = LazyFile.fromUrl(
                convertFileSrc(firstFile.path),
                firstFile.name,
                firstFile.mimeType ?? "application/octet-stream",
                firstFile.size,
            );
            client
                .messageContentFromFile(lazy as unknown as File)
                .then((content) =>
                    localUpdates.draftMessages.setAttachment({ chatId }, content),
                )
                .catch((err) => console.error("Failed to attach shared file", err));
        }
        // Defer the navigation: on cold start, the share-target event can
        // arrive while Home.svelte is still doing its initial route resolution
        // (which pageReplaces the home_route to the default scope). Pushing
        // through a macrotask lets that settle first, so our chat route wins.
        setTimeout(() => page(routeForChatIdentifier($chatListScopeStore.kind, chatId)));
    }

    function handleShareTarget(shareTarget: ShareTarget) {
        // Direct Share fast-path: the share came from a chat shortcut we
        // pushed via updateChatShortcuts, so we know the destination and
        // can skip the picker entirely.
        if (shareTarget.shortcutId) {
            const chatId = shortcutIdToChatId(shareTarget.shortcutId);
            if (chatId !== undefined) {
                shareToChat(chatId, shareTarget);
                return;
            }
            // Unrecognised shortcut id — fall through to the picker.
        }

        // Generic share-sheet path: reuse the existing in-app "share message"
        // flow. SlidingModals subscribes to "shareMessage" and renders
        // ShareMessageModal, which wraps SelectChatModal and pre-fills the
        // chosen chat's draft via localUpdates.draftMessages.
        const text = shareTarget.text ?? "";
        // Wrap each shared file path in a LazyFile so the existing
        // messageContentFromFile path can stream bytes through Tauri's asset
        // protocol instead of buffering them across the IPC boundary.
        const files = shareTarget.files.map((f) =>
            LazyFile.fromUrl(
                convertFileSrc(f.path),
                f.name,
                f.mimeType ?? "application/octet-stream",
                f.size,
            ),
        );
        const share: Share = {
            title: undefined,
            text: text.length > 0 ? text : undefined,
            url: undefined,
            files: files as unknown as File[],
        };
        publish("shareMessage", share);
    }

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

            // Listen for content shared into OpenChat from the system share sheet
            // (or via a Direct Share chat shortcut). Cold-start shares are queued
            // by the native side and delivered once svelteReady fires below.
            expectShareTarget(handleShareTarget).catch(console.error);

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

            // Push the top recent chats to the Android Sharing Shortcuts API
            // so they appear directly in the system share sheet (like
            // WhatsApp's per-chat tiles). chatSummariesListStore re-fires on
            // every message in any chat, but the top-N identity changes far
            // less often — we dedupe by a stringified key to avoid hammering
            // the native side (each push downloads avatars via Coil).
            //
            // Cap matches the typical Android Direct Share row (4 tiles).
            const SHORTCUT_COUNT = 4;
            const topShortcutsStore = derived(
                [allChatsStore, allUsersStore, communitiesStore],
                ([chats, users, communities]) => {
                    // allChatsStore is a ChatMap across every scope (direct
                    // chats, groups, channels in any community) so users see
                    // the right tiles regardless of which scope the app is
                    // currently in. compareChats matches the comparator the
                    // in-app chat list uses internally.
                    //
                    // Filter out chats we can't actually send a message to
                    // (OpenChatBot, proposal bot, read-only groups, etc.)
                    // BEFORE slicing — otherwise a non-sendable chat near the
                    // top would waste a tile slot.
                    const sorted: ChatSummary[] = [...chats.values()].sort(compareChats);
                    return sorted
                        .filter((chat) => client.canSendMessage(chat.id, "message"))
                        .slice(0, SHORTCUT_COUNT)
                        .map((chat) => {
                            if (chat.kind === "direct_chat") {
                                const them = users.get(chat.them.userId);
                                return {
                                    id: chatIdToShortcutId(chat.id),
                                    name: client.displayName(them),
                                    // Adjust dev-mode localhost canister URLs so the
                                    // native side can fetch the avatar bytes via Coil.
                                    avatarUrl: getProxyAdjustedBlobUrl(client.userAvatarUrl(them)),
                                };
                            }
                            if (chat.kind === "channel") {
                                // Prefix channel tiles with the community name
                                // so the user can tell which community the
                                // channel belongs to (the channel name alone
                                // is often ambiguous across communities).
                                const community = communities.get({
                                    kind: "community",
                                    communityId: chat.id.communityId,
                                });
                                const name = community
                                    ? `${community.name}#${chat.name}`
                                    : chat.name;
                                return {
                                    id: chatIdToShortcutId(chat.id),
                                    name,
                                    avatarUrl: getProxyAdjustedBlobUrl(
                                        client.groupAvatarUrl(chat),
                                    ),
                                };
                            }
                            return {
                                id: chatIdToShortcutId(chat.id),
                                name: chat.name,
                                avatarUrl: getProxyAdjustedBlobUrl(client.groupAvatarUrl(chat)),
                            };
                        });
                },
            );
            let lastPushedShortcutsKey = "";
            topShortcutsStore.subscribe((chats) => {
                // Skip the transient empty emit during chat-list hydration —
                // pushing an empty list would prune any existing shortcuts,
                // leaving a window where the system share sheet has none.
                if (chats.length === 0) return;
                const key = JSON.stringify(chats);
                if (key === lastPushedShortcutsKey) return;
                lastPushedShortcutsKey = key;
                updateChatShortcuts({ chats }).catch((err) =>
                    console.error("Failed to update chat shortcuts", err),
                );
            });

            // Inform the native android app that svelte code is ready! SetTimeout
            // delays the fn execution until the call stack is empty, just to
            // make sure anything else non-async that needs to run is done.
            //
            // Once Svelte app is ready, native code can start pushing events.
            setTimeout(svelteReady);
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
{#if $identityStateStore.kind === "anon" || $identityStateStore.kind === "logging_in" || $identityStateStore.kind === "registering" || $identityStateStore.kind === "logged_in" || $identityStateStore.kind === "loading_user"}
    {#if !$isLoading}
        <Router />
    {/if}
{/if}

{#if !client.isNativeApp()}
    <UpgradeBanner />
{/if}

{#if $snowing}
    <Snow />
{/if}

<svelte:window onresize={resize} onerror={unhandledError} onorientationchange={resize} />

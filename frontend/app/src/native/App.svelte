<!-- The native tree's root (src/native): the iOS and Android apps and phones' browsers, mounted by
     main.ts behind OC_NATIVE_LAYOUT=v4. Styles, behaviours, the i18n bridge, the client, the native
     root on <html> (platform, OS, theme, text scale), haptics, and the native apps' setup; then the
     router and, once it has a route, the shell. -->
<script lang="ts">
    import "@openchat/ui/src/lib/styles/tokens.css";
    import "@openchat/ui/src/lib/styles/global.css";

    import "@i18n/i18n";
    import { localeLoadFailed, reviewingTranslations } from "@i18n/i18n";
    import { addUiMessages, uiTranslate } from "@i18n/openchatUi";
    import { installBehaviours } from "@openchat/ui/src/lib/behaviours";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import { setI18n } from "@openchat/ui/src/lib/i18n";
    import { setHaptics } from "@openchat/ui/src/native/haptics";
    import { textScaleOf } from "@src/logic/profile/appearance";
    import { accentStore } from "@theme/accent";
    import { currentThemeMode } from "@theme/themes";
    import {
        boundaryErrorHandler,
        followDocumentDirection,
        initialiseAppLogger,
        subscribeToSessionEvents,
    } from "@utils/appRoot.svelte";
    import {
        clearChatShortcutsOnLogout,
        setupNativeApp,
        startAgain,
    } from "@utils/native/nativeApp";
    import { createOpenChatClient, videoBridgeUrl } from "@utils/openchatClient";
    import { handleUnhandledError } from "@utils/unhandledError";
    import {
        botState,
        fontScaleStore,
        identityStateStore,
        isAndroidTauriApp,
        isIosTauriApp,
        OpenChat,
        routerReadyStore,
    } from "@client";
    import { onMount, setContext } from "svelte";
    import { _, isLoading, json, locale } from "svelte-i18n";
    import { nativeOs } from "./platform";
    import Router from "./router/Router.svelte";
    import Shell from "./shell/Shell.svelte";

    addUiMessages();
    installBehaviours();

    const logger = initialiseAppLogger();

    const client: OpenChat = createOpenChatClient($_, logger);
    setContext<OpenChat>("client", client);

    setI18n({
        t: (key, params) => uiTranslate($json, key, params, $locale ?? "en"),
        get locale() {
            return $locale ?? "en";
        },
    });

    // No haptics on mobile web (#10366); the apps' come from the Tauri plugin.
    setHaptics(() => {});

    const os = nativeOs(
        isIosTauriApp() ? "ios" : isAndroidTauriApp() ? "android" : undefined,
        navigator.userAgent,
    );

    // The native root is <html>, so what's portalled to <body> (sheets, menus, the call screen) is
    // inside it too: the platform and OS (touch targets, back arrow, kebab, bar paddings), and the
    // theme and accent the web uses, from the same stored settings. They go when the tree does.
    const root = document.documentElement;
    root.dataset.platform = "native";
    root.dataset.os = os;
    $effect(() => {
        root.dataset.mode = $currentThemeMode;
        root.dataset.accent = $accentStore;
    });

    // The --text-* sizes follow --text-scale: the font size setting times the platform's own font
    // scale, which needs a native bridge (GAPS.md), so 1 for now. Only while the tree is mounted, so
    // no other tree inherits it.
    $effect(() => {
        root.style.setProperty("--text-scale", String(textScaleOf($fontScaleStore, 1)));
    });

    $effect(() => {
        botState.messageFormatter = $_;
    });

    followDocumentDirection();

    onMount(() => {
        const unsubscribe = subscribeToSessionEvents(client, {
            onLoggedIn: () => setupNativeApp(client, videoBridgeUrl),
            onUserIdChanged: () => startAgain(client),
        });
        clearChatShortcutsOnLogout(client);
        window.addEventListener("unhandledrejection", unhandledError);
        return () => {
            window.removeEventListener("unhandledrejection", unhandledError);
            unsubscribe();
            delete root.dataset.platform;
            delete root.dataset.os;
            root.style.removeProperty("--text-scale");
        };
    });

    // Already signed in: the native setup (listeners before svelteReady) starts now, as in
    // components_mobile; a later sign-in starts it from onLoggedIn.
    if ($identityStateStore.kind === "logged_in") {
        setupNativeApp(client, videoBridgeUrl);
    }

    function unhandledError(ev: Event) {
        handleUnhandledError(ev, () => client.logout());
    }

    const boundaryError = boundaryErrorHandler(logger);
</script>

<svelte:window onerror={unhandledError} />

<svelte:boundary onerror={boundaryError}>
    <!-- a failed locale load clears isLoading with no locale set, and translating then throws (#9636) -->
    {#if $localeLoadFailed}
        <!-- no locale, so only literal text or the library's bundled English can be shown -->
        <EmptyState
            preset="error"
            title="Couldn't load OpenChat."
            body="Check your connection and reload the page."
            actionLabel="Reload"
            actionHandler={() => window.location.reload()} />
    {:else if ($locale && !$isLoading) || $reviewingTranslations}
        <Router>
            {#if $routerReadyStore}
                <Shell />
            {/if}
        </Router>
    {/if}

    {#snippet failed(_error, reset)}
        <EmptyState preset="error" actionHandler={reset} />
    {/snippet}
</svelte:boundary>

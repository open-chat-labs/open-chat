<script lang="ts">
    import "@openchat/ui/src/lib/styles/tokens.css";
    import "@openchat/ui/src/lib/styles/global.css";

    import "@i18n/i18n";
    import { localeLoadFailed, reviewingTranslations } from "@i18n/i18n";
    import { installBehaviours } from "@openchat/ui/src/lib/behaviours";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import { setI18n } from "@openchat/ui/src/lib/i18n";
    import {
        setPendingToastHost,
        setToastHost,
        ToastLayer,
    } from "@openchat/ui/src/lib/toasts.svelte";
    import { currentThemeMode } from "@theme/themes";
    import {
        boundaryErrorHandler,
        followDocumentDirection,
        initialiseAppLogger,
        subscribeToSessionEvents,
    } from "@utils/appRoot.svelte";
    import { createOpenChatClient } from "@utils/openchatClient";
    import { handleUnhandledError } from "@utils/unhandledError";
    import { installConsoleHooks } from "@src/logic/moderation/consoleHooks";
    import { botState, OpenChat } from "@client";
    import { onMount, setContext } from "svelte";
    import { accentStore } from "@theme/accent";
    import { _, isLoading, json, locale } from "svelte-i18n";
    import { addUiMessages, uiTranslate } from "@i18n/openchatUi";
    import RouteScreen from "./features/app/RouteScreen.svelte";
    import CallHost from "./features/call/CallHost.svelte";
    import { createWebCall } from "./features/call/webCall";
    import type { CallSession } from "@src/logic/video/callSession.svelte";
    import LayoutSwitchBanner from "./shell/LayoutSwitchBanner.svelte";
    import OfflineBanner from "./shell/OfflineBanner.svelte";
    import Toasts from "./shell/Toasts.svelte";
    import Router from "./router/Router.svelte";

    addUiMessages();
    installBehaviours();

    const logger = initialiseAppLogger();

    const client: OpenChat = createOpenChatClient($_, logger);
    setContext<OpenChat>("client", client);

    // the app's one call, which outlives every screen and route (web 7b)
    const call = createWebCall(client);
    setContext<CallSession>("callSession", call);

    setI18n({
        t: (key, params) => uiTranslate($json, key, params, $locale ?? "en"),
        get locale() {
            return $locale ?? "en";
        },
    });

    // The library's toasts (a wallet send's, an invite's …) show in the app's toast layer, over
    // every dialog and its veil (shell/Toasts)
    const libraryToasts = new ToastLayer();
    setToastHost(libraryToasts.show);
    setPendingToastHost(libraryToasts.showPending);

    // The theme goes on <html> rather than a wrapper so that anything mounted outside the
    // app's own tree (dialogs, menus, tooltips) is themed too. The accent is the one picked on
    // Landing (theme/accent.ts).
    $effect(() => {
        document.documentElement.dataset.mode = $currentThemeMode;
        document.documentElement.dataset.accent = $accentStore;
    });

    $effect(() => {
        botState.messageFormatter = $_;
    });

    followDocumentDirection();

    onMount(() => {
        const unsubscribe = subscribeToSessionEvents(client);
        window.addEventListener("unhandledrejection", unhandledError);
        // the platform moderators' and operators' console hooks, as the old App has them
        const uninstallConsoleHooks = installConsoleHooks(client);
        return () => {
            window.removeEventListener("unhandledrejection", unhandledError);
            unsubscribe();
            uninstallConsoleHooks();
        };
    });

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
            <RouteScreen />
        </Router>
        <Toasts library={libraryToasts} />
        <!-- the window's notices, one under another at its top -->
        <div class="top-banners">
            <OfflineBanner />
            <LayoutSwitchBanner />
        </div>
        <CallHost session={call} />
    {/if}

    {#snippet failed(_error, reset)}
        <EmptyState preset="error" actionHandler={reset} />
    {/snippet}
</svelte:boundary>

<style lang="scss">
    // TODO(design): no design for either; the library's Banners floating at the top of the window,
    // over the app but under its dialogs. Only the banners take the pointer, not the space around
    .top-banners {
        position: fixed;
        top: var(--space-8);
        left: 50%;
        transform: translateX(-50%);
        width: min(640px, calc(100vw - 2 * var(--space-16)));
        display: flex;
        flex-direction: column;
        gap: var(--space-8);
        pointer-events: none;
        /* over the shell, under the dialogs' veil */
        z-index: calc(var(--z-backdrop) - 1);

        > :global(*) {
            pointer-events: auto;
        }
    }
</style>

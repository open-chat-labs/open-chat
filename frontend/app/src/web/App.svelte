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
        sayWhenSignUpInterrupted,
        subscribeToSessionEvents,
    } from "@utils/appRoot.svelte";
    import { createOpenChatClient, NEW_UI_BEHAVIOUR } from "@utils/openchatClient";
    import { handleUnhandledError } from "@utils/unhandledError";
    import { installConsoleHooks } from "@src/logic/moderation/consoleHooks";
    import { botState, fontScaleStore, identityStateStore, OpenChat } from "@client";
    import { warmRichTextEditor } from "@src/core/richText/richTextEditorLoader";
    import { textScaleOf } from "@src/logic/profile/appearance";
    import { onMount, setContext } from "svelte";
    import { accentStore } from "@theme/accent";
    import { _, isLoading, json, locale } from "svelte-i18n";
    import { addUiMessages, uiTranslate } from "@i18n/openchatUi";
    import RouteScreen from "./features/app/RouteScreen.svelte";
    import CallHost from "./features/call/CallHost.svelte";
    import { createWebCall } from "./features/call/webCall";
    import type { CallSession } from "@src/logic/video/callSession.svelte";
    import LayoutSwitchBanner from "./shell/LayoutSwitchBanner.svelte";
    import Toasts from "./shell/Toasts.svelte";
    import Router from "./router/Router.svelte";

    addUiMessages();
    installBehaviours();

    const logger = initialiseAppLogger();

    // the chat list's rows follow the user store, so the first list needn't wait for every name
    const client: OpenChat = createOpenChatClient($_, logger, NEW_UI_BEHAVIOUR);
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

    // The library's --text-* sizes follow --text-scale: the font size setting (Profile's), as in
    // the native tree, with no platform font scale of its own (the browser's zoom applies on top).
    // On <html>, so dialogs and menus follow it too; removed when the tree goes (onMount).
    $effect(() => {
        document.documentElement.style.setProperty(
            "--text-scale",
            String(textScaleOf($fontScaleStore, 1)),
        );
    });

    $effect(() => {
        botState.messageFormatter = $_;
    });

    followDocumentDirection();

    // the rich-text editor's chunk, loaded at idle once signed in, so a composer has it at once: a
    // phone raises its keyboard only for a focus inside the tap (richTextEditorLoader, #10576)
    $effect(() => {
        if ($identityStateStore.kind === "logged_in") warmRichTextEditor();
    });

    onMount(() => {
        const unsubscribe = subscribeToSessionEvents(client);
        const stopSayingSignUpInterrupted = sayWhenSignUpInterrupted();
        window.addEventListener("unhandledrejection", unhandledError);
        // the platform moderators' and operators' console hooks, as the old App has them
        const uninstallConsoleHooks = installConsoleHooks(client);
        return () => {
            window.removeEventListener("unhandledrejection", unhandledError);
            unsubscribe();
            stopSayingSignUpInterrupted();
            uninstallConsoleHooks();
            document.documentElement.style.removeProperty("--text-scale");
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
        <LayoutSwitchBanner />
        <CallHost session={call} />
    {/if}

    {#snippet failed(_error, reset)}
        <!-- anything in the app can land here, so not the preset's "Couldn't load messages" -->
        <EmptyState
            preset="error"
            title="ui.emptyState.crashTitle"
            body="ui.emptyState.crashBody"
            actionHandler={reset} />
    {/snippet}
</svelte:boundary>

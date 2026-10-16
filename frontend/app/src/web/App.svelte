<script lang="ts">
    import "@openchat/ui/src/lib/styles/tokens.css";
    import "@openchat/ui/src/lib/styles/global.css";

    import "@i18n/i18n";
    import { localeLoadFailed, reviewingTranslations } from "@i18n/i18n";
    import { installBehaviours } from "@openchat/ui/src/lib/behaviours";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import { setI18n } from "@openchat/ui/src/lib/i18n";
    import { currentThemeMode } from "@theme/themes";
    import {
        boundaryErrorHandler,
        followDocumentDirection,
        initialiseAppLogger,
        subscribeToSessionEvents,
    } from "@utils/appRoot.svelte";
    import { createOpenChatClient } from "@utils/openchatClient";
    import { handleUnhandledError } from "@utils/unhandledError";
    import { botState, OpenChat } from "@client";
    import { onMount, setContext } from "svelte";
    import { _, getMessageFormatter, isLoading, json, locale } from "svelte-i18n";
    import { addUiMessages, uiTranslate } from "./i18n";
    import Shell from "./shell/Shell.svelte";

    addUiMessages();
    installBehaviours();

    const logger = initialiseAppLogger();

    const client: OpenChat = createOpenChatClient($_, logger);
    setContext<OpenChat>("client", client);

    setI18n({
        t: (key, params) => uiTranslate(getMessageFormatter, $json, key, params, $locale ?? "en"),
        get locale() {
            return $locale ?? "en";
        },
    });

    // The theme goes on <html> rather than a wrapper so that anything mounted outside the
    // app's own tree (dialogs, menus, tooltips) is themed too.
    // TODO(design): the accent has no user setting yet, so it stays on the design's default.
    $effect(() => {
        document.documentElement.dataset.mode = $currentThemeMode;
        document.documentElement.dataset.accent = "pink";
    });

    $effect(() => {
        botState.messageFormatter = $_;
    });

    followDocumentDirection();

    onMount(() => {
        const unsubscribe = subscribeToSessionEvents(client);
        window.addEventListener("unhandledrejection", unhandledError);
        return () => {
            window.removeEventListener("unhandledrejection", unhandledError);
            unsubscribe();
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
        <Shell />
    {/if}

    {#snippet failed(_error, reset)}
        <EmptyState preset="error" actionHandler={reset} />
    {/snippet}
</svelte:boundary>

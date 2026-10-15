<script lang="ts">
    import "@openchat/ui/lib/styles/tokens.css";
    import "@openchat/ui/lib/styles/global.css";

    import "@i18n/i18n";
    import { localeLoadFailed, reviewingTranslations } from "@i18n/i18n";
    import { installBehaviours } from "@openchat/ui/lib/behaviours";
    import EmptyState from "@openchat/ui/lib/components/EmptyState.svelte";
    import { setI18n } from "@openchat/ui/lib/i18n";
    import { rtlStore } from "@stores/rtl";
    import { currentTheme } from "@theme/themes";
    import { recordError } from "@utils/errorPostmortem";
    import { createOpenChatClient } from "@utils/openchatClient";
    import { handleUnhandledError } from "@utils/unhandledError";
    import { inititaliseLogger, OpenChat, subscribe } from "@client";
    import { onMount, setContext } from "svelte";
    import { _, isLoading, json, locale } from "svelte-i18n";
    import { addUiMessages, uiTranslate } from "./i18n";
    import Shell from "./shell/Shell.svelte";

    addUiMessages();
    installBehaviours();

    const logger = inititaliseLogger(
        import.meta.env.OC_ROLLBAR_ACCESS_TOKEN!,
        import.meta.env.OC_WEBSITE_VERSION!,
        import.meta.env.OC_BUILD_ENV!,
    );

    const client: OpenChat = createOpenChatClient($_, logger);
    setContext<OpenChat>("client", client);

    setI18n({
        t: (key, params) => uiTranslate($_, $json, key, params, $locale ?? "en"),
        get locale() {
            return $locale ?? "en";
        },
    });

    // The theme goes on <html> rather than a wrapper so that anything mounted outside the
    // app's own tree (dialogs, menus, tooltips) is themed too.
    // TODO(design): the accent has no user setting yet, so it stays on the design's default.
    let mode = $derived($currentTheme.mode === "light" ? "light" : "dark");
    $effect(() => {
        document.documentElement.dataset.mode = mode;
        document.documentElement.dataset.accent = "pink";
    });

    $effect(() => {
        document.dir = $rtlStore ? "rtl" : "ltr";
    });

    onMount(() => {
        const unsubs = [
            subscribe("sessionExpired", () => client.logout()),
            // The current user has a new user id, so start again under it
            subscribe("currentUserIdChanged", () => window.location.reload()),
        ];
        window.addEventListener("unhandledrejection", unhandledError);
        return () => {
            window.removeEventListener("unhandledrejection", unhandledError);
            unsubs.forEach((u) => u());
        };
    });

    function unhandledError(ev: Event) {
        handleUnhandledError(ev, () => client.logout());
    }

    function boundaryError(err: unknown) {
        recordError("boundary", err);
        logger?.error("Top level boundary error: ", err);
    }
</script>

<svelte:head>
    <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" />
</svelte:head>

<svelte:window onerror={unhandledError} />

<svelte:boundary onerror={boundaryError}>
    <!-- a failed locale load clears isLoading with no locale set, and translating then throws (#9636) -->
    {#if $localeLoadFailed}
        <EmptyState
            preset="error"
            title="Couldn't load OpenChat."
            body=""
            actionLabel="Reload"
            actionHandler={() => window.location.reload()} />
    {:else if ($locale && !$isLoading) || $reviewingTranslations}
        <Shell />
    {/if}

    {#snippet failed(_error, reset)}
        <EmptyState preset="error" actionHandler={reset} />
    {/snippet}
</svelte:boundary>

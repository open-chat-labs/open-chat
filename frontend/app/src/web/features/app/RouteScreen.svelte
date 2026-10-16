<!-- What the current route renders (router/regions.ts): a marketing page, not found, or the app,
     which waits for the user's chats as the existing trees do. -->
<script lang="ts">
    import { anonUserStore, chatsInitialisedStore, identityStateStore, routeStore } from "@client";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { navigate } from "@src/utils/navigation";
    import { regionsFor } from "../../router/regions";
    import AppScreen from "./AppScreen.svelte";
    import Placeholder from "./Placeholder.svelte";

    // development only, until the marketing pages are mounted
    const DEV_LINKS = ["/chats", "/favourite", "/chats/threads", "/notifications", "/communities", "/wallet", "/wallet/send", "/chats?profile"];

    const signedOut = $derived($identityStateStore.kind === "anon" && $anonUserStore);
    const regions = $derived(regionsFor($routeStore, signedOut));

    const registering = $derived(
        $identityStateStore.kind === "registering" ||
            ($identityStateStore.kind === "loading_user" && $identityStateStore.registering),
    );
    const loading = $derived(
        !registering && (!$chatsInitialisedStore || $identityStateStore.kind === "loading_user"),
    );
</script>

{#if regions.area === "marketing"}
    <div class="page">
        <!-- TODO(phase 9): Landing and Learn. Until then, links into the app. -->
        <div class="marketing">
            <Placeholder title="Marketing page" detail={regions.route.kind} />
            <nav class="links">
                {#each DEV_LINKS as href}
                    <a {href}>{href}</a>
                {/each}
            </nav>
        </div>
    </div>
{:else if regions.area === "not_found"}
    <div class="page">
        <!-- TODO(design): no not-found page in the design; this is the existing page's copy -->
        <EmptyState
            preset="no-results"
            title="Page not found"
            body=" "
            actionLabel="ui.navRail.home"
            actionHandler={() => navigate("/")} />
    </div>
{:else if loading}
    <div class="page">
        <Spinner />
    </div>
{:else}
    <AppScreen {regions} />
{/if}

<style>
    .marketing {
        display: grid;
        gap: var(--space-16);
        justify-items: center;
    }

    .links {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: var(--space-12);
        font-family: var(--font-mono);
        font-size: var(--text-sm);
    }

    .links a {
        color: var(--accent);
    }

    .page {
        display: grid;
        place-items: center;
        height: 100vh;
        height: 100dvh;
        background: var(--surface-0);
        color: var(--ink);
    }
</style>

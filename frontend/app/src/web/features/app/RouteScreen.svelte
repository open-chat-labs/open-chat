<!-- What the current route renders (router/regions.ts): a marketing page, not found, or the app,
     which waits for the user's chats as the existing trees do. -->
<script lang="ts">
    import {
        anonUserStore,
        chatsInitialisedStore,
        identityStateStore,
        querystringStore,
        routeStore,
        startUpFailedStore,
        type OpenChat,
    } from "@client";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { navigate } from "@src/utils/navigation";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { regionsFor } from "../../router/regions";
    import { showsSignedOut } from "@src/logic/auth/authFlow";
    import AuthScreen from "../auth/AuthScreen.svelte";
    import { pageSignIns } from "@src/logic/auth/authDialog.svelte";
    import MarketingScreen from "../marketing/MarketingScreen.svelte";
    import AppScreen from "./AppScreen.svelte";
    import { appGate } from "./appGate";

    const client = getContext<OpenChat>("client");

    const signedOut = $derived(
        showsSignedOut(
            $identityStateStore,
            $anonUserStore,
            pageSignIns.signingIn,
            pageSignIns.signupFailed,
        ),
    );
    // a guest on a page that needs an account sees Explore while they're asked to sign in
    const regions = $derived(
        regionsFor($routeStore, signedOut, $querystringStore, $anonUserStore),
    );

    const gate = $derived(
        appGate($identityStateStore, $chatsInitialisedStore, $startUpFailedStore),
    );
</script>

{#if regions.area === "marketing"}
    <MarketingScreen route={regions.route} />
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
{:else if gate === "loading"}
    <div class="page">
        <Spinner />
    </div>
{:else if gate === "failed"}
    <!-- start-up couldn't load the session from before; still signed in, so Retry loads it again
         (#10562) -->
    <div class="page">
        <EmptyState
            preset="error"
            title={$_("startUpFailed.title")}
            body={$_("startUpFailed.body")}
            actionLabel="ui.common.retry"
            actionHandler={() => client.retryStartUp()} />
    </div>
{:else}
    <AppScreen {regions} />
{/if}

{#if regions.area !== "marketing"}
    <!-- outside the branches above, so a sign-in survives the spinner while the user loads -->
    <AuthScreen />
{/if}

<style lang="scss">
    .page {
        display: grid;
        place-items: center;
        height: 100vh;
        height: 100dvh;
        background: var(--surface-0);
        color: var(--ink);
    }
</style>

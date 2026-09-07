<script lang="ts">
    import {
        anonUserStore,
        chatsInitialisedStore,
        identityStateStore,
        querystringStore,
        routeStore,
    } from "@client";
    import Loading from "@shared_components/Loading.svelte";
    import OnboardModal from "../onboard/OnboardModal.svelte";
    import Home from "./Home.svelte";

    // Registry discovery remains a prerequisite for the chat/card tree, but
    // not for anonymous-home authentication choices. Keep this form mounted
    // across login start and late discovery completion to preserve user input.
    let anonymousHome = $derived(
        $routeStore.kind === "home_route" &&
            $anonUserStore &&
            ($identityStateStore.kind === "anon" || $identityStateStore.kind === "logging_in"),
    );

    // Keep query-driven navigation/modal state with Home, including after its
    // handler removes the query. No duplicate list of supported actions here.
    let hasEntryQuery = $derived($querystringStore.toString() !== "");
    let homeEntryRequested = $state(false);
    $effect(() => {
        if (!anonymousHome) homeEntryRequested = false;
        else if (hasEntryQuery) homeEntryRequested = true;
    });

    let registering = $derived(
        $identityStateStore.kind === "registering" ||
            ($identityStateStore.kind === "loading_user" && $identityStateStore.registering),
    );

    let showLoader = $derived(
        !registering && (!$chatsInitialisedStore || $identityStateStore.kind === "loading_user"),
    );
</script>

{#if anonymousHome && !hasEntryQuery && !homeEntryRequested}
    <main class="welcome">
        <OnboardModal />
    </main>
{:else if showLoader}
    <div class="loading">
        <div class="inner-loader">
            <Loading size={"small"} />
        </div>
    </div>
{:else}
    <Home />
{/if}

<style lang="scss">
    .welcome {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
    }

    .loading {
        width: 100vw;
        height: 100vh;
        height: calc(var(--vh, 1vh) * 100);
        height: 100dvh; // firefox will ignore this
        display: grid;
    }

    .inner-loader {
        width: toRem(48);
        height: toRem(48);
        margin: auto;
    }
</style>

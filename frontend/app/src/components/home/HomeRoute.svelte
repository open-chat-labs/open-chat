<script module lang="ts">
    export interface HomeProps {
        showLandingPage: boolean;
    }

    export type HomeType = Component<HomeProps>;
</script>

<script lang="ts">
    import {
        anonUserStore,
        chatsInitialisedStore,
        identityStateStore,
        querystringStore,
        routeStore,
    } from "@client";
    import Loading from "@shared_components/Loading.svelte";
    import { type Component } from "svelte";
    import LandingPage from "../landingpages/LandingPage.svelte";
    import OnboardModal from "../onboard/OnboardModal.svelte";
    import Overlay from "../Overlay.svelte";
    import Home from "./Home.svelte";

    let { showLandingPage }: HomeProps = $props();

    // Initial chat readiness includes registry discovery. Anonymous home needs
    // only the welcome form, not the chat/card tree that depends on that data.
    // Keep this branch stable while signing in or discovery finishes, so an
    // in-progress form is not replaced by a second Home-owned modal.
    let anonymousHome = $derived(
        !showLandingPage &&
            $routeStore.kind === "home_route" &&
            $anonUserStore &&
            ($identityStateStore.kind === "anon" || $identityStateStore.kind === "logging_in"),
    );
    let welcomeDismissed = $state(false);
    let welcomeStarted = $state(false);
    // Home owns query-driven navigation and modals. Once requested, retain its
    // branch for this visit even after it consumes/removes the query string.
    // Do not duplicate a list of Home's current (or future) query actions here.
    let hasEntryQuery = $derived($querystringStore.toString() !== "");
    let homeEntryRequested = $state(false);
    $effect(() => {
        if (!anonymousHome) {
            welcomeDismissed = false;
            welcomeStarted = false;
            homeEntryRequested = false;
        } else if (hasEntryQuery) {
            homeEntryRequested = true;
        }
    });

    let showWelcome = $derived(
        anonymousHome &&
            !welcomeDismissed &&
            !hasEntryQuery &&
            !homeEntryRequested &&
            (!$chatsInitialisedStore ||
                welcomeStarted ||
                $identityStateStore.kind === "logging_in"),
    );

    function beginWelcome() {
        // Capture activity before auth buttons stop event propagation.
        welcomeStarted = true;
    }

    function dismissWelcome() {
        // Overlay also invokes onClose during teardown after a route/identity
        // change; that must not dismiss the next anonymous-home visit.
        if (showWelcome) welcomeDismissed = true;
    }

    let registering = $derived(
        $identityStateStore.kind === "registering" ||
            ($identityStateStore.kind === "loading_user" && $identityStateStore.registering),
    );

    let showLoader = $derived(
        !registering && (!$chatsInitialisedStore || $identityStateStore.kind === "loading_user"),
    );
</script>

{#if showLandingPage}
    <LandingPage />
{:else if showWelcome}
    <main class="welcome">
        <Overlay onClose={dismissWelcome}>
            <div
                class="welcome-form"
                role="presentation"
                onclickcapture={beginWelcome}
                onkeydowncapture={beginWelcome}
                oninputcapture={beginWelcome}
            >
                <OnboardModal onClose={dismissWelcome} />
            </div>
        </Overlay>
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
    .welcome-form {
        display: contents;
    }

    .welcome,
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

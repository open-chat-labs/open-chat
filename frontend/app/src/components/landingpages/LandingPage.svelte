<script lang="ts">
    import Router from "svelte-spa-router";
    import { wrap } from "svelte-spa-router/wrap";
    import FeaturesPage from "./FeaturesPage.svelte";
    import HomePage from "./HomePage.svelte";
    import Header from "./Header.svelte";
    import Content from "./Content.svelte";
    import { location } from "svelte-spa-router";
    import { createEventDispatcher, getContext, tick } from "svelte";
    import type { OpenChat } from "openchat-client";
    import Overlay from "../Overlay.svelte";
    import Register from "../register/Register.svelte";

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    export let referredBy: string | undefined = undefined;

    $: identityState = client.identityState;

    function scrollToTop() {
        window.scrollTo({
            behavior: "auto",
            top: 0,
        });
    }

    function routeEvent(ev: CustomEvent<string>) {
        dispatch(ev.detail);
    }

    function logout() {
        client.logout();
    }
</script>

{#if $identityState === "registering"}
    <Overlay dismissible={false}>
        <Register on:logout on:createdUser {referredBy} />
    </Overlay>
{/if}

<Header on:login={() => client.login()} on:logout={logout} />

<main class="main">
    <!-- TODO: this is a bit weird -->
    {#if $location === "/features"}
        <FeaturesPage />
    {:else}
        <Content>
            <Router
                on:routeEvent={routeEvent}
                on:routeLoaded={scrollToTop}
                routes={{
                    "/home": HomePage,
                    "/features": FeaturesPage,
                    "/roadmap": wrap({
                        asyncComponent: () => import("./RoadmapPage.svelte"),
                    }),
                    "/whitepaper": wrap({
                        asyncComponent: () => import("./WhitepaperPage.svelte"),
                    }),
                    "/architecture": wrap({
                        asyncComponent: () => import("./ArchitecturePage.svelte"),
                    }),
                    "*": HomePage,
                }} />
        </Content>
    {/if}
</main>

<style type="text/scss">
    :global(.landing-page .card) {
        --bd: var(--landing-bd);
        --collapsible-closed-header-txt: var(--landing-txt-light);
        --collapsible-open-header-arrow: var(--primary);
    }

    .main {
        position: relative;
        overflow-y: auto;
        overflow-x: hidden;
        margin: 0 auto;
        margin-top: toRem(80);
    }
</style>

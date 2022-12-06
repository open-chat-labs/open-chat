<script lang="ts">
    import Router from "svelte-spa-router";
    import FeaturesPage from "./FeaturesPage.svelte";
    import HomePage from "./HomePage.svelte";
    import Header from "./Header.svelte";
    import Content from "./Content.svelte";
    import { location } from "svelte-spa-router";
    import { createEventDispatcher, getContext } from "svelte";
    import RoadmapPage from "./RoadmapPage.svelte";
    import WhitepaperPage from "./WhitepaperPage.svelte";
    import ArchitecturePage from "./ArchitecturePage.svelte";
    import type { OpenChat } from "openchat-client";
    import Overlay from "../Overlay.svelte";
    import Register from "../register/Register.svelte";

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    export let referredBy: string | undefined;

    $: identityState = client.identityState;

    function routes(_logout: () => Promise<void>): any {
        return {
            "/home": HomePage,
            "/features": FeaturesPage,
            "/roadmap": RoadmapPage,
            "/whitepaper": WhitepaperPage,
            "/architecture": ArchitecturePage,
            "*": HomePage,
        };
    }
    function login() {
        dispatch("login");
    }

    function logout() {
        dispatch("logout");
    }

    function scrollToTop() {
        window.scrollTo({
            behavior: "auto",
            top: 0,
        });
    }

    function routeEvent(ev: CustomEvent<string>) {
        dispatch(ev.detail);
    }

    function closeModal() {}
</script>

{#if $identityState === "registering"}
    <Overlay dismissible={false}>
        <Register on:logout={logout} on:createdUser {referredBy} />
    </Overlay>
{/if}

<Header on:login={login} on:logout={logout} />

<main class="main">
    <!-- TODO: this is a bit weird -->
    {#if $location === "/features"}
        <FeaturesPage />
    {:else}
        <Content>
            <Router
                on:routeEvent={routeEvent}
                on:routeLoaded={scrollToTop}
                routes={routes(() => {
                    console.log("logout");
                    return Promise.resolve();
                })} />
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

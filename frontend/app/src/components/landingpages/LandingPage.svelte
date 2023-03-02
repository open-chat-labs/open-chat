<script lang="ts">
    import FeaturesPage from "./FeaturesPage.svelte";
    import HomePage from "./HomePage.svelte";
    import Header from "./Header.svelte";
    import Content from "./Content.svelte";
    import { location, pathParams } from "../../routes";
    import { createEventDispatcher, getContext } from "svelte";
    import type { CreatedUser, OpenChat } from "openchat-client";
    import Overlay from "../Overlay.svelte";
    import Register from "../register/Register.svelte";
    import BlogPage from "./BlogPage.svelte";
    import RoadmapPage from "./RoadmapPage.svelte";
    import WhitepaperPage from "./WhitepaperPage.svelte";
    import ArchitecturePage from "./ArchitecturePage.svelte";
    import BlogPostPage from "./BlogPostPage.svelte";

    const client = getContext<OpenChat>("client");

    export let referredBy: string | undefined = undefined;

    $: identityState = client.identityState;

    function logout() {
        client.logout();
    }

    function createdUser(ev: CustomEvent<CreatedUser>) {
        client.onCreatedUser(ev.detail);
    }

    $: console.log("LP Route: ", $location, $pathParams);
</script>

{#if $identityState === "registering"}
    <Overlay dismissible={false}>
        <Register on:logout={logout} on:createdUser={createdUser} {referredBy} />
    </Overlay>
{/if}

<Header on:login={() => client.login()} on:logout={logout} />

<main class="main">
    {#if $location.startsWith("/features")}
        <FeaturesPage />
    {:else}
        <Content>
            {#if $location.startsWith("/blog")}
                {#if $pathParams.slug !== undefined}
                    <BlogPostPage slug={$pathParams.slug} />
                {:else}
                    <BlogPage />
                {/if}
            {:else if $location.startsWith("/roadmap")}
                <RoadmapPage />
            {:else if $location.startsWith("/whitepaper")}
                <WhitepaperPage />
            {:else if $location.startsWith("/architecture")}
                <ArchitecturePage />
            {:else}
                <HomePage on:login={() => client.login()} />
            {/if}
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

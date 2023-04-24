<script lang="ts">
    import FeaturesPage from "./FeaturesPage.svelte";
    import HomePage from "./HomePage.svelte";
    import Header from "./Header.svelte";
    import Content from "./Content.svelte";
    import { location, pathParams } from "../../routes";
    import { getContext } from "svelte";
    import { CreatedUser, OPENCHAT_BOT_USER_ID, OpenChat } from "openchat-client";
    import Overlay from "../Overlay.svelte";
    import Register from "../register/Register.svelte";
    import BlogPage from "./BlogPage.svelte";
    import Loading from "../Loading.svelte";
    import { showMenuForLandingRoute } from "utils/urls";
    import page from "page";

    const client = getContext<OpenChat>("client");

    $: identityState = client.identityState;
    $: showMenu = showMenuForLandingRoute($location);

    function logout() {
        client.logout();
    }

    function createdUser(ev: CustomEvent<CreatedUser>) {
        client.onCreatedUser(ev.detail);
        if ($location.startsWith("/miami")) {
            page(`/${OPENCHAT_BOT_USER_ID}`);
        }
    }

    function showGuidelines() {
        identityState.set("dismissed_registering");
        page("/guidelines");
    }
</script>

{#if $identityState === "registering"}
    <Overlay dismissible on:close={() => identityState.set("dismissed_registering")}>
        <Register
            on:showGuidelines={showGuidelines}
            on:logout={logout}
            on:createdUser={createdUser} />
    </Overlay>
{/if}

{#if showMenu}
    <Header on:login={() => client.login()} on:logout={logout} />
{/if}

<main class="main">
    {#if $location.startsWith("/features")}
        <FeaturesPage />
    {:else}
        <Content>
            {#if $location.startsWith("/blog")}
                {#if $pathParams.slug !== undefined}
                    {#await import("./BlogPostPage.svelte")}
                        <div class="loading">
                            <Loading />
                        </div>
                    {:then { default: BlogPostPage }}
                        <BlogPostPage slug={$pathParams.slug} />
                    {/await}
                {:else}
                    <BlogPage />
                {/if}
            {:else if $location.startsWith("/roadmap")}
                {#await import("./RoadmapPage.svelte")}
                    <div class="loading">
                        <Loading />
                    </div>
                {:then { default: RoadmapPage }}
                    <RoadmapPage />
                {/await}
            {:else if $location.startsWith("/whitepaper")}
                {#await import("./WhitepaperPage.svelte")}
                    <div class="loading">
                        <Loading />
                    </div>
                {:then { default: WhitepaperPage }}
                    <WhitepaperPage />
                {/await}
            {:else if $location.startsWith("/architecture")}
                {#await import("./ArchitecturePage.svelte")}
                    <div class="loading">
                        <Loading />
                    </div>
                {:then { default: ArchitecturePage }}
                    <ArchitecturePage />
                {/await}
            {:else if $location.startsWith("/miami")}
                {#await import("./Miami.svelte")}
                    <div class="loading">
                        <Loading />
                    </div>
                {:then { default: Miami }}
                    <Miami on:login={() => client.login()} />
                {/await}
            {:else if $location.startsWith("/guidelines")}
                {#await import("./GuidelinesPage.svelte")}
                    <div class="loading">
                        <Loading />
                    </div>
                {:then { default: GuidelinesPage }}
                    <GuidelinesPage />
                {/await}
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

    .loading {
        height: calc(100vh - 5rem);
        width: 100vw;
        max-width: 1440px;
    }
</style>

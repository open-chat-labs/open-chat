<script module lang="ts">
    export type LandingPageType = Component;
</script>

<script lang="ts">
    import { app, pathState, ui, type CreatedUser, type OpenChat } from "openchat-client";
    import { getContext, type Component } from "svelte";
    import { showMenuForLandingRoute } from "../../utils/urls";
    import Loading from "../Loading.svelte";
    import Overlay from "../Overlay.svelte";
    import Register from "../register/Register.svelte";
    import BlogPage from "./BlogPage.svelte";
    import Content from "./Content.svelte";
    import FeaturesPage from "./FeaturesPage.svelte";
    import Header from "./Header.svelte";
    import HomePage from "./HomePage.svelte";
    import HostedLandingPage from "./HostedLandingPage.svelte";

    const client = getContext<OpenChat>("client");

    let showMenu = $derived(showMenuForLandingRoute(pathState.route));

    function createdUser(user: CreatedUser) {
        client.onCreatedUser(user);
    }
</script>

{#if app.identityState.kind === "registering"}
    <Overlay>
        <Register onCreatedUser={createdUser} />
    </Overlay>
{/if}

{#if ui.runningInIframe}
    <HostedLandingPage />
{:else}
    {#if showMenu}
        <Header />
    {/if}

    <main class="main">
        {#if pathState.route.kind === "features_route"}
            <FeaturesPage />
        {:else}
            <Content>
                {#if pathState.isBlogRoute(pathState.route)}
                    {#if pathState.route.slug !== undefined}
                        {#await import("./BlogPostPage.svelte")}
                            <div class="loading">
                                <Loading />
                            </div>
                        {:then { default: BlogPostPage }}
                            <BlogPostPage slug={pathState.route.slug} />
                        {/await}
                    {:else}
                        <BlogPage />
                    {/if}
                {:else if pathState.isRoadmapRoute(pathState.route)}
                    {#await import("./RoadmapPage.svelte")}
                        <div class="loading">
                            <Loading />
                        </div>
                    {:then { default: RoadmapPage }}
                        <RoadmapPage />
                    {/await}
                {:else if pathState.isWhitepaperRoute(pathState.route)}
                    {#await import("./WhitepaperPage.svelte")}
                        <div class="loading">
                            <Loading />
                        </div>
                    {:then { default: WhitepaperPage }}
                        <WhitepaperPage />
                    {/await}
                {:else if pathState.isArchitectureRoute(pathState.route)}
                    {#await import("./ArchitecturePage.svelte")}
                        <div class="loading">
                            <Loading />
                        </div>
                    {:then { default: ArchitecturePage }}
                        <ArchitecturePage />
                    {/await}
                {:else if pathState.isGuidelinesRoute(pathState.route)}
                    {#await import("./GuidelinesPage.svelte")}
                        <div class="loading">
                            <Loading />
                        </div>
                    {:then { default: GuidelinesPage }}
                        <GuidelinesPage />
                    {/await}
                {:else if pathState.isTermsRoute(pathState.route)}
                    {#await import("./TermsPage.svelte")}
                        <div class="loading">
                            <Loading />
                        </div>
                    {:then { default: TermsPage }}
                        <TermsPage />
                    {/await}
                {:else if pathState.isFaqRoute(pathState.route)}
                    {#await import("./FAQPage.svelte")}
                        <div class="loading">
                            <Loading />
                        </div>
                    {:then { default: FAQPage }}
                        <FAQPage />
                    {/await}
                {:else if pathState.isDiamondRoute(pathState.route)}
                    {#await import("./DiamondPage.svelte")}
                        <div class="loading">
                            <Loading />
                        </div>
                    {:then { default: DiamondPage }}
                        <DiamondPage />
                    {/await}
                {:else}
                    <HomePage on:login={() => client.login()} />
                {/if}
            </Content>
        {/if}
    </main>
{/if}

<style lang="scss">
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

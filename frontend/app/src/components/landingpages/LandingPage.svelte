<script lang="ts">
    import FeaturesPage from "./FeaturesPage.svelte";
    import HomePage from "./HomePage.svelte";
    import Header from "./Header.svelte";
    import Content from "./Content.svelte";
    import {
        isArchitectureRoute,
        isBlogRoute,
        isDiamondRoute,
        isFaqRoute,
        isGuidelinesRoute,
        isMiamiRoute,
        isRoadmapRoute,
        isWhitepaperRoute,
        pathParams,
    } from "../../routes";
    import { getContext, onMount } from "svelte";
    import { CreatedUser, OPENCHAT_BOT_USER_ID, OpenChat } from "openchat-client";
    import Overlay from "../Overlay.svelte";
    import Register from "../register/Register.svelte";
    import BlogPage from "./BlogPage.svelte";
    import Loading from "../Loading.svelte";
    import { showMenuForLandingRoute } from "../../utils/urls";
    import page from "page";
    import { saveSeletedTheme } from "../../theme/themes";

    const client = getContext<OpenChat>("client");

    $: identityState = client.identityState;
    $: showMenu = showMenuForLandingRoute($pathParams);
    $: miami = isMiamiRoute($pathParams);

    function logout() {
        client.logout();
    }

    function createdUser(ev: CustomEvent<CreatedUser>) {
        client.onCreatedUser(ev.detail);
        if (miami) {
            page(`/${OPENCHAT_BOT_USER_ID}`);
        }
    }

    onMount(() => {
        if (miami) {
            saveSeletedTheme("dark");
        }
    });
</script>

{#if $identityState === "registering"}
    <Overlay>
        <Register on:logout={logout} on:createdUser={createdUser} />
    </Overlay>
{/if}

{#if showMenu}
    <Header on:login={() => client.login()} on:logout={logout} />
{/if}

<main class:miami class="main">
    {#if $pathParams.kind === "features_route"}
        <FeaturesPage />
    {:else if miami}
        {#await import("./miami/Miami.svelte")}
            <div class="loading">
                <Loading />
            </div>
        {:then { default: Miami }}
            <Miami on:login={() => client.login()} />
        {/await}
    {:else}
        <Content>
            {#if isBlogRoute($pathParams)}
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
            {:else if isRoadmapRoute($pathParams)}
                {#await import("./RoadmapPage.svelte")}
                    <div class="loading">
                        <Loading />
                    </div>
                {:then { default: RoadmapPage }}
                    <RoadmapPage />
                {/await}
            {:else if isWhitepaperRoute($pathParams)}
                {#await import("./WhitepaperPage.svelte")}
                    <div class="loading">
                        <Loading />
                    </div>
                {:then { default: WhitepaperPage }}
                    <WhitepaperPage />
                {/await}
            {:else if isArchitectureRoute($pathParams)}
                {#await import("./ArchitecturePage.svelte")}
                    <div class="loading">
                        <Loading />
                    </div>
                {:then { default: ArchitecturePage }}
                    <ArchitecturePage />
                {/await}
            {:else if isGuidelinesRoute($pathParams)}
                {#await import("./GuidelinesPage.svelte")}
                    <div class="loading">
                        <Loading />
                    </div>
                {:then { default: GuidelinesPage }}
                    <GuidelinesPage />
                {/await}
            {:else if isFaqRoute($pathParams)}
                {#await import("./FAQPage.svelte")}
                    <div class="loading">
                        <Loading />
                    </div>
                {:then { default: FAQPage }}
                    <FAQPage />
                {/await}
            {:else if isDiamondRoute($pathParams)}
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

        &.miami {
            margin-top: 0;
        }
    }

    .loading {
        height: calc(100vh - 5rem);
        width: 100vw;
        max-width: 1440px;
    }
</style>

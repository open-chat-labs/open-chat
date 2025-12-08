<script module lang="ts">
    export type LandingPageType = Component;
</script>

<script lang="ts">
    import { Container } from "component-lib";
    import { identityStateStore, routeStore, type OpenChat } from "openchat-client";
    import { getContext, type Component } from "svelte";
    import Loading from "../Loading.svelte";
    import NativeOnboardModal from "../onboard/NativeOnboardModal.svelte";
    import BlogPage from "./BlogPage.svelte";
    import FeaturesPage from "./FeaturesPage.svelte";
    import HomePage from "./HomePage.svelte";

    const client = getContext<OpenChat>("client");

    let showOnboarding = $derived(
        $identityStateStore.kind === "anon" && $routeStore.kind === "home_route",
    );
</script>

<Container height={"fill"} width={"fill"} tag="main">
    <main class="main">
        {#if $routeStore.kind === "features_route"}
            <FeaturesPage />
        {:else if client.isBlogRoute($routeStore)}
            {#if $routeStore.slug !== undefined}
                {#await import("./BlogPostPage.svelte")}
                    <div class="loading">
                        <Loading />
                    </div>
                {:then { default: BlogPostPage }}
                    <BlogPostPage slug={$routeStore.slug} />
                {/await}
            {:else}
                <BlogPage />
            {/if}
        {:else if client.isRoadmapRoute($routeStore)}
            {#await import("./RoadmapPage.svelte")}
                <div class="loading">
                    <Loading />
                </div>
            {:then { default: RoadmapPage }}
                <RoadmapPage />
            {/await}
        {:else if client.isWhitepaperRoute($routeStore)}
            {#await import("./WhitepaperPage.svelte")}
                <div class="loading">
                    <Loading />
                </div>
            {:then { default: WhitepaperPage }}
                <WhitepaperPage />
            {/await}
        {:else if client.isArchitectureRoute($routeStore)}
            {#await import("./ArchitecturePage.svelte")}
                <div class="loading">
                    <Loading />
                </div>
            {:then { default: ArchitecturePage }}
                <ArchitecturePage />
            {/await}
        {:else if client.isGuidelinesRoute($routeStore)}
            {#await import("./GuidelinesPage.svelte")}
                <div class="loading">
                    <Loading />
                </div>
            {:then { default: GuidelinesPage }}
                <GuidelinesPage />
            {/await}
        {:else if client.isTermsRoute($routeStore)}
            {#await import("./TermsPage.svelte")}
                <div class="loading">
                    <Loading />
                </div>
            {:then { default: TermsPage }}
                <TermsPage />
            {/await}
        {:else if client.isFaqRoute($routeStore)}
            {#await import("./FAQPage.svelte")}
                <div class="loading">
                    <Loading />
                </div>
            {:then { default: FAQPage }}
                <FAQPage />
            {/await}
        {:else if client.isDiamondRoute($routeStore)}
            {#await import("./DiamondPage.svelte")}
                <div class="loading">
                    <Loading />
                </div>
            {:then { default: DiamondPage }}
                <DiamondPage />
            {/await}
        {:else if showOnboarding}
            {#if client.isNativeAndroid()}
                <NativeOnboardModal />
            {:else}
                <NativeOnboardModal />
                <!-- <OnboardModal
                step={modal.kind === "registering" ? "sign_up" : "select_mode"}
                onClose={closeModal} /> -->
            {/if}
        {:else}
            <HomePage on:login={() => client.login()} />
        {/if}
    </main></Container>

<style lang="scss">
    :global(.landing-page .card) {
        --bd: var(--landing-bd);
        --collapsible-closed-header-txt: var(--landing-txt-light);
        --collapsible-open-header-arrow: var(--primary);
    }

    .loading {
        height: calc(100vh - 5rem);
        width: 100vw;
        max-width: 1440px;
    }
</style>

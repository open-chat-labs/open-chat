<script lang="ts">
    import { onDestroy, onMount, SvelteComponent } from "svelte";
    import page from "page";
    import Home from "./home/HomeRoute.svelte";
    import LandingPage from "./landingpages/LandingPage.svelte";
    import NotFound from "./NotFound.svelte";
    import { pathContextStore, notFound } from "../routes";
    import { communitiesEnabled } from "../utils/features";

    let route: typeof SvelteComponent | undefined = undefined;

    onMount(() => {
        page("/home", parsePathParams, track, () => (route = LandingPage));
        page("/features", parsePathParams, track, () => (route = LandingPage));
        page("/roadmap", parsePathParams, track, () => (route = LandingPage));
        page("/blog/:slug?", parsePathParams, track, () => (route = LandingPage));
        page("/whitepaper", parsePathParams, track, () => (route = LandingPage));
        page("/miami", parsePathParams, track, () => (route = LandingPage));
        page("/guidelines", parsePathParams, track, () => (route = LandingPage));
        page("/faq", parsePathParams, track, () => (route = LandingPage));
        page("/diamond", parsePathParams, track, () => (route = LandingPage));
        page("/architecture", parsePathParams, track, () => (route = LandingPage));
        if ($communitiesEnabled) {
            // this is for explore mode
            page(
                "/communities/:communityId?",
                redirectHashRoutes,
                parsePathParams,
                track,
                () => (route = Home)
            );
        }
        page("/hotgroups", redirectHashRoutes, parsePathParams, track, () => (route = Home));
        page(
            "/:chatId?/:messageIndex?/:threadMessageIndex?",
            redirectHashRoutes,
            parsePathParams,
            track,
            () => (route = Home)
        );
        page("*", () => {
            notFound.set(true);
            route = NotFound;
        });
        page.start();
    });

    onDestroy(() => page.stop());

    function scrollToTop() {
        window.scrollTo({
            behavior: "auto",
            top: 0,
        });
    }

    function redirectHashRoutes(ctx: PageJS.Context, next: () => any) {
        if (ctx.canonicalPath.startsWith("/#/")) {
            page.redirect(ctx.canonicalPath.slice(2));
        } else {
            next();
        }
    }

    function track(ctx: PageJS.Context, next: () => any) {
        console.debug("GA: page_view", ctx.pathname);
        gtag("event", "page_view", {
            page_location: ctx.pathname,
        });
        next();
    }

    function parsePathParams(ctx: PageJS.Context, next: () => any) {
        notFound.set(false);
        pathContextStore.set(ctx);
        scrollToTop();
        next();
    }
</script>

{#if route !== undefined}
    <svelte:component this={route} />
{/if}

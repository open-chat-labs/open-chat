<script lang="ts">
    import { onDestroy, onMount, SvelteComponent } from "svelte";
    import page from "page";
    import Home from "./home/HomeRoute.svelte";
    import LandingPage from "./landingpages/LandingPage.svelte";
    import NotFound from "./NotFound.svelte";
    import { pathContextStore, notFound } from "../routes";

    let route: typeof SvelteComponent | undefined = undefined;

    onMount(() => {
        page("/home", parsePathParams, () => (route = LandingPage));
        page("/features", parsePathParams, () => (route = LandingPage));
        page("/roadmap", parsePathParams, () => (route = LandingPage));
        page("/blog/:slug?", parsePathParams, () => (route = LandingPage));
        page("/whitepaper", parsePathParams, () => (route = LandingPage));
        page("/architecture", parsePathParams, () => (route = LandingPage));
        page(
            "/:chatId?/:messageIndex?/:threadMessageIndex?",
            redirectHashRoutes,
            parsePathParams,
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

<style type="text/scss">
</style>

<script lang="ts">
    import { onDestroy, onMount, SvelteComponent } from "svelte";
    import page from "page";
    import Home from "./home/HomeRoute.svelte";
    import LandingPage from "./landingpages/LandingPage.svelte";
    import NotFound from "./NotFound.svelte";
    import {
        pathContextStore,
        notFound,
        RouteParams,
        pathParams,
        communitesRoute,
        blogRoute,
        shareRoute,
        globalDirectChatSelectedRoute,
        globalGroupChatSelectedRoute,
        selectedCommunityRoute,
        selectedChannelRoute,
        chatListRoute,
    } from "../routes";
    import { communitiesEnabled } from "../utils/features";

    let route: typeof SvelteComponent | undefined = undefined;

    function parsePathParams(fn: (ctx: PageJS.Context) => RouteParams) {
        return (ctx: PageJS.Context, next: () => any) => {
            notFound.set(false);
            pathContextStore.set(ctx);
            pathParams.set(fn(ctx));
            scrollToTop();
            next();
        };
    }

    onMount(() => {
        page(
            "/home",
            parsePathParams(() => ({ kind: "home_landing_route" })),
            track,
            () => (route = LandingPage)
        );
        page(
            "/features",
            parsePathParams(() => ({ kind: "features_route" })),
            track,
            () => (route = LandingPage)
        );
        page(
            "/roadmap",
            parsePathParams(() => ({ kind: "roadmap_route" })),
            track,
            () => (route = LandingPage)
        );
        page("/blog/:slug?", parsePathParams(blogRoute), track, () => (route = LandingPage));
        page(
            "/whitepaper",
            parsePathParams(() => ({ kind: "whitepaper_route" })),
            track,
            () => (route = LandingPage)
        );
        page(
            "/miami",
            parsePathParams(() => ({ kind: "miami_route" })),
            track,
            () => (route = LandingPage)
        );
        page(
            "/guidelines",
            parsePathParams(() => ({ kind: "guidelines_route" })),
            track,
            () => (route = LandingPage)
        );
        page(
            "/faq",
            parsePathParams(() => ({ kind: "faq_route" })),
            track,
            () => (route = LandingPage)
        );
        page(
            "/diamond",
            parsePathParams(() => ({ kind: "diamond_route" })),
            track,
            () => (route = LandingPage)
        );
        page(
            "/architecture",
            parsePathParams(() => ({ kind: "architecture_route" })),
            track,
            () => (route = LandingPage)
        );
        // this is for explore mode
        page("/communities", parsePathParams(communitesRoute), track, () => (route = Home));
        // global direct chats
        page(
            "/user",
            parsePathParams(chatListRoute({ kind: "direct_chat" })),
            track,
            () => (route = Home)
        );
        // global direct chat selected
        page(
            "/user/:chatId/:messageIndex?/:threadMessageIndex?",
            parsePathParams(
                globalDirectChatSelectedRoute(
                    $communitiesEnabled ? { kind: "direct_chat" } : { kind: "none" }
                )
            ),
            track,
            () => (route = Home)
        );
        // global group chats
        page(
            "/group",
            parsePathParams(chatListRoute({ kind: "group_chat" })),
            track,
            () => (route = Home)
        );
        // global group chat selected
        page(
            "/group/:chatId/:messageIndex?/:threadMessageIndex?",
            parsePathParams(
                globalGroupChatSelectedRoute(
                    $communitiesEnabled ? { kind: "group_chat" } : { kind: "none" }
                )
            ),
            track,
            () => (route = Home)
        );
        // selected community group
        page(
            "/community/:communityId",
            parsePathParams(selectedCommunityRoute),
            track,
            () => (route = Home)
        );
        // selected community channel
        page(
            "/community/:communityId/channel/:channelId/:messageIndex?/:threadMessageIndex?",
            parsePathParams(selectedChannelRoute(false)),
            track,
            () => (route = Home)
        );
        // favourites
        page(
            "/favourite",
            parsePathParams(chatListRoute({ kind: "favourite" })),
            track,
            () => (route = Home)
        );
        // selected global group favourite
        page(
            "/favourite/group/:chatId/:messageIndex?/:threadMessageIndex?",
            parsePathParams(globalGroupChatSelectedRoute({ kind: "favourite" })),
            track,
            () => (route = Home)
        );
        // selected global direct favourite
        page(
            "/favourite/user/:chatId/:messageIndex?/:threadMessageIndex?",
            parsePathParams(globalDirectChatSelectedRoute({ kind: "favourite" })),
            track,
            () => (route = Home)
        );
        // selected favourite channel
        page(
            "/favourite/community/:communityId/channel/:channelId/:messageIndex?/:threadMessageIndex?",
            parsePathParams(selectedChannelRoute(true)),
            track,
            () => (route = Home)
        );
        page("/share", parsePathParams(shareRoute), track, () => (route = Home));
        page(
            "/groups",
            parsePathParams(() => ({
                kind: "explore_groups_route",
                scope: $communitiesEnabled ? { kind: "group_chat" } : { kind: "none" },
            })),
            track,
            () => (route = Home)
        );
        page(
            "/",
            parsePathParams(() => ({ kind: "home_route", scope: { kind: "none" } })),
            track,
            () => (route = Home)
        );
        // legacy route
        page(
            "/:chatId/:messageIndex?/:threadMessageIndex?",
            parsePathParams(
                globalGroupChatSelectedRoute(
                    $communitiesEnabled ? { kind: "group_chat" } : { kind: "none" }
                )
            ),
            track,
            () => (route = Home)
        );
        page(
            "*",
            parsePathParams(() => ({ kind: "not_found_route" })),
            () => {
                notFound.set(true);
                route = NotFound;
            }
        );
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
</script>

{#if route !== undefined}
    <svelte:component this={route} />
{/if}

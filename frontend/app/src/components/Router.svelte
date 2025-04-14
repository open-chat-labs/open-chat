<script lang="ts">
    import {
        type RouteParams,
        adminRoute,
        blogRoute,
        chatListRoute,
        communitesRoute,
        globalDirectChatSelectedRoute,
        globalGroupChatSelectedRoute,
        pathState,
        selectedChannelRoute,
        selectedCommunityRoute,
        shareRoute,
    } from "openchat-client";
    import page from "page";
    import { onDestroy, onMount } from "svelte";
    import Home, { type HomeType } from "./home/HomeRoute.svelte";
    import LandingPage, { type LandingPageType } from "./landingpages/LandingPage.svelte";
    import NotFound, { type NotFoundType } from "./NotFound.svelte";

    interface Props {
        showLandingPage: boolean;
    }

    let { showLandingPage }: Props = $props();

    let route: HomeType | LandingPageType | NotFoundType | undefined = $state(undefined);

    function parsePathParams(fn: (ctx: PageJS.Context) => RouteParams) {
        return (ctx: PageJS.Context, next: () => any) => {
            pathState.setRouteParams(ctx, fn(ctx));
            scrollToTop();
            next();
        };
    }

    onMount(() => {
        page(
            "/home",
            parsePathParams(() => ({ kind: "home_landing_route", scope: { kind: "none" } })),
            track,
            () => (route = LandingPage),
        );
        page(
            "/features",
            parsePathParams(() => ({ kind: "features_route", scope: { kind: "none" } })),
            track,
            () => (route = LandingPage),
        );
        page(
            "/roadmap",
            parsePathParams(() => ({ kind: "roadmap_route", scope: { kind: "none" } })),
            track,
            () => (route = LandingPage),
        );
        page("/blog/:slug?", parsePathParams(blogRoute), track, () => (route = LandingPage));
        page(
            "/whitepaper",
            parsePathParams(() => ({ kind: "whitepaper_route", scope: { kind: "none" } })),
            track,
            () => (route = LandingPage),
        );
        page(
            "/guidelines",
            parsePathParams(() => ({ kind: "guidelines_route", scope: { kind: "none" } })),
            track,
            () => (route = LandingPage),
        );
        page(
            "/terms",
            parsePathParams(() => ({ kind: "terms_route", scope: { kind: "none" } })),
            track,
            () => (route = LandingPage),
        );
        page(
            "/faq",
            parsePathParams(() => ({ kind: "faq_route", scope: { kind: "none" } })),
            track,
            () => (route = LandingPage),
        );
        page(
            "/diamond",
            parsePathParams(() => ({ kind: "diamond_route", scope: { kind: "none" } })),
            track,
            () => (route = LandingPage),
        );
        page(
            "/architecture",
            parsePathParams(() => ({ kind: "architecture_route", scope: { kind: "none" } })),
            track,
            () => (route = LandingPage),
        );
        // this is for explore mode
        page("/communities", parsePathParams(communitesRoute), track, () => (route = Home));
        // global direct chats
        page(
            "/user",
            parsePathParams(chatListRoute({ kind: "direct_chat" })),
            track,
            () => (route = Home),
        );
        // global direct chat selected
        page(
            "/user/:chatId/:messageIndex?/:threadMessageIndex?",
            parsePathParams(globalDirectChatSelectedRoute({ kind: "direct_chat" })),
            track,
            () => (route = Home),
        );
        // global group chats
        page(
            "/group",
            parsePathParams(chatListRoute({ kind: "group_chat" })),
            track,
            () => (route = Home),
        );
        // global group chat selected
        page(
            "/group/:chatId/:messageIndex?/:threadMessageIndex?",
            parsePathParams(globalGroupChatSelectedRoute({ kind: "group_chat" })),
            track,
            () => (route = Home),
        );
        // selected community group
        page(
            "/community/:communityId",
            parsePathParams(selectedCommunityRoute),
            track,
            () => (route = Home),
        );
        // selected community channel
        page(
            "/community/:communityId/channel/:channelId/:messageIndex?/:threadMessageIndex?",
            parsePathParams(selectedChannelRoute(false)),
            track,
            () => (route = Home),
        );
        // favourites
        page(
            "/favourite",
            parsePathParams(chatListRoute({ kind: "favourite" })),
            track,
            () => (route = Home),
        );
        // selected global group favourite
        page(
            "/favourite/group/:chatId/:messageIndex?/:threadMessageIndex?",
            parsePathParams(globalGroupChatSelectedRoute({ kind: "favourite" })),
            track,
            () => (route = Home),
        );
        // selected global direct favourite
        page(
            "/favourite/user/:chatId/:messageIndex?/:threadMessageIndex?",
            parsePathParams(globalDirectChatSelectedRoute({ kind: "favourite" })),
            track,
            () => (route = Home),
        );
        // selected favourite channel
        page(
            "/favourite/community/:communityId/channel/:channelId/:messageIndex?/:threadMessageIndex?",
            parsePathParams(selectedChannelRoute(true)),
            track,
            () => (route = Home),
        );
        page("/share", parsePathParams(shareRoute), track, () => (route = Home));
        page(
            "/groups",
            parsePathParams(() => ({
                kind: "explore_groups_route",
                scope: { kind: "group_chat" },
            })),
            track,
            () => (route = Home),
        );
        page("/admin", parsePathParams(adminRoute), track, () => (route = Home));
        page(
            "/",
            parsePathParams(() => ({ kind: "home_route", scope: { kind: "none" } })),
            track,
            () => (route = Home),
        );
        // legacy route
        page(
            "/:chatId/:messageIndex?/:threadMessageIndex?",
            parsePathParams(globalGroupChatSelectedRoute({ kind: "group_chat" })),
            track,
            () => (route = Home),
        );
        page(
            "*",
            parsePathParams(() => ({ kind: "not_found_route", scope: { kind: "none" } })),
            () => {
                pathState.notFound = true;
                route = NotFound;
            },
        );
        page.start();

        pathState.routerReady = true;
    });

    onDestroy(() => page.stop());

    function scrollToTop() {
        window.scrollTo({
            behavior: "auto",
            top: 0,
        });
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
    {@const RouteComponent = route}
    <RouteComponent {showLandingPage} />
{/if}

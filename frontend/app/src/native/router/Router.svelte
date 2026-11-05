<!-- The native tree's router: registers the route table the web tree has (utils/routeTable) with
     page.js, so both read the same URLs, keeps the route stores up to date through
     client.setRouteParams, and runs the route effects every new tree runs (core/RouteEffects). Where
     each route is in the tabs is the child's (router/locations.ts, the shell).
     A native app's cold start: the native setup registers its listeners before svelteReady
     (utils/native/nativeApp), and what they park (an answered call, a deep link, a notification tap)
     is opened here as soon as it lands once the chats are in. -->
<script lang="ts">
    import RouteEffects from "@src/core/RouteEffects.svelte";
    import {
        flushPendingNavigation,
        initNavigationHistoryTracking,
        navigate,
    } from "@src/utils/navigation";
    import { redirectTable, routeTable } from "@src/utils/routeTable";
    import { handleLinkClick } from "@src/utils/urls";
    import { runCallAction } from "@utils/native/call_bridge";
    import { coldStartIntents, consumeColdStartIntent } from "@utils/native/coldStart.svelte";
    import { openDeepLink } from "@utils/native/notification_channels";
    import {
        chatsInitialisedStore,
        notFoundStore,
        OpenChat,
        routerReadyStore,
        routeStore,
        subscribe,
        type RouteParams,
    } from "@client";
    import page from "page";
    import { getContext, onMount, untrack, type Snippet } from "svelte";

    let { children }: { children: Snippet } = $props();

    const client = getContext<OpenChat>("client");

    function parsePathParams(fn: (ctx: PageJS.Context) => RouteParams) {
        return (ctx: PageJS.Context, next: () => void) => {
            client.setRouteParams(ctx, fn(ctx));
            next();
        };
    }

    function track(ctx: PageJS.Context, next: () => void) {
        gtag("event", "page_view", { page_location: ctx.pathname });
        next();
    }

    onMount(() => {
        const onLinkClick = handleLinkClick(client, navigate);
        document.addEventListener("click", onLinkClick, { capture: true });

        for (const { path, to } of redirectTable) {
            page(path, (ctx) => page.redirect(to(ctx.params)));
        }
        for (const { path, parse } of routeTable) {
            // not found isn't a page view, as in the existing routers
            const tracking = path === "*" ? [] : [track];
            page(path, parsePathParams(parse), ...tracking, () => {
                notFoundStore.set(path === "*");
            });
        }
        page.start({ click: false });
        const stopHistoryTracking = initNavigationHistoryTracking();
        // navigate() waits for the modal stack to close before it goes anywhere
        const unsubscribe = subscribe("closeModalStack", flushPendingNavigation);
        routerReadyStore.set(true);

        return () => {
            unsubscribe();
            stopHistoryTracking();
            document.removeEventListener("click", onLinkClick, { capture: true });
            page.stop();
        };
    });

    // What a cold start parked (an answered native ring, else a deep link, else a notification
    // tap: coldStart.svelte.ts), opened as soon as it lands once the chats are in and "/" has gone
    // to its chat list, whatever the user is looking at by then. The parked intents are reactive,
    // so one that lands after this first looks is still opened at once, not on some later visit.
    $effect(() => {
        if (
            $chatsInitialisedStore &&
            $routeStore.kind !== "home_route" &&
            coldStartIntents.pending
        ) {
            untrack(openColdStartIntent);
        }
    });

    function openColdStartIntent() {
        const intent = consumeColdStartIntent();
        switch (intent?.kind) {
            case "call":
                runCallAction(intent.action);
                break;
            case "deep_link":
                // a landing page link opens outside the app (openDeepLink), leaving the list
                openDeepLink(intent.url);
                break;
            case "notification":
                navigate(intent.path, "notification");
                break;
        }
    }
</script>

<RouteEffects />

{@render children()}

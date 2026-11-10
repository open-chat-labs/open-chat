<!-- The new web UI's router: registers the route table (utils/routeTable, shared with the native
     tree) with page.js, keeps the route stores (routeStore, selectedChatIdStore …) up to date
     through client.setRouteParams, and runs the route effects the existing trees run
     (core/RouteEffects, shared with the native tree, and the web's own), so the client sees the
     same calls. What each route renders is decided by the child, from routeStore. -->
<script lang="ts">
    import {
        chatListScopeStore,
        chatsInitialisedStore,
        chatSummariesListStore,
        lastSelectedChatByScopeStore,
        exploringStore,
        notFoundStore,
        OpenChat,
        querystringStore,
        routeForScope,
        routerReadyStore,
        selectedChatIdStore,
        setRightPanelHistory,
        subscribe,
        type RouteParams,
    } from "@client";
    import {
        flushPendingNavigation,
        initNavigationHistoryTracking,
        navigate,
    } from "@src/utils/navigation";
    import { handleLinkClick, inEditor, withoutQueryStringParams } from "@src/utils/urls";
    import page from "page";
    import { getContext, onMount, untrack, type Snippet } from "svelte";
    import { currentShellLayout } from "../shell/viewport.svelte";
    import { defaultChatRoute, defaultChatUrl } from "./defaultChat";
    import { redirectTable, routeTable } from "@src/utils/routeTable";
    import { leftToBrowser } from "./links";
    import { shareQuery } from "../features/app/dialogs";
    import RouteEffects from "@src/core/RouteEffects.svelte";
    import { askToSignIn, GUEST_HOME } from "@src/logic/auth/guestPass";

    let { children }: { children: Snippet } = $props();

    const client = getContext<OpenChat>("client");

    function parsePathParams(fn: (ctx: PageJS.Context) => RouteParams) {
        return (ctx: PageJS.Context, next: () => void) => {
            client.setRouteParams(ctx, fn(ctx));
            // instant: "auto" would follow a page's own smooth scrolling (Landing's)
            window.scrollTo({ behavior: "instant", top: 0 });
            next();
        };
    }

    function track(ctx: PageJS.Context, next: () => void) {
        gtag("event", "page_view", { page_location: ctx.pathname });
        next();
    }

    onMount(() => {
        const routeLink = handleLinkClick(client, navigate);
        // a link to a fragment of the page it's on is the browser's: it scrolls there (not one in
        // an editor, a non-editable chip in one included, which the shared handler holds)
        const onLinkClick = (e: MouseEvent) => {
            const anchor = e.target instanceof Element ? e.target.closest("a") : null;
            if (anchor?.href && leftToBrowser(anchor.href, inEditor(anchor), window.location)) {
                return;
            }
            routeLink(e);
        };
        document.addEventListener("click", onLinkClick, { capture: true });

        for (const { path, to } of redirectTable) {
            page(path, (ctx) => page.redirect(to(ctx.params)));
        }
        for (const { path, parse } of routeTable) {
            // not found isn't a page view, as in the existing router
            const tracking = path === "*" ? [] : [track];
            page(path, parsePathParams(parse), ...tracking, () => {
                notFoundStore.set(path === "*");
            });
        }
        page.start({ click: false });
        const stopHistoryTracking = initNavigationHistoryTracking();
        // navigate() waits for the modal stack to close before it goes anywhere.
        // the app's own dialogs close on the same event, in DialogHost
        const unsubscribe = subscribe("closeModalStack", flushPendingNavigation);
        routerReadyStore.set(true);

        return () => {
            unsubscribe();
            stopHistoryTracking();
            document.removeEventListener("click", onLinkClick, { capture: true });
            page.stop();
        };
    });

    // The existing desktop router's effects, shared with the native tree, are core/RouteEffects;
    // these are the web's own.

    // A chat list with nothing selected goes to its default chat (ROUTES.md, decision 7): the one
    // last opened in its scope, else its first, once there is one, with its thread list
    // (?threads) open too. Only that chat's route is tracked (and whether the screen is narrow,
    // where there's none), so other summary changes don't re-run it. The URL's query (an open
    // overlay, the thread list) is kept.
    const defaultChatPath = $derived(
        defaultChatRoute(
            $chatListScopeStore.kind,
            $chatSummariesListStore,
            $lastSelectedChatByScopeStore.get($chatListScopeStore),
            currentShellLayout().narrow,
        ),
    );
    $effect(() => {
        if (
            defaultChatPath !== undefined &&
            $selectedChatIdStore === undefined &&
            $chatListScopeStore.kind !== "none" &&
            !$exploringStore
        ) {
            untrack(selectDefaultChat);
        }
    });

    function selectDefaultChat() {
        if (defaultChatPath !== undefined) {
            navigate(defaultChatUrl(defaultChatPath, location.search), "auto");
        }
    }

    // What's left of Home.svelte's route handling (the rest is RouteEffects'), once the chats are in
    function onRoute(route: RouteParams) {
        if (route.kind === "profile_summary_route") {
            // mobile's profile path: the profile is a dialog over the page here (?profile)
            navigate(`${routeForScope(client.getDefaultScope())}?profile`, "auto");
            return;
        }
        if (client.isHomeRoute(route)) {
            client.filterRightPanelHistory((panel) => panel.kind === "user_profile");
        } else if (client.isShareRoute(route)) {
            // what another app shared: the chat picker over the default page (?share), which
            // puts it in the chosen chat's draft
            navigate(`${routeForScope(client.getDefaultScope())}${shareQuery(route)}`, "auto");
        }
    }

    // A guest who went to a page that needs an account (ROUTES.md, the Guest column) is asked to
    // sign in over Explore, in its place in history, and goes on to the page once signed in
    // (AppScreen). Closing the sign-in leaves them on Explore.
    function onGuestSignIn() {
        askToSignIn(client, `${location.pathname}${location.search}`);
        navigate(GUEST_HOME, "auto");
    }

    // The query params that open something (ROUTES.md), handled once the chats are in, each on its
    // own as Home.svelte does, then the URL is tidied with a single navigation
    $effect(() => {
        if (!$chatsInitialisedStore) return;
        void $querystringStore;
        untrack(() => {
            // from the URL itself: querystringStore is built from page.js's decoded query string,
            // where an encoded value (?faq=a%26b) has already been split apart
            const qs = new URLSearchParams(window.location.search);
            const handled: string[] = [];
            if (qs.get("everyone") !== null) {
                setRightPanelHistory([{ kind: "show_group_members" }]);
                handled.push("everyone");
            }
            const usergroup = qs.get("usergroup");
            if (usergroup !== null) {
                setRightPanelHistory([
                    { kind: "show_community_members", userGroupId: Number(usergroup) },
                ]);
                handled.push("usergroup");
            }
            const faq = qs.get("faq");
            if (faq !== null) {
                navigate(`/faq?q=${encodeURIComponent(faq)}`);
            } else if (qs.get("wallet") !== null) {
                // the wallet is a route of its own here, not a modal
                navigate("/wallet");
            } else if (handled.length > 0) {
                navigate(withoutQueryStringParams(handled));
            }
            // ?profile, ?diamond, ?chit and ?hof stay: they're dialogs over the page (DialogHost)
        });
    });
</script>

<RouteEffects onPreviewWithoutChat={selectDefaultChat} {onRoute} {onGuestSignIn} />

{@render children()}

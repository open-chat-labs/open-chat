<script lang="ts">
    import { removeQueryStringParam } from "@src/utils/urls";
    import {
        type ChatIdentifier,
        OpenChat,
        type RouteParams,
        type TransitionType,
        adminRoute,
        blogRoute,
        chatIdentifiersEqual,
        chatListRoute,
        chatListScopeStore,
        chatsInitialisedStore,
        communitesRoute,
        exploringStore,
        globalDirectChatSelectedRoute,
        globalGroupChatSelectedRoute,
        messageIndexStore,
        notFoundStore,
        notificationsRoute,
        pageReplace,
        profileSummaryRoute,
        routeKindStore,
        routeStore,
        routerReadyStore,
        selectedChannelRoute,
        selectedChatIdStore,
        selectedCommunityIdStore,
        selectedCommunityRoute,
        selectedServerChatStore,
        shareRoute,
        threadMessageIndexStore,
        threadOpenStore,
    } from "openchat-client";
    import page from "page";
    import { getContext, onDestroy, onMount, tick, untrack } from "svelte";
    import Home, { type HomeType } from "./home/HomeRoute.svelte";
    import LandingPage, { type LandingPageType } from "./landingpages/LandingPage.svelte";
    import NotFound, { type NotFoundType } from "./NotFound.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        showLandingPage: boolean;
    }

    let { showLandingPage }: Props = $props();

    const bottomBarRoutes: RouteParams["kind"][] = [
        "chat_list_route",
        "selected_community_route",
        "notifications_route",
        "profile_summary_route",
    ];

    function routeToTransitionType(next: RouteParams, current: RouteParams): TransitionType {
        const nextIdx = bottomBarRoutes.indexOf(next.kind);
        const currIdx = bottomBarRoutes.indexOf(current.kind);
        if (nextIdx === currIdx) return "fade";
        if (nextIdx === -1 || currIdx === -1) return "fade";
        return nextIdx > currIdx ? "slide_left" : "slide_right";
    }

    let route: HomeType | LandingPageType | NotFoundType | undefined = $state(undefined);

    function parsePathParams(fn: (ctx: PageJS.Context) => RouteParams) {
        return (ctx: PageJS.Context, next: () => any) => {
            const params = fn(ctx);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if (ctx.init || !(document as any).startViewTransition) {
                client.setRouteParams(ctx, params);
                scrollToTop();
                next();
                return;
            }

            // Finally - we are in a position to specify the *type* of transition
            const transitionType = routeToTransitionType(params, routeStore.value);
            console.log("Transition Type: ", transitionType);
            (document as any).startViewTransition({
                update: async () => {
                    client.setRouteParams(ctx, params);
                    scrollToTop();
                    await tick();
                    next();
                },
                types: [transitionType],
            });
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
        // global direct chat selected
        page(
            "/user/:chatId/:messageIndex?/:threadMessageIndex?",
            parsePathParams(globalDirectChatSelectedRoute({ kind: "chats" })),
            track,
            () => (route = Home),
        );
        // global group chat selected
        page(
            "/group/:chatId/:messageIndex?/:threadMessageIndex?",
            parsePathParams(globalGroupChatSelectedRoute({ kind: "chats" })),
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
        // global direct and group chats
        page(
            "/chats",
            parsePathParams(chatListRoute({ kind: "chats" })),
            track,
            () => (route = Home),
        );
        page(
            "/chats/user/:chatId/:messageIndex?/:threadMessageIndex?",
            parsePathParams(globalDirectChatSelectedRoute({ kind: "chats" })),
            track,
            () => (route = Home),
        );
        page(
            "/chats/group/:chatId/:messageIndex?/:threadMessageIndex?",
            parsePathParams(globalGroupChatSelectedRoute({ kind: "chats" })),
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
        page("/admin", parsePathParams(adminRoute), track, () => (route = Home));
        page("/profile_summary", parsePathParams(profileSummaryRoute), track, () => (route = Home));
        page("/notifications", parsePathParams(notificationsRoute), track, () => (route = Home));
        page(
            "/",
            parsePathParams(() => ({ kind: "home_route", scope: { kind: "none" } })),
            track,
            () => (route = Home),
        );
        // legacy route
        page(
            "/:chatId/:messageIndex?/:threadMessageIndex?",
            parsePathParams(globalGroupChatSelectedRoute({ kind: "chats" })),
            track,
            () => (route = Home),
        );
        page(
            "*",
            parsePathParams(() => ({ kind: "not_found_route", scope: { kind: "none" } })),
            () => {
                notFoundStore.set(true);
                route = NotFound;
            },
        );

        page.start();

        routerReadyStore.set(true);
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

    // This is where our general effects are going to go. They don't *really* belong in a component at all
    // but unfortunately unowned effects do not respond to store value changes

    // Set selected community
    $effect(() => {
        if ($chatsInitialisedStore && $selectedCommunityIdStore !== undefined) {
            const id = $selectedCommunityIdStore;

            // this untrack is not really necessary in this case but it's probably a good pattern to follow to
            // make double sure we are only reacting to the things we want to react to
            untrack(() => {
                client.setSelectedCommunity(id).then((preview) => {
                    if (preview && $selectedChatIdStore === undefined) {
                        // if we are previewing the community we need to select the first chat manually
                        client.selectDefaultChat();
                    }
                });
            });
        }
    });

    $effect(() => {
        if (client.captureReferralCode()) {
            pageReplace(removeQueryStringParam("ref"));
        }
    });

    let previousChatId: ChatIdentifier | undefined = undefined;
    $effect(() => {
        if (
            $threadOpenStore &&
            $messageIndexStore !== undefined &&
            $selectedChatIdStore !== undefined &&
            chatIdentifiersEqual(previousChatId, $selectedChatIdStore)
        ) {
            const chatId = $selectedChatIdStore;
            const idx = $messageIndexStore;
            const threadIdx = $threadMessageIndexStore;
            untrack(() => {
                client.openThreadFromMessageIndex(chatId, idx, threadIdx);
            });
        }
        previousChatId = $selectedChatIdStore;
    });

    $effect(() => {
        if (!$threadOpenStore) {
            untrack(() => {
                client.filterRightPanelHistory((panel) => panel.kind !== "message_thread_panel");
            });
        }
    });

    $effect(() => {
        if (
            $selectedChatIdStore === undefined &&
            $chatListScopeStore.kind !== "none" &&
            !$exploringStore
        ) {
            client.selectDefaultChat();
        }
    });

    // Set selected chat
    $effect(() => {
        // we have to be *so* careful with the reactivity here. Is this actually better?
        if (
            $chatsInitialisedStore &&
            $selectedChatIdStore !== undefined &&
            ($routeKindStore === "selected_channel_route" ||
                $routeKindStore === "global_chat_selected_route")
        ) {
            untrack(() => {
                if (
                    $routeStore.kind === "selected_channel_route" ||
                    $routeStore.kind === "global_chat_selected_route"
                ) {
                    const id = $selectedChatIdStore;
                    const messageIndex = $routeStore.messageIndex;
                    const threadMessageIndex = $routeStore.threadMessageIndex;
                    if (id !== undefined) {
                        client.setSelectedChat(id, messageIndex, threadMessageIndex);
                    }
                }
            });
        }
    });

    // clear selected chat
    $effect(() => {
        if ($selectedChatIdStore === undefined) {
            selectedServerChatStore.set(undefined);
        }
    });
</script>

{#if route !== undefined}
    {@const RouteComponent = route}
    <RouteComponent {showLandingPage} />
{/if}

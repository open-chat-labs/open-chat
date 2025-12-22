<script lang="ts">
    import { removeQueryStringParam } from "@src/utils/urls";
    import type { TransitionType } from "component-lib";
    import {
        type ChatIdentifier,
        OpenChat,
        type RouteParams,
        adminRoute,
        chatIdentifiersEqual,
        chatListRoute,
        chatListScopeStore,
        chatsInitialisedStore,
        communitesRoute,
        communitiesStore,
        communityIdentifiersEqual,
        exploringStore,
        globalDirectChatSelectedRoute,
        globalGroupChatSelectedRoute,
        isMessageIndexRoute,
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
        walletRoute,
        welcomeRoute,
    } from "openchat-client";
    import page from "page";
    import { type Component, getContext, onDestroy, onMount, tick, untrack } from "svelte";
    import Home from "./home/HomeRoute.svelte";
    import NotFound from "./NotFound.svelte";
    import { expectBackPress } from "../utils/native/notification_channels";

    const client = getContext<OpenChat>("client");

    const bottomBarRoutes: RouteParams["kind"][] = [
        "chat_list_route",
        "selected_community_route",
        "welcome_route",
        "favourites_route",
        "notifications_route",
        "wallet_route",
        "profile_summary_route",
        "global_chat_selected_route",
        "selected_channel_route",
    ];

    function disambiguateRouteKind(route: RouteParams): RouteParams["kind"] {
        if (route.kind === "chat_list_route" && route.scope.kind === "favourite") {
            return "favourites_route";
        }
        return route.kind;
    }

    function routeToTransitionType(next: RouteParams, current: RouteParams): TransitionType {
        if (
            isMessageIndexRoute(next) &&
            isMessageIndexRoute(current) &&
            chatIdentifiersEqual(next.chatId, current.chatId)
        ) {
            // we don't want to slide when opening and closing threads because
            // threads are implemented as sliding modals
            // we have opened a thread
            if (next.open && !current.open) {
                return "fade";
            }
            // we have closed a thread
            if (!next.open && current.open) {
                return "fade";
            }
        }
        if (
            next.kind === "selected_community_route" &&
            current.kind === "selected_community_route"
        ) {
            if (communityIdentifiersEqual(next.communityId, current.communityId)) {
                return "fade";
            }
            const nextCommunity = $communitiesStore.get(next.communityId);
            const currentCommunity = $communitiesStore.get(current.communityId);
            if (nextCommunity !== undefined && currentCommunity !== undefined) {
                return nextCommunity.membership.index > currentCommunity.membership.index
                    ? "slide_right"
                    : "slide_left";
            }
            return "fade";
        }
        const nextIdx = bottomBarRoutes.indexOf(disambiguateRouteKind(next));
        const currIdx = bottomBarRoutes.indexOf(disambiguateRouteKind(current));
        if (nextIdx === currIdx) return "fade";
        if (nextIdx === -1 || currIdx === -1) return "fade";
        return nextIdx > currIdx ? "slide_left" : "slide_right";
    }

    let route: Component | undefined = $state(undefined);

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
        // Expect user to press back in the app, handle that behaviour here.
        if (client.isNativeApp()) {
            expectBackPress(() => history.back()).catch(console.error);
        }

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
        page("/welcome", parsePathParams(welcomeRoute), track, () => (route = Home));
        page("/wallet", parsePathParams(walletRoute), track, () => (route = Home));
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
        /**
         * The purpose of this effect is to capture the thread open when we click a thread when we already have a chat open
         * Therefore this will not run when we click on a thread preview (because at that point both previousChatId will be undefined)
         */
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
            previousChatId = undefined;
        }
    });
</script>

{#if route !== undefined}
    {@const RouteComponent = route}
    <RouteComponent />
{/if}

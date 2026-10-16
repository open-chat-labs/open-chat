<!-- The new web UI's router: registers routeTable with page.js, keeps the route stores
     (routeStore, selectedChatIdStore …) up to date through client.setRouteParams, and runs the
     route effects the existing trees run, so the client sees the same calls. What each route
     renders is decided by the child, from routeStore. -->
<script lang="ts">
    import {
        anonUserStore,
        chatIdentifiersEqual,
        chatListScopeStore,
        chatsInitialisedStore,
        communityIdentifiersEqual,
        exploringStore,
        messageIndexStore,
        notFoundStore,
        OpenChat,
        querystringStore,
        routeForScope,
        routeKindStore,
        routerReadyStore,
        routeStore,
        selectedChatIdStore,
        selectedCommunityIdStore,
        setRightPanelHistory,
        subscribe,
        threadMessageIndexStore,
        threadOpenStore,
        type ChatIdentifier,
        type CommunityIdentifier,
        type RouteParams,
    } from "@client";
    import {
        flushPendingNavigation,
        initNavigationHistoryTracking,
        navigate,
    } from "@src/utils/navigation";
    import { handleLinkClick, removeQueryStringParam } from "@src/utils/urls";
    import page from "page";
    import { getContext, onMount, untrack, type Snippet } from "svelte";
    import { routeTable } from "./routeTable";

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

        for (const { path, parse } of routeTable) {
            page(path, parsePathParams(parse), track, () => {
                notFoundStore.set(path === "*");
            });
        }
        page.start({ click: false });
        const stopHistoryTracking = initNavigationHistoryTracking();
        // navigate() waits for the modal stack to close before it goes anywhere.
        // TODO(phase 4): close the shell's dialogs first, as Home.svelte does
        const unsubscribe = subscribe("closeModalStack", flushPendingNavigation);
        routerReadyStore.set(true);

        return () => {
            unsubscribe();
            stopHistoryTracking();
            document.removeEventListener("click", onLinkClick, { capture: true });
            page.stop();
        };
    });

    // The rest are the existing desktop router's effects (components/Router.svelte) and
    // Home.svelte's route handling, so the client sees the same calls in this tree.

    // Drop a previewed community once we navigate away from it
    let previousCommunityId: CommunityIdentifier | undefined = undefined;
    $effect(() => {
        const id = $selectedCommunityIdStore;
        untrack(() => {
            if (
                previousCommunityId !== undefined &&
                !communityIdentifiersEqual(previousCommunityId, id)
            ) {
                client.removeCommunityIfPreviewing(previousCommunityId);
            }
            previousCommunityId = id;
        });
    });

    // Load the selected community
    $effect(() => {
        if ($chatsInitialisedStore && $selectedCommunityIdStore !== undefined) {
            const id = $selectedCommunityIdStore;
            untrack(() => {
                client.setSelectedCommunity(id).then((preview) => {
                    // a previewed community's first channel has to be selected by hand
                    if (preview && $selectedChatIdStore === undefined) {
                        client.selectDefaultChat();
                    }
                });
            });
        }
    });

    $effect(() => {
        if (client.captureReferralCode()) {
            navigate(removeQueryStringParam("ref"));
        }
    });

    // A thread opened from the URL in the chat that's already selected
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
            untrack(() => client.openThreadFromMessageIndex(chatId, idx, threadIdx));
        }
        previousChatId = $selectedChatIdStore;
    });

    $effect(() => {
        if (!$threadOpenStore) {
            untrack(() =>
                client.filterRightPanelHistory((panel) => panel.kind !== "message_thread_panel"),
            );
        }
    });

    // A chat list with nothing selected goes to its last (or first) chat. A thread list stays.
    $effect(() => {
        if (
            $selectedChatIdStore === undefined &&
            $chatListScopeStore.kind !== "none" &&
            $routeKindStore !== "threads_route" &&
            !$exploringStore
        ) {
            client.selectDefaultChat();
        }
    });

    // Select the chat the route names
    $effect(() => {
        if (
            $chatsInitialisedStore &&
            $selectedChatIdStore !== undefined &&
            ($routeKindStore === "selected_channel_route" ||
                $routeKindStore === "global_chat_selected_route")
        ) {
            untrack(() => {
                const route = $routeStore;
                if (
                    route.kind === "selected_channel_route" ||
                    route.kind === "global_chat_selected_route"
                ) {
                    const id = $selectedChatIdStore;
                    if (id !== undefined) {
                        client.setSelectedChat(id, route.messageIndex, route.threadMessageIndex);
                    }
                }
            });
        }
    });

    // Home.svelte's route change handling
    $effect(() => {
        const initialised = $chatsInitialisedStore;
        const route = $routeStore;
        untrack(() => {
            if (!initialised) return;
            client.filterRightPanelHistory((panel) => panel.kind !== "community_filters");
            if (
                $anonUserStore &&
                client.isChatListRoute(route) &&
                route.scope.kind === "favourite"
            ) {
                client.updateIdentityState({ kind: "logging_in" });
                navigate("/chats");
                return;
            }
            if (client.setChatListScopeAndRedirect(route)) return;
            if (client.isHomeRoute(route)) {
                client.filterRightPanelHistory((panel) => panel.kind === "user_profile");
            } else if (client.isShareRoute(route)) {
                // TODO(phase 5): pick the chat to share into (ChatPicker), as Home.svelte does
                navigate(routeForScope(client.getDefaultScope()));
            }
        });
    });

    // The query params that open something (ROUTES.md), handled once the chats are in
    $effect(() => {
        if (!$chatsInitialisedStore) return;
        const qs = $querystringStore;
        untrack(() => {
            const faq = qs.get("faq");
            if (faq !== null) {
                navigate(`/faq?q=${faq}`);
            } else if (qs.get("wallet") !== null) {
                // the wallet is a route of its own here, not a modal
                navigate("/wallet");
            } else if (qs.get("everyone") !== null) {
                setRightPanelHistory([{ kind: "show_group_members" }]);
                navigate(removeQueryStringParam("everyone"));
            } else if (qs.get("usergroup") !== null) {
                const userGroupId = Number(qs.get("usergroup"));
                setRightPanelHistory([{ kind: "show_community_members", userGroupId }]);
                navigate(removeQueryStringParam("usergroup"));
            }
            // TODO(phase 8): ?diamond, ?hof and ?chit open their dialogs
        });
    });
</script>

{@render children()}

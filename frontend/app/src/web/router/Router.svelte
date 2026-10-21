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
        chatSummariesListStore,
        lastSelectedChatByScopeStore,
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
    import {
        handleLinkClick,
        inEditor,
        removeQueryStringParam,
        withoutQueryStringParams,
    } from "@src/utils/urls";
    import page from "page";
    import { getContext, onMount, untrack, type Snippet } from "svelte";
    import { currentShellLayout } from "../shell/viewport.svelte";
    import { defaultChatRoute, defaultChatUrl } from "./defaultChat";
    import { redirectTable, routeTable } from "./routeTable";
    import { leftToBrowser } from "./links";

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
            untrack(() => loadCommunity(id));
        }
    });

    async function loadCommunity(id: CommunityIdentifier) {
        const preview = await client.setSelectedCommunity(id);
        // a previewed community's first channel has to be selected by hand
        if (preview && $selectedChatIdStore === undefined) {
            selectDefaultChat();
        }
    }

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
            if (route.kind === "profile_summary_route") {
                // mobile's profile path: the profile is a dialog over the page here (?profile)
                navigate(`${routeForScope(client.getDefaultScope())}?profile`, "auto");
                return;
            }
            if (client.isHomeRoute(route)) {
                client.filterRightPanelHistory((panel) => panel.kind === "user_profile");
            } else if (client.isShareRoute(route)) {
                // TODO(phase 5): pick the chat to share into (ChatPicker), as Home.svelte does
                navigate(routeForScope(client.getDefaultScope()));
            }
        });
    });

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
                setRightPanelHistory([{ kind: "show_community_members", userGroupId: Number(usergroup) }]);
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
            // TODO(phase 8): ?diamond, ?hof and ?chit open their dialogs
        });
    });
</script>

{@render children()}

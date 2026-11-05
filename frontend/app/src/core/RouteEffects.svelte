<!-- The route effects every new tree runs (src/web's router and src/native's), so the client sees the
     same calls whichever tree is mounted. They're the existing desktop router's
     (components/Router.svelte) and Home.svelte's route handling; the legacy trees keep their own
     copies until they go. Renders nothing.
     What a tree does on top: `onPreviewWithoutChat` when a previewed community opens with no channel
     selected (the web selects its default chat), and `onRoute` for each route once the chats are in
     and the shared handling hasn't redirected it (the web's ?profile and ?share). -->
<script lang="ts">
    import {
        anonUserStore,
        chatIdentifiersEqual,
        chatsInitialisedStore,
        communityIdentifiersEqual,
        messageIndexStore,
        OpenChat,
        routeKindStore,
        routeStore,
        selectedChatIdStore,
        selectedCommunityIdStore,
        threadMessageIndexStore,
        threadOpenStore,
        type ChatIdentifier,
        type CommunityIdentifier,
        type RouteParams,
    } from "@client";
    import { navigate } from "@src/utils/navigation";
    import { removeQueryStringParam } from "@src/utils/urls";
    import { getContext, untrack } from "svelte";

    let {
        onPreviewWithoutChat,
        onRoute,
    }: {
        onPreviewWithoutChat?: () => void;
        onRoute?: (route: RouteParams) => void;
    } = $props();

    const client = getContext<OpenChat>("client");

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
            onPreviewWithoutChat?.();
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
            onRoute?.(route);
        });
    });
</script>

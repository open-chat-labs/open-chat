<script lang="ts">
    import {
        type ChatSummary,
        type CommunitySummary,
        type OpenChat,
        type CombinedUnreadCounts,
        type UserLookup,
        routeForChatIdentifier,
        type ChatListScope,
        userStore,
        chatListScopeStore,
        globalUnreadCount,
        selectedChatStore,
        selectedCommunity,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { mobileOperatingSystem } from "../utils/devices";
    import { location } from "../routes";

    const client = getContext<OpenChat>("client");

    let viewPortContent = "width=device-width, initial-scale=1";

    $: details = getDetails(
        $chatListScopeStore,
        $location,
        $userStore,
        $globalUnreadCount,
        $selectedChatStore,
        $selectedCommunity,
    );

    type Details = {
        title: string;
        icon: string;
        description: string;
        canonicalUrl: URL;
    };

    function getDetails(
        scope: ChatListScope,
        location: string,
        users: UserLookup,
        unread: CombinedUnreadCounts,
        chat: ChatSummary | undefined,
        community: CommunitySummary | undefined,
    ): Details {
        let canonicalUrl = new URL("/", window.location.origin);
        let title = "OpenChat";
        let description =
            "OpenChat is a fully featured chat application running end-to-end on the Internet Computer blockchain.";

        if (location === "/communities") {
            canonicalUrl = new URL("/communities", window.location.origin);
        }

        if (community !== undefined) {
            title = `${title} - ${community.name}`;
            description = community.description;
            canonicalUrl = new URL(
                `/community/${community.id.communityId}`,
                window.location.origin,
            );
        }
        if (chat !== undefined) {
            if (chat.kind === "direct_chat") {
                title = `${title} - 
                    ${
                        users.get(chat.them.userId)?.displayName ??
                        users.get(chat.them.userId)?.username ??
                        "Direct chat"
                    }`;
            } else {
                title = `${title} - ${chat.name}`;
                description = chat.description;
                canonicalUrl = new URL(
                    routeForChatIdentifier(scope.kind, chat.id),
                    window.location.origin,
                );
            }
        }
        const merged = client.mergeCombinedUnreadCounts(unread);
        return {
            title: merged.unmuted > 0 ? `(${merged.unmuted}) ${title}` : title,
            description,
            icon: merged.unmuted > 0 ? "/icon-unread.png" : "/icon.png",
            canonicalUrl,
        };
    }

    onMount(() => {
        if (mobileOperatingSystem === "iOS") {
            viewPortContent += ", maximum-scale=1";
        }
    });
</script>

<svelte:head>
    <title>{details.title}</title>
    <meta name="viewport" content={viewPortContent} />
    <link rel="icon" type="image/png" href={details.icon} />
    <link rel="canonical" href={details.canonicalUrl.toString()} />
    <meta name="description" content={details.description} />
    <meta property="og:title" content={details.title} />
    <meta property="og:description" content={details.description} />
</svelte:head>

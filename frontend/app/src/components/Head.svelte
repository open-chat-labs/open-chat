<script lang="ts">
    import type {
        ChatSummary,
        CommunitySummary,
        OpenChat,
        CombinedUnreadCounts,
        UserLookup,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { mobileOperatingSystem } from "../utils/devices";

    const client = getContext<OpenChat>("client");

    let viewPortContent = "width=device-width, initial-scale=1";

    $: userStore = client.userStore;
    $: selectedChatStore = client.selectedChatStore;
    $: selectedCommunity = client.selectedCommunity;
    $: globalUnreadCount = client.globalUnreadCount;
    $: details = getDetails($userStore, $globalUnreadCount, $selectedChatStore, $selectedCommunity);

    type Details = {
        title: string;
        icon: string;
        description: string;
    };

    function getDetails(
        users: UserLookup,
        unread: CombinedUnreadCounts,
        chat: ChatSummary | undefined,
        community: CommunitySummary | undefined
    ): Details {
        let title = "OpenChat";
        let description =
            "OpenChat is a fully featured chat application running end-to-end on the Internet Computer blockchain.";
        if (community !== undefined) {
            title = `${title} - ${community.name}`;
            description = community.description;
        }
        if (chat !== undefined) {
            if (chat.kind === "direct_chat") {
                title = `${title} - 
                    ${
                        users[chat.them.userId]?.displayName ??
                        users[chat.them.userId]?.username ??
                        "Direct chat"
                    }`;
            } else {
                title = `${title} - ${chat.name}`;
                description = chat.description;
            }
        }
        const merged = client.mergeCombinedUnreadCounts(unread);
        return {
            title: merged.unmuted > 0 ? `(${merged.unmuted}) ${title}` : title,
            description,
            icon: merged.unmuted > 0 ? "/icon-unread.png" : "/icon.png",
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
    <meta name="description" content={details.description} />
    <meta property="og:title" content={details.title} />
    <meta property="og:description" content={details.description} />
</svelte:head>

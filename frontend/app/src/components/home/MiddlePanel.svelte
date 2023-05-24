<script lang="ts">
    import Panel from "../Panel.svelte";
    import Loading from "../Loading.svelte";
    import { fade } from "svelte/transition";
    import NoChatSelected from "./NoChatSelected.svelte";
    import RecommendedGroups from "./RecommendedGroups.svelte";
    import ExploreCommunities from "./communities/explore/Explore.svelte";
    import type CurrentChatMessages from "./CurrentChatMessages.svelte";
    import CurrentChat from "./CurrentChat.svelte";
    import type { GroupChatSummary, OpenChat } from "openchat-client";
    import { pathParams } from "../../routes";
    import { getContext } from "svelte";
    import CommunitySummary from "./communities/explore/CommunityChannels.svelte";

    const client = getContext<OpenChat>("client");

    export let loadingChats: boolean = false;
    export let joining: GroupChatSummary | undefined;
    export let currentChatMessages: CurrentChatMessages | undefined;

    $: selectedChatStore = client.selectedChatStore;
    $: selectedChatId = client.selectedChatId;
    $: eventsStore = client.eventsStore;
    $: filteredProposalsStore = client.filteredProposalsStore;
    $: noChat = $pathParams.kind !== "chat_selected_route";
</script>

<Panel middle>
    {#if $pathParams.kind === "hot_groups_route"}
        <RecommendedGroups {joining} on:joinGroup on:leaveGroup on:upgrade />
    {:else if $pathParams.kind === "communities_route"}
        <ExploreCommunities />
    {:else if loadingChats}
        <Loading />
    {:else if $selectedChatId === undefined}
        {#if noChat}
            <div class="no-chat" in:fade>
                <NoChatSelected on:newchat />
            </div>
        {/if}
    {:else if $selectedChatStore !== undefined}
        <CurrentChat
            bind:currentChatMessages
            {joining}
            chat={$selectedChatStore}
            events={$eventsStore}
            filteredProposals={$filteredProposalsStore}
            on:unblockUser
            on:clearSelection
            on:blockUser
            on:leaveGroup
            on:replyPrivatelyTo
            on:showInviteUsers
            on:showGroupDetails
            on:showProposalFilters
            on:showMembers
            on:chatWith
            on:joinGroup
            on:upgrade
            on:cancelPreview
            on:showPinned
            on:toggleMuteNotifications
            on:goToMessageIndex
            on:forward />
    {/if}
</Panel>

<style type="text/scss">
    .no-chat {
        height: 100%;
    }
</style>

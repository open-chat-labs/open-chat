<script lang="ts">
    import Panel from "../Panel.svelte";
    import { fade } from "svelte/transition";
    import NoChatSelected from "./NoChatSelected.svelte";
    import RecommendedGroups from "./RecommendedGroups.svelte";
    import ExploreCommunities from "./communities/explore/Explore.svelte";
    import type CurrentChatMessages from "./CurrentChatMessages.svelte";
    import CurrentChat from "./CurrentChat.svelte";
    import type { MultiUserChat, OpenChat } from "openchat-client";
    import { pathParams } from "../../routes";
    import { getContext } from "svelte";
    import AcceptRulesWrapper from "./AcceptRulesWrapper.svelte";

    const client = getContext<OpenChat>("client");

    export let joining: MultiUserChat | undefined;
    export let currentChatMessages: CurrentChatMessages | undefined;

    $: selectedChatStore = client.selectedChatStore;
    $: selectedChatId = client.selectedChatId;
    $: eventsStore = client.eventsStore;
    $: filteredProposalsStore = client.filteredProposalsStore;
    $: noChat = $pathParams.kind !== "global_chat_selected_route";
</script>

<Panel middle>
    {#if $pathParams.kind === "explore_groups_route"}
        <RecommendedGroups {joining} on:joinGroup on:leaveGroup on:upgrade />
    {:else if $pathParams.kind === "communities_route"}
        <ExploreCommunities on:upgrade on:createCommunity />
    {:else if $selectedChatId === undefined}
        {#if noChat}
            <div class="no-chat" in:fade>
                <NoChatSelected on:newchat />
            </div>
        {/if}
    {:else if $selectedChatStore !== undefined}
        <AcceptRulesWrapper
            let:sendMessageWithAttachment
            let:forwardMessage
            let:retrySend
            let:sendMessageWithContent
            messageContext={{ chatId: $selectedChatStore.id }}>
            <CurrentChat
                bind:currentChatMessages
                {joining}
                chat={$selectedChatStore}
                events={$eventsStore}
                filteredProposals={$filteredProposalsStore}
                on:successfulImport
                on:clearSelection
                on:leaveGroup
                on:replyPrivatelyTo
                on:showInviteGroupUsers
                on:showProposalFilters
                on:showGroupMembers
                on:chatWith
                on:joinGroup
                on:upgrade
                on:toggleMuteNotifications
                on:goToMessageIndex
                on:convertGroupToCommunity
                on:retrySend={retrySend}
                on:sendMessageWithContent={sendMessageWithContent}
                on:sendMessageWithAttachment={sendMessageWithAttachment}
                on:forwardMessage={forwardMessage}
                on:forward />
        </AcceptRulesWrapper>
    {/if}
</Panel>

<style lang="scss">
    .no-chat {
        height: 100%;
    }
</style>

<script lang="ts">
    import { communitiesEnabled } from "utils/features";
    import Panel from "../Panel.svelte";
    import ChatList from "./ChatList.svelte";
    import type { GroupSearchResponse, UserSummary } from "openchat-client";
    import LeftNav from "./nav/LeftNav.svelte";

    export let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    export let userSearchResults: Promise<UserSummary[]> | undefined = undefined;
    export let searchTerm: string = "";
    export let searching: boolean = false;
    export let searchResultsAvailable: boolean = false;
</script>

{#if communitiesEnabled}
    <Panel nav>
        <LeftNav
            on:profile
            on:wallet
            on:halloffame
            on:logout
            on:newGroup
            on:showHomePage
            on:upgrade
            on:whatsHot />
    </Panel>
{/if}

<Panel left>
    <div class="chat-list">
        <ChatList
            on:loadMessage
            on:chatWith
            on:whatsHot
            on:halloffame
            on:showHomePage
            on:newGroup
            on:profile
            on:logout
            on:searchEntered
            on:deleteDirectChat
            on:pinChat
            on:unpinChat
            on:archiveChat
            on:unarchiveChat
            on:wallet
            on:upgrade
            on:toggleMuteNotifications
            {searchResultsAvailable}
            {searchTerm}
            {searching}
            {groupSearchResults}
            {userSearchResults} />
    </div>
</Panel>

<style type="text/scss">
    .chat-list {
        display: flex;
        flex-direction: column;
        height: 100%;
    }
</style>

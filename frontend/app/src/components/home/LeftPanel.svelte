<script lang="ts">
    import Panel from "../Panel.svelte";
    import ChatList from "./ChatList.svelte";
    import type { GroupSearchResponse, UserSummary } from "openchat-client";

    export let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    export let userSearchResults: Promise<UserSummary[]> | undefined = undefined;
    export let searchTerm: string = "";
    export let searching: boolean = false;
    export let searchResultsAvailable: boolean = false;
</script>

<Panel left>
    <div class="chat-list">
        <ChatList
            on:loadMessage
            on:chatWith
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
            on:browseChannels
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

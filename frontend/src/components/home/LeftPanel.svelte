<script lang="ts">
    import Panel from "../Panel.svelte";
    import ChatList from "./ChatList.svelte";
    import type {
        GroupSearchResponse,
        SearchAllMessagesResponse,
    } from "../../domain/search/search";
    import type { CreatedUser, UserSummary } from "../../domain/user/user";

    export let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    export let userSearchResults: Promise<UserSummary[]> | undefined = undefined;
    export let messageSearchResults: Promise<SearchAllMessagesResponse> | undefined = undefined;
    export let searchTerm: string = "";
    export let searching: boolean = false;
    export let searchResultsAvailable: boolean = false;
    export let user: CreatedUser;

    // TODO - this component doesn't do anything now. We could remove it but it might be a useful abstraction
</script>

<Panel left>
    <div class="chat-list">
        <ChatList
            on:loadMessage
            on:chatWith
            on:showRoadmap
            on:showArchitecture
            on:showFeatures
            on:showWhitepaper
            on:showFaq
            on:showAbout
            on:userAvatarSelected
            on:whatsHot
            on:newGroup
            on:profile
            on:logout
            on:searchEntered
            on:deleteDirectChat
            on:pinChat
            on:unpinChat
            on:archiveChat
            on:unarchiveChat
            on:toggleMuteNotifications
            createdUser={user}
            {searchResultsAvailable}
            {searchTerm}
            {searching}
            {groupSearchResults}
            {userSearchResults}
            {messageSearchResults} />
    </div>
</Panel>

<style type="text/scss">
    .chat-list {
        display: flex;
        flex-direction: column;
        height: 100%;
    }
</style>

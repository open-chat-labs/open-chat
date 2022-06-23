<script lang="ts">
    import Panel from "../Panel.svelte";
    import ChatList from "./ChatList.svelte";
    import type {
        GroupSearchResponse,
        SearchAllMessagesResponse,
    } from "../../domain/search/search";
    import type { CreatedUser, UserSummary } from "../../domain/user/user";
    import { unsubscribeNotifications } from "../../utils/notifications";
    import type { ServiceContainer } from "../../services/serviceContainer";
    import type { MessageReadTracker } from "../../stores/markRead";

    export let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    export let userSearchResults: Promise<UserSummary[]> | undefined = undefined;
    export let messageSearchResults: Promise<SearchAllMessagesResponse> | undefined = undefined;
    export let searchTerm: string = "";
    export let searching: boolean = false;
    export let searchResultsAvailable: boolean = false;
    export let api: ServiceContainer;
    export let user: CreatedUser;
    export let messagesRead: MessageReadTracker;

    $: userId = user.userId;

    // TODO - this component doesn't do anything now. We could remove it but it might be a useful abstraction
</script>

<Panel left>
    <div class="chat-list">
        <ChatList
            on:loadMessage
            on:chatWith
            on:showRoadmap
            on:showFaq
            on:showAbout
            on:userAvatarSelected
            on:unsubscribeNotifications={() => unsubscribeNotifications(api, userId)}
            on:whatsHot
            on:newGroup
            on:profile
            on:logout
            on:searchEntered
            on:deleteDirectChat
            createdUser={user}
            {messagesRead}
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

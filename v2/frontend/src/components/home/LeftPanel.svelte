<script lang="ts">
    import Panel from "../Panel.svelte";
    import ChatList from "./ChatList.svelte";
    import NewGroup from "./addgroup/AddGroup.controller.svelte";
    import type {
        GroupSearchResponse,
        SearchAllMessagesResponse,
    } from "../../domain/search/search";
    import type { UserSummary } from "../../domain/user/user";
    import type { HomeController } from "../../fsm/home.controller";
    import type { Version } from "../../domain/version";

    export let controller: HomeController;
    export let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    export let userSearchResults: Promise<UserSummary[]> | undefined = undefined;
    export let messageSearchResults: Promise<SearchAllMessagesResponse> | undefined = undefined;
    export let searchTerm: string = "";
    export let searching: boolean = false;
    export let searchResultsAvailable: boolean = false;
    export let wasmVersion: Version;

    $: api = controller.api;
    $: currentUser = controller.user;

    let addingGroup = false;
</script>

<Panel left>
    <div class="new-group" class:addingGroup>
        <NewGroup
            {api}
            {currentUser}
            on:cancelNewGroup={() => (addingGroup = false)}
            on:groupCreated={() => (addingGroup = false)} />
    </div>
    <div class="chat-list" class:addingGroup>
        <ChatList
            on:loadMessage
            on:chatWith
            on:whatsHot
            on:newGroup={() => (addingGroup = true)}
            on:logout
            on:searchEntered
            on:deleteDirectChat
            {searchResultsAvailable}
            {searchTerm}
            {searching}
            {groupSearchResults}
            {userSearchResults}
            {messageSearchResults}
            {controller}
            {wasmVersion} />
    </div>
</Panel>

<style type="text/scss">
    .new-group,
    .chat-list {
        display: flex;
        flex-direction: column;
        height: 100%;
    }
    .new-group {
        display: none;
        &.addingGroup {
            display: flex;
        }
    }
    .chat-list {
        &.addingGroup {
            display: none;
        }
    }
</style>

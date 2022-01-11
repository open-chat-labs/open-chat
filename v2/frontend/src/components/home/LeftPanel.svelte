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

    export let controller: HomeController;
    export let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    export let userSearchResults: Promise<UserSummary[]> | undefined = undefined;
    export let messageSearchResults: Promise<SearchAllMessagesResponse> | undefined = undefined;
    export let searchTerm: string = "";
    export let searching: boolean = false;
    export let searchResultsAvailable: boolean = false;

    $: api = controller.api;
    $: currentUser = controller.user;

    let addingGroup: boolean = false;
</script>

<Panel left>
    {#if addingGroup}
        <NewGroup
            {api}
            {currentUser}
            on:cancelNewGroup={() => (addingGroup = false)}
            on:groupCreated={() => (addingGroup = false)} />
    {:else}
        <ChatList
            on:loadMessage
            on:chatWith
            on:whatsHot
            on:newGroup={() => (addingGroup = true)}
            on:logout
            on:searchEntered
            {searchResultsAvailable}
            {searchTerm}
            {searching}
            {groupSearchResults}
            {userSearchResults}
            {messageSearchResults}
            {controller} />
    {/if}
</Panel>

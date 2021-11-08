<script lang="ts">
    import Panel from "../Panel.svelte";
    import ChatList from "./ChatList.svelte";
    import NewGroup from "./addgroup/AddGroup.controller.svelte";
    import type { ActorRefFrom } from "xstate";
    import type { HomeMachine } from "../../fsm/home.machine";
    import type {
        GroupSearchResponse,
        SearchAllMessagesResponse,
    } from "../../domain/search/search";
    import type { UserSummary } from "../../domain/user/user";

    export let machine: ActorRefFrom<HomeMachine>;
    export let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    export let userSearchResults: Promise<UserSummary[]> | undefined = undefined;
    export let messageSearchResults: Promise<SearchAllMessagesResponse> | undefined = undefined;
    export let searchTerm: string = "";
    export let searching: boolean = false;
    export let searchResultsAvailable: boolean = false;

    $: api = $machine.context.serviceContainer!;
    let addingGroup: boolean = false;
</script>

<Panel left>
    {#if addingGroup}
        <NewGroup
            {api}
            on:cancelNewGroup={() => (addingGroup = false)}
            on:groupCreated={() => (addingGroup = false)} />
    {:else}
        <ChatList
            on:loadMessage
            on:chatWith
            on:newGroup={() => (addingGroup = true)}
            on:logout
            on:searchEntered
            {searchResultsAvailable}
            {searchTerm}
            {searching}
            {groupSearchResults}
            {userSearchResults}
            {messageSearchResults}
            {machine} />
    {/if}
</Panel>

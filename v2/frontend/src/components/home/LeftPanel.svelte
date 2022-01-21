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

    let view: "showing-chat-list" | "adding-group" | "showing-profile" = "showing-chat-list";
</script>

<Panel left>
    <div class="new-group" class:adding-group={view === "adding-group"}>
        <NewGroup
            {api}
            {currentUser}
            on:cancelNewGroup={() => (view = "showing-chat-list")}
            on:groupCreated={() => (view = "showing-chat-list")} />
    </div>
    <div class="chat-list" class:showing-chat-list={view === "showing-chat-list"}>
        <ChatList
            on:loadMessage
            on:chatWith
            on:whatsHot
            on:newGroup={() => (view = "adding-group")}
            on:profile={() => (view = "showing-profile")}
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
    <div class="profile" class:showing-profile={view === "showing-profile"}>User profile</div>
</Panel>

<style type="text/scss">
    .new-group,
    .chat-list {
        display: none;
        flex-direction: column;
        height: 100%;
    }
    .new-group {
        &.adding-group {
            display: flex;
        }
    }
    .chat-list {
        &.showing-chat-list {
            display: flex;
        }
    }
    .profile {
        &.showing-profile {
            display: flex;
        }
    }
</style>

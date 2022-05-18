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
    import { unsubscribeNotifications } from "../../utils/notifications";
    import type { GroupChatSummary } from "../../domain/chat/chat";
    import { trackEvent } from "../../utils/tracking";

    export let controller: HomeController;
    export let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    export let userSearchResults: Promise<UserSummary[]> | undefined = undefined;
    export let messageSearchResults: Promise<SearchAllMessagesResponse> | undefined = undefined;
    export let searchTerm: string = "";
    export let searching: boolean = false;
    export let searchResultsAvailable: boolean = false;

    $: api = controller.api;
    $: currentUser = controller.user;
    $: userId = controller.user!.userId;

    let view: "showing-chat-list" | "adding-group" = "showing-chat-list";

    function groupCreated(ev: CustomEvent<GroupChatSummary>) {
        controller.addOrReplaceChat(ev.detail);
        view = "showing-chat-list";
        if (ev.detail.public) {
            trackEvent("public_group_created");
        } else {
            trackEvent("private_group_created");
        }
    }
</script>

<Panel left>
    <div class="new-group" class:adding-group={view === "adding-group"}>
        <NewGroup
            {currentUser}
            on:cancelNewGroup={() => (view = "showing-chat-list")}
            on:groupCreated={groupCreated} />
    </div>
    <div class="chat-list" class:showing-chat-list={view === "showing-chat-list"}>
        <ChatList
            on:loadMessage
            on:chatWith
            on:showRoadmap
            on:showFaq
            on:showAbout
            on:userAvatarSelected
            on:unsubscribeNotifications={() => unsubscribeNotifications(api, userId)}
            on:whatsHot
            on:newGroup={() => (view = "adding-group")}
            on:profile
            on:logout
            on:searchEntered
            on:deleteDirectChat
            {searchResultsAvailable}
            {searchTerm}
            {searching}
            {groupSearchResults}
            {userSearchResults}
            {messageSearchResults}
            {controller} />
    </div>
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
</style>

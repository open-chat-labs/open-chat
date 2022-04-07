<script lang="ts">
    import Panel from "../Panel.svelte";
    import ChatList from "./ChatList.svelte";
    import NewGroup from "./addgroup/AddGroup.controller.svelte";
    import UserProfile from "./profile/UserProfile.svelte";
    import type {
        GroupSearchResponse,
        SearchAllMessagesResponse,
    } from "../../domain/search/search";
    import type { UserSummary } from "../../domain/user/user";
    import type { HomeController } from "../../fsm/home.controller";
    import { userStore } from "../../stores/user";
    import { nullUser } from "../../domain/user/user.utils";
    import { unsubscribeNotifications } from "../../utils/notifications";
    import type { GroupChatSummary } from "domain/chat/chat";

    export let controller: HomeController;
    export let groupSearchResults: Promise<GroupSearchResponse> | undefined = undefined;
    export let userSearchResults: Promise<UserSummary[]> | undefined = undefined;
    export let messageSearchResults: Promise<SearchAllMessagesResponse> | undefined = undefined;
    export let searchTerm: string = "";
    export let searching: boolean = false;
    export let searchResultsAvailable: boolean = false;

    let profileComponent: UserProfile;

    $: api = controller.api;
    $: currentUser = controller.user;
    $: userId = controller.user!.userId;
    $: user = controller.user ? $userStore[controller.user?.userId] : nullUser("unknown");

    let view: "showing-chat-list" | "adding-group" | "showing-profile" = "showing-chat-list";

    export function showProfile() {
        view = "showing-profile";
        profileComponent.reset();
    }

    function groupCreated(ev: CustomEvent<GroupChatSummary>) {
        controller.addOrReplaceChat(ev.detail);
        view = "showing-chat-list";
    }

    function userAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>): void {
        controller.updateUserAvatar({
            blobData: ev.detail.data,
            blobUrl: ev.detail.url,
        });
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
            on:userAvatarSelected={userAvatarSelected}
            on:unsubscribeNotifications={() => unsubscribeNotifications(api, userId)}
            on:whatsHot
            on:newGroup={() => (view = "adding-group")}
            on:profile={showProfile}
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
    <div class="profile" class:showing-profile={view === "showing-profile"}>
        <UserProfile
            bind:this={profileComponent}
            on:unsubscribeNotifications={() => unsubscribeNotifications(api, userId)}
            on:upgrade
            on:showFaqQuestion
            {user}
            on:userAvatarSelected={userAvatarSelected}
            on:closeProfile={() => (view = "showing-chat-list")} />
    </div>
</Panel>

<style type="text/scss">
    .left-wrapper {
        height: 100%;
        padding-left: $sp3;
    }

    .new-group,
    .profile,
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

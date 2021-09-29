<script lang="ts">
    import Panel from "../Panel.svelte";
    import ChatList from "./ChatList.svelte";
    import NewChat from "./NewChat.svelte";
    import NewGroup from "./NewGroup.svelte";
    import ChooseParticipants from "./ChooseParticipants.svelte";
    import JoinGroup from "./JoinGroup.svelte";
    import type { ActorRefFrom } from "xstate";
    import type { HomeMachine } from "../../fsm/home.machine";
    import type { AddGroupMachine } from "../../fsm/addgroup.machine";
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

    $: addGroupMachine = $machine.children.addGroupMachine as ActorRefFrom<AddGroupMachine>;

    $: joiningGroup = $machine.matches({ loaded_chats: "join_group" });

    $: newChat = $machine.matches({ loaded_chats: "new_chat" });

    $: newGroup =
        addGroupMachine !== undefined &&
        $addGroupMachine.matches({ data_collection: "group_form" });

    $: choosingParticipants =
        addGroupMachine !== undefined &&
        ($addGroupMachine.matches({ data_collection: "choosing_participants" }) ||
            $addGroupMachine.matches({ data_collection: "adding_participants" }));
</script>

<Panel left>
    {#if newChat}
        <NewChat {machine} />
    {:else if newGroup}
        <NewGroup machine={addGroupMachine} />
    {:else if choosingParticipants}
        <ChooseParticipants machine={addGroupMachine} />
    {:else if joiningGroup}
        <JoinGroup {machine} />
    {:else}
        <ChatList
            on:loadMessage
            on:chatWith
            on:newGroup
            on:newchat
            on:joinGroup
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

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

    export let machine: ActorRefFrom<HomeMachine>;

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
        <ChatList on:chatWith on:newGroup on:newchat on:joinGroup on:logout {machine} />
    {/if}
</Panel>

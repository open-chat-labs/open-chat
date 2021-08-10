<script lang="ts">
    import Panel from "../Panel.svelte";
    import ChatList from "./ChatList.svelte";
    import NewChat from "./NewChat.svelte";
    import NewGroup from "./NewGroup.svelte";
    import ChooseParticipants from "./ChooseParticipants.svelte";
    import JoinGroup from "./JoinGroup.svelte";
    import type { ActorRefFrom } from "xstate";
    import type { HomeMachine } from "../../fsm/home.machine";
    import type { GroupMachine } from "../../fsm/group.machine";

    export let machine: ActorRefFrom<HomeMachine>;

    $: groupMachine = $machine.children.groupMachine as ActorRefFrom<GroupMachine>;

    $: joiningGroup = $machine.matches({ loaded_chats: "join_group" });

    $: newChat = $machine.matches({ loaded_chats: "new_chat" });

    $: newGroup =
        groupMachine !== undefined && $groupMachine.matches({ data_collection: "group_form" });

    $: choosingParticipants =
        groupMachine !== undefined &&
        ($groupMachine.matches({ data_collection: "choosing_participants" }) ||
            $groupMachine.matches({ data_collection: "adding_participants" }));
</script>

<Panel left>
    {#if newChat}
        <NewChat {machine} />
    {:else if newGroup}
        <NewGroup machine={groupMachine} />
    {:else if choosingParticipants}
        <ChooseParticipants machine={groupMachine} />
    {:else if joiningGroup}
        <JoinGroup {machine} />
    {:else}
        <ChatList on:newGroup on:newchat on:joinGroup on:logout {machine} />
    {/if}
</Panel>

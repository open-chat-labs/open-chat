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
    export let hideLeft = false;

    $: groupMachine = $machine.children.groupMachine as ActorRefFrom<GroupMachine>;
</script>

<Panel left {hideLeft}>
    {#if $machine.matches({ loaded_chats: "new_chat" })}
        <NewChat {machine} />
    {:else if groupMachine !== undefined && $groupMachine.matches( { data_collection: "group_form" } )}
        <NewGroup machine={groupMachine} />
    {:else if groupMachine !== undefined && $groupMachine.matches( { data_collection: "choosing_participants" } )}
        <ChooseParticipants machine={groupMachine} />
    {:else if $machine.matches({ loaded_chats: "join_group" })}
        <JoinGroup {machine} />
    {:else}
        <ChatList on:newGroup on:newchat on:joinGroup on:logout {machine} />
    {/if}
</Panel>

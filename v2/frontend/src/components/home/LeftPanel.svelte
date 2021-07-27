<script lang="ts">
    import Panel from "../Panel.svelte";
    import ChatList from "./ChatList.svelte";
    import NewChat from "./NewChat.svelte";
    import JoinGroup from "./JoinGroup.svelte";
    import type { ActorRefFrom } from "xstate";
    import type { HomeMachine } from "../../fsm/home.machine";

    export let machine: ActorRefFrom<HomeMachine>;
    export let hideLeft = false;
</script>

<Panel left {hideLeft}>
    {#if $machine.matches({ loaded_chats: "new_chat" })}
        <NewChat {machine} />
    {:else if $machine.matches({ loaded_chats: "join_group" })}
        <JoinGroup {machine} />
    {:else}
        <ChatList on:newchat on:joinGroup on:logout {machine} />
    {/if}
</Panel>

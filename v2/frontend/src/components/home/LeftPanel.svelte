<script lang="ts">
    import Panel from "../Panel.svelte";
    import ChatList from "./ChatList.svelte";
    import type { ActorRefFrom } from "xstate";
    import type { HomeMachine } from "../../fsm/home.machine";

    export let machine: ActorRefFrom<HomeMachine>;
    export let hideLeft = false;

    // todo - next up we need to handle some other left panel states e.g. new chat
    // hence separating ChatList into a self-contained component
    // we will branch here on home.machine state
</script>

<Panel left {hideLeft}>
    <ChatList on:newchat on:selectChat {machine} />
</Panel>

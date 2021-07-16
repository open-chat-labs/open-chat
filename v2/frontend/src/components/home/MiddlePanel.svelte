<script lang="ts">
    import Panel from "../Panel.svelte";
    import Loading from "../Loading.svelte";
    import { fade } from "svelte/transition";
    import { ScreenWidth, screenWidth } from "../../stores/screenWidth";
    import NoChatSelected from "./NoChatSelected.svelte";
    import CurrentChat from "./CurrentChat.svelte";
    import type { ChatMachine } from "../../fsm/chat.machine";
    import type { ActorRefFrom } from "xstate";
    export let hideLeft: boolean = false;
    export let machine: ActorRefFrom<ChatMachine> | undefined;
    export let loadingChats: boolean = false;
</script>

<Panel middle {hideLeft}>
    {#if loadingChats}
        {#if $screenWidth === ScreenWidth.ExtraSmall}
            <div />
        {:else}
            <Loading />
        {/if}
    {:else if machine === undefined}
        <div in:fade>
            <NoChatSelected on:newchat />
        </div>
    {:else}
        <CurrentChat {machine} on:clearSelection on:blockUser on:leaveGroup on:chatWith />
    {/if}
</Panel>

<style type="text/scss">
    .currentChat {
        background-color: var(--currentChat-header-bg);
        color: var(--currentChat-header-txt);

        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;

        height: 100%;
    }

    .title {
        @include font(bold, normal, fs-180);
        text-align: center;
        margin-bottom: $sp3;
    }
</style>

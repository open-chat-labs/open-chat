<script lang="ts">
    import Panel from "../Panel.svelte";
    import CurrentUser from "./CurrentUser.svelte";
    import SearchChats from "./SearchChats.svelte";
    import Loading from "../Loading.svelte";
    import ChatSummary from "./ChatSummary.svelte";
    import NewMessageFab from "./NewMessageFab.svelte";
    import { fade } from "svelte/transition";
    import { flip } from "svelte/animate";
    import { elasticOut } from "svelte/easing";
    import { ScreenWidth, screenWidth } from "../../stores/screenWidth";
    import { _ } from "svelte-i18n";
    import type { ActorRefFrom } from "xstate";
    import type { HomeMachine } from "../../fsm/home.machine";

    export let machine: ActorRefFrom<HomeMachine>;
    export let hideLeft = false;

    function filterChats(event: { detail: string }) {}
</script>

{#if $machine.context.user}
    <Panel left {hideLeft}>
        <CurrentUser on:logout user={$machine.context.user} on:newchat />
        <SearchChats on:filter={filterChats} />
        {#if $machine.matches("loading_chats")}
            <Loading />
        {:else}
            <div class="chat-summaries">
                {#each $machine.context.chatSummaries as chatSummary, i (chatSummary)}
                    <div
                        animate:flip={{ duration: 600, easing: elasticOut }}
                        out:fade={{ duration: 150 }}>
                        <ChatSummary
                            users={$machine.context.userLookup}
                            {chatSummary}
                            selected={$machine.context.selectedChat?.chatId === chatSummary.chatId}
                            on:selectChat />
                    </div>
                {/each}
            </div>
        {/if}
        {#if $screenWidth === ScreenWidth.ExtraSmall}
            <NewMessageFab on:newchat />
        {/if}
    </Panel>
{/if}

<style type="text/scss">
    .chat-summaries {
        overflow: auto;
    }
</style>

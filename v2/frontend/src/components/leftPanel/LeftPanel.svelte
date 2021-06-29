<script lang="ts">
    import Panel from "../Panel.svelte";
    import CurrentUser from "./CurrentUser.svelte";
    import SearchChats from "./SearchChats.svelte";
    import type { User } from "../../domain/user";

    export let user: User;
    export let hideLeft = false;

    function filterChats(event: { detail: string }) {}

    const things = new Array(100).fill(20);
</script>

{#if user}
    <Panel left {hideLeft}>
        <CurrentUser on:logout {user} />
        <SearchChats on:filter={filterChats} />
        <div class="chat-summaries">
            {#each things as thing}
                <div class="chat-summary">This is a chat</div>
                <!-- <ChatSummary {chat} /> -->
            {/each}
        </div>
    </Panel>
{/if}

<style type="text/scss">
    @import "../../styles/mixins";
    .chat-summaries {
        overflow: auto;
    }

    .chat-summary {
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: var(--chatSummary-bg);
        color: var(--chatSummary-txt1);
        padding: 10px;
        margin-bottom: 10px;
        cursor: pointer;
        transition: background-color ease-in-out 100ms, border-color ease-in-out 100ms;
        // border: 4px solid var(--chatSummary-bd);
        position: relative;
    }
</style>

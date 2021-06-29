<script lang="ts">
    import Panel from "./Panel.svelte";
    import CurrentUser from "./CurrentUser.svelte";
    // import ChatSummary from "./ChatSummary.svelte";
    // import SearchChats from "./SearchChats.svelte";
    // import { onMount } from "svelte";
    import type { User } from "../domain/user";

    export let user: User;
    // export let chats: ConfirmedChat[];
    export let hideLeft = false;
    // let chatSummaries: ChatSummaryType[] = [];

    // function filterChats(event: { detail: string }) {
    //     chatSummaries = user?.chats.filter(
    //         (c) => c.name.toLowerCase().indexOf(event.detail.toLowerCase()) >= 0
    //     );
    // }
</script>

{#if user}
    <Panel left {hideLeft}>
        <CurrentUser {user} />
        <!-- <SearchChats on:filter={filterChats} />
        <div class="chat-summaries">
            {#each chatSummaries as chat}
                <ChatSummary {chat} />
            {/each}
        </div> -->
    </Panel>
{/if}

<style type="text/scss">
    .chat-summaries {
        overflow: auto;
    }
</style>

<script lang="ts">
    import Panel from "../Panel.svelte";
    import CurrentUser from "./CurrentUser.svelte";
    import SearchChats from "./SearchChats.svelte";
    import type { User } from "../../domain/user";
    import type { LeftPanelState } from "./LeftPanel.types";
    import Loading from "../Loading.svelte";
    import type { ChatSummary as ChatSummaryType } from "../../domain/chat";
    import ChatSummary from "./ChatSummary.svelte";

    export let state: LeftPanelState;
    export let user: User;
    export let chatSummaries: ChatSummaryType[] = [];
    export let selectedChatId: string | undefined;
    export let hideLeft = false;

    function filterChats(event: { detail: string }) {}
</script>

{#if user}
    <Panel left {hideLeft}>
        <CurrentUser on:logout {user} on:newchat />
        <SearchChats on:filter={filterChats} />
        {#if state === "loadingChats"}
            <Loading />
        {:else}
            <div class="chat-summaries">
                {#each chatSummaries as chatSummary}
                    <ChatSummary
                        selected={chatSummary.chatId === selectedChatId}
                        on:selectChat
                        {chatSummary} />
                {/each}
            </div>
        {/if}
    </Panel>
{/if}

<style type="text/scss">
    @import "../../styles/mixins";
    .chat-summaries {
        overflow: auto;
    }
</style>

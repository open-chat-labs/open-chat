<script lang="ts">
    import Panel from "../Panel.svelte";
    import CurrentUser from "./CurrentUser.svelte";
    import SearchChats from "./SearchChats.svelte";
    import type { UserLookup, User } from "../../domain/user/user";
    import type { HomeState } from "./Home.types";
    import Loading from "../Loading.svelte";
    import type { ChatSummary as ChatSummaryType } from "../../domain/chat/chat";
    import ChatSummary from "./ChatSummary.svelte";
    import NewMessageFab from "./NewMessageFab.svelte";
    import { ScreenWidth, screenWidth } from "../../stores/screenWidth";
    import { _ } from "svelte-i18n";

    export let state: HomeState;
    export let user: User;
    export let users: UserLookup;
    export let chatSummaries: ChatSummaryType[] = [];
    export let selectedChatId: bigint | undefined;
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
                        {users}
                        {chatSummary}
                        selected={selectedChatId === chatSummary.chatId}
                        on:selectChat />
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

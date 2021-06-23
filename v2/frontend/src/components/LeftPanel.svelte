<script lang="ts">
    import { getFakeUser } from "../services/user";
    import type { User } from "../services/user";
    import type { ChatSummary as ChatSummaryType } from "../services/chats";
    import Panel from "./Panel.svelte";
    import CurrentUser from "./CurrentUser.svelte";
    import ChatSummary from "./ChatSummary.svelte";
    import SearchChats from "./SearchChats.svelte";
    import type { MyProfile } from "../domain/model/users";
    import type { ConfirmedChat } from "../domain/model/chats";
    import { onMount } from "svelte";

    export let userProfile: MyProfile | undefined;
    export let chats: ConfirmedChat[];
    export let hideLeft = false;
    let user: User;
    let chatSummaries: ChatSummaryType[] = [];

    onMount(() => {
        getFakeUser().then((u) => {
            user = u;
            chatSummaries = [...u.chats];
        });
    });

    function filterChats(event: { detail: string }) {
        chatSummaries = user?.chats.filter(
            (c) => c.name.toLowerCase().indexOf(event.detail.toLowerCase()) >= 0
        );
    }
</script>

{#if user}
    <Panel left {hideLeft}>
        <CurrentUser {user} />
        <SearchChats on:filter={filterChats} />
        <div class="chat-summaries">
            {#each chatSummaries as chat}
                <ChatSummary {chat} />
            {/each}
        </div>
    </Panel>
{/if}

<style type="text/scss">
    .chat-summaries {
        overflow: auto;
    }
</style>

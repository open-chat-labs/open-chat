<script lang="ts">
    import CurrentChatHeader from "./CurrentChatHeader.svelte";
    import Loading from "../Loading.svelte";
    // import CurrentChatMessages from "../CurrentChatMessages.svelte";
    // import MessageEntry from "../MessageEntry.svelte";
    import type { UserLookup } from "../../domain/user";
    import type { ChatSummary } from "../../domain/chat";
    import type { HomeState } from "./Home.types";

    export let users: UserLookup;
    export let state: HomeState;
    export let selectedChatSummary: ChatSummary;
</script>

<div class="wrapper">
    <CurrentChatHeader {users} on:clearSelection {selectedChatSummary} />

    {#if state === "loadingMessages"}
        <Loading />
    {/if}
    <!-- <CurrentChatMessages {chat} />
    <MessageEntry /> -->
</div>

<style type="text/scss">
    .wrapper {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        height: 100%;
    }
</style>

<script lang="ts">
    import { _ } from "svelte-i18n";
    import { getContext, onMount } from "svelte";
    import type { OpenChat } from "openchat-client";
    import ChatListSectionButton from "./ChatListSectionButton.svelte";

    export let selected = false;

    const client = getContext<OpenChat>("client");

    $: messagesRead = client.messagesRead;
    $: numStaleThreads = client.staleThreadsCount();

    onMount(() => {
        return messagesRead.subscribe(() => {
            numStaleThreads = client.staleThreadsCount();
        });
    });
</script>

<ChatListSectionButton
    on:click
    {selected}
    title={$_("thread.previewTitle")}
    unread={numStaleThreads} />

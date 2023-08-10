<script lang="ts">
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import type { OpenChat } from "openchat-client";
    import ChatListSectionButton from "./ChatListSectionButton.svelte";

    export let selected = false;

    const client = getContext<OpenChat>("client");
    $: staleThreadsCount = client.staleThreadsCount;
</script>

<ChatListSectionButton
    on:click
    {selected}
    title={$_("thread.previewTitle")}
    unread={{ unmuted: $staleThreadsCount, muted: 0, mentions: false }} />

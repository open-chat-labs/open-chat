<script lang="ts">
    import { _ } from "svelte-i18n";
    import ChatListSectionButton from "./ChatListSectionButton.svelte";
    import { emptyUnreadCounts } from "openchat-client";

    export let selected = false;
    export let unread = emptyUnreadCounts();
</script>

<ChatListSectionButton on:click {selected} title={$_("chats")} {unread} />

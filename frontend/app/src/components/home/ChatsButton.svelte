<script lang="ts">
    import { _ } from "svelte-i18n";
    import ChatListSectionButton from "./ChatListSectionButton.svelte";

    export let selected = false;
    export let unread: number;
</script>

<ChatListSectionButton on:click {selected} title={$_("chats")} {unread} />

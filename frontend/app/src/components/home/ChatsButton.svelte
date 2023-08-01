<script lang="ts">
    import { _ } from "svelte-i18n";
    import ChatListSectionButton from "./ChatListSectionButton.svelte";

    export let selected = false;
    export let unread: { muted: number; unmuted: number; mentions: boolean };
</script>

<ChatListSectionButton on:click {selected} title={$_("chats")} {unread} />

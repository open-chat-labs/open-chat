<script lang="ts">
    import Home from "./Home.svelte";
    import { currentUserStore } from "../../stores/chat";
    import { apiStore } from "../../stores/api";
    import type { MessageReadTracker } from "../../stores/markRead";

    export let logout: () => void;
    export let messagesRead: MessageReadTracker;
    export let params: { chatId: string | null; messageIndex: string | undefined | null } = {
        chatId: null,
        messageIndex: undefined,
    };

    $: user = $currentUserStore!;
    $: api = $apiStore!;
</script>

<Home {user} {api} {messagesRead} {params} {logout} on:logout />

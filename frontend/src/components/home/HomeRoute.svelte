<script lang="ts">
    import Home from "./Home.svelte";
    import { currentUserStore } from "../../stores/chat";
    import { apiStore } from "../../stores/api";

    export let logout: () => void;
    export let params: { chatId: string | null; messageIndex: string | undefined | null } = {
        chatId: null,
        messageIndex: undefined,
    };

    $: user = $currentUserStore!;
    $: api = $apiStore!;
</script>

<Home {user} {api} {params} {logout} on:logout />

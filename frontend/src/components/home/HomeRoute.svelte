<script lang="ts">
    import Home from "./Home.svelte";
    import { currentUserStore } from "../../stores/chat";
    import { apiStore } from "../../stores/api";

    export let logout: () => void;

    $: user = $currentUserStore!;
    $: api = $apiStore!;
</script>

<Home {user} {api} {logout} on:logout />

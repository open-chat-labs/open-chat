<script lang="ts">
    import Home from "./Home.svelte";
    import { getContext } from "svelte";
    import type { OpenChat } from "openchat-client";

    export let logout: () => void;

    const client = getContext<OpenChat>("client");
</script>

{#if client.hasUser}
    <Home {logout} on:logout />
{/if}

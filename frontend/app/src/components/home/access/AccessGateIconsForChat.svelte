<script lang="ts">
    import type { MultiUserChat, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import AccessGateIcon from "./AccessGateIcon.svelte";

    const client = getContext<OpenChat>("client");
    export let chat: MultiUserChat;
    $: gates = client.accessGatesForChat(chat);
</script>

{#if gates.length > 0}
    <div class="icons">
        {#each gates as gate, i}
            <AccessGateIcon clickable level={gate.level} {gate} />
            {#if gates.length > 1 && i < gates.length - 1}
                <span>&</span>
            {/if}
        {/each}
    </div>
{/if}

<style lang="scss">
    .icons {
        display: flex;
        gap: $sp3;
        align-items: center;
    }
</style>

<script lang="ts">
    import type { EnhancedAccessGate } from "openchat-client";
    import AccessGateIcon from "./AccessGateIcon.svelte";

    export let gates: EnhancedAccessGate[];
</script>

{#if gates.length > 0}
    <div class="icons">
        {#each gates as gate, i}
            <AccessGateIcon clickable level={gate.level} {gate} expiry={gate.expiry} />
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

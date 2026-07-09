<script lang="ts">
    import type { EnhancedAccessGate } from "openchat-client";
    import AccessGateIcon from "./AccessGateIcon.svelte";
    import { mergeAccessGates } from "../../../utils/access";

    interface Props {
        gates: EnhancedAccessGate[];
    }

    let { gates }: Props = $props();

    let merged = $derived(mergeAccessGates(...gates));
</script>

{#if gates.length > 0}
    <div class="icons">
        {#each merged as gate, i}
            <AccessGateIcon
                clickable
                level={gate.level}
                gateConfig={{ expiry: gate.expiry, gate }} />
            {#if merged.length > 1 && i < merged.length - 1}
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

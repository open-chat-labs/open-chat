<script lang="ts">
    import { BTC_SYMBOL, CKBTC_SYMBOL } from "openchat-client";
    import MultiToggle from "@components/MultiToggle.svelte";

    type Props = {
        selectedNetwork: string;
    };

    let { selectedNetwork = $bindable(BTC_SYMBOL) }: Props = $props();

    const networkOptions = [BTC_SYMBOL, CKBTC_SYMBOL].map((n) => ({ id: n, label: n }));
</script>

<div class="network-selector">Network: <MultiToggle options={networkOptions} bind:selected={selectedNetwork} /></div>

<style lang="scss">
    .network-selector {
        display: flex;
        gap: $sp3;
        margin-bottom: $sp4;
        align-items: center;
    }
</style>

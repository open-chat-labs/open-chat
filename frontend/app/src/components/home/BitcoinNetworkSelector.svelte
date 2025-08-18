<script lang="ts">
    import { BTC_SYMBOL, CKBTC_SYMBOL } from "openchat-client";
    import NetworkSelector from "@components/home/NetworkSelector.svelte";

    type Props = {
        selectedNetwork: string;
    };

    let { selectedNetwork = $bindable(BTC_SYMBOL) }: Props = $props();

    const networks = [BTC_SYMBOL, CKBTC_SYMBOL];
</script>

<NetworkSelector {networks} bind:selectedNetwork={selectedNetwork} />

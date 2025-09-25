<script lang="ts">
    import MultiToggle from "@components/MultiToggle.svelte";
    import Translatable from "@components/Translatable.svelte";
    import { i18nKey } from "@i18n/i18n";

    type Props = {
        networks: string[];
        selectedNetwork: string;
    };

    let { networks, selectedNetwork = $bindable() }: Props = $props();

    const networkOptions = networks.map((n) => ({ id: n, label: n }));
</script>

<div class="network-selector">
    <Translatable resourceKey={i18nKey("cryptoAccount.network")} />
    <MultiToggle options={networkOptions} bind:selected={selectedNetwork} />
</div>

<style lang="scss">
    .network-selector {
        display: flex;
        gap: $sp3;
        margin-bottom: $sp4;
        align-items: center;
    }
</style>

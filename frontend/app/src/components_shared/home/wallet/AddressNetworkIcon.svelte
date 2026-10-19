<script lang="ts">
    import { _ } from "svelte-i18n";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import type { AddressNetwork } from "../../../utils/cryptoAddress";

    interface Props {
        network: AddressNetwork;
        size?: string;
    }

    let { network, size = "1.25rem" }: Props = $props();

    // Each on a circle, so that they sit alike beside an address. There is no ICRC logo as such,
    // so an ICRC-1 account gets the Internet Computer logo on a dark circle and an ICP account
    // identifier the ICP token logo, which is the same on a light one.
    const logos: Record<AddressNetwork, string> = {
        icrc: "/assets/icrc_logo.svg",
        icp: "/assets/icp_token.svg",
        btc: "/assets/btc_logo.svg",
        eth: "/assets/eth_logo.svg",
        sol: "/assets/sol_logo.svg",
    };

    let label = $derived(interpolate($_, i18nKey(`addressBook.network.${network}`)));
</script>

<!-- The logo of the network a saved address is for, named by its tooltip -->
<img
    class="network-icon"
    src={logos[network]}
    alt={label}
    title={label}
    style={`--size: ${size}`} />

<style lang="scss">
    .network-icon {
        width: var(--size);
        height: var(--size);
        object-fit: contain;
        flex-shrink: 0;
    }
</style>

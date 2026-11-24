<!-- Send, Receive and Swap (native design notes §3.9 Flows; the plan's 13), pushed at their URLs
     (/wallet/send, /wallet/receive, /wallet/swap): over the token's page with it filled (?token=),
     or over the wallet, where the token sheet opens by itself to ask for it. Each flow is its own
     component; they share the wallet's figures (the display currency, the catalogue). None in an
     app store build (screens.ts), which never routes here (locations.ts). -->
<script lang="ts">
    import { conversionLedgers, exchangeRatesLookupStore, walletConfigStore } from "@client";
    import { walletCatalogue } from "@src/logic/wallet/walletCatalogue.svelte";
    import { panelSettings } from "@src/logic/wallet/walletTokens";
    import { walletCurrency } from "@src/stores/settings";
    import { untrack } from "svelte";
    import { locale } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import type { ScreenProps } from "../app/screens";
    import ReceiveFlow from "./ReceiveFlow.svelte";
    import SendFlow from "./SendFlow.svelte";
    import SwapFlow from "./SwapFlow.svelte";
    import { walletFigures } from "./wallet.adapter";

    let { screen, context }: ScreenProps<Extract<NativeScreen, { kind: "wallet_flow" }>> = $props();

    // the flow and its token as it opened: it keeps them while it slides out
    const view = untrack(() => screen.view);
    const ledger = untrack(() => screen.ledger);

    // amounts here are never veiled: they're being typed and checked
    const figures = $derived(
        walletFigures(
            walletCatalogue.tokens,
            panelSettings($walletConfigStore),
            conversionLedgers,
            $exchangeRatesLookupStore,
            { currency: $walletCurrency, veiled: false, locale: $locale ?? "en" },
        ),
    );
</script>

{#if view === "receive"}
    <ReceiveFlow {ledger} {context} {figures} />
{:else if view === "send"}
    <SendFlow {ledger} {context} {figures} />
{:else}
    <SwapFlow {ledger} {context} {figures} />
{/if}

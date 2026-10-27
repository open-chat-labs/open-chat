<!-- The wallet's left column (region "wallet", 6a #10120): WalletPanel over the wallet's catalogue
     (cryptoTokensSorted): the tokens you own, those under the wallet's minimum value folded into
     small balances, and the supported tokens; with nothing owned, the first few supported tokens.
     Each token's menu is tokenActions', plus Copy ledger ID; "View all" and Copy ledger ID are asks
     of WalletMain (panelRequests). A token opens its page (/wallet/:ledger), All activity /wallet.
     The wallet's balances refresh as the list first shows them (a recent one is kept), Refresh all
     one ledger at a time. No Send, Receive or Swap until their flows are built (6b, 6c). -->
<script lang="ts">
    import {
        conversionLedgers,
        cryptoTokensSorted,
        exchangeRatesLookupStore,
        routeStore,
        swappableTokensStore,
        walletConfigStore,
        walletTokensSorted,
        type OpenChat,
    } from "@client";
    import WalletPanel from "@openchat/ui/src/features/components/WalletPanel.svelte";
    import { hideTokenBalances } from "@src/stores/settings";
    import { walletActionsDisabled } from "@src/utils/features";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onMount } from "svelte";
    import type { LeftRegion, ScreenProps } from "../app/screens";
    import { panelSettings, supportedCount, walletTokens } from "./wallet.adapter";
    import { panelRequests } from "./walletRequests.svelte";

    // the region says only that it's the wallet: the selected token is the URL's
    const props: ScreenProps<Extract<LeftRegion, { kind: "wallet" }>> = $props();
    void props;

    const client = getContext<OpenChat>("client");

    const tokens = $derived(
        walletTokens($cryptoTokensSorted, $exchangeRatesLookupStore, {
            swappable: $swappableTokensStore,
            manualWallet: $walletConfigStore.kind === "manual_wallet",
            disabled: walletActionsDisabled,
        }),
    );

    // the display currencies' USD prices from the app's exchange rates, so the total is the one
    // every tree shows (invariant 3)
    const rates = $derived({
        ICP: $exchangeRatesLookupStore.get(conversionLedgers.icp)?.toUSD,
        BTC: $exchangeRatesLookupStore.get(conversionLedgers.btc)?.toUSD,
        ETH: $exchangeRatesLookupStore.get(conversionLedgers.eth)?.toUSD,
    });

    const page = $derived($routeStore.kind === "wallet_route" ? $routeStore : undefined);

    // which tokens can be swapped, as both old wallets ask when they open
    onMount(() => client.refreshSwappableTokens());

    // each token's balance, once as the list first shows it, a recent one accepted
    const refreshed = new Set<string>();
    $effect(() => {
        for (const token of $walletTokensSorted) {
            if (refreshed.has(token.ledger)) continue;
            refreshed.add(token.ledger);
            client.refreshAccountBalance(token.ledger, true);
        }
    });

    // "View all" and Copy ledger ID are WalletMain's to do
    function action(kind: string): void {
        if (kind === "browse") panelRequests.send({ view: "browse" });
        else if (kind.startsWith("ledger:")) {
            panelRequests.send({ view: "ledger", token: kind.slice("ledger:".length) });
        }
    }

    async function refresh(ledger?: string): Promise<void> {
        if (ledger === undefined) await client.refreshBalancesInSeries();
        else await client.refreshAccountBalance(ledger, false);
    }
</script>

<WalletPanel
    {tokens}
    {rates}
    settings={panelSettings($walletConfigStore)}
    supportedCount={supportedCount(tokens)}
    flows={[]}
    onAction={action}
    balanceHidden={$hideTokenBalances}
    onBalanceHiddenChange={(hidden) => hideTokenBalances.set(hidden)}
    onRefresh={refresh}
    onRemoveToken={(ledger) => client.removeTokenFromWallet(ledger)}
    onToken={(ledger) => navigate(`/wallet/${ledger}`)}
    selectedToken={page?.view === "token" ? page.ledger : undefined}
    onHome={() => navigate("/wallet")}
    homeSelected={page?.view === "all"} />

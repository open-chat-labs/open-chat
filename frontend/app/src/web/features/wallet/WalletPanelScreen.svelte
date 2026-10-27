<!-- The wallet's left column (region "wallet", 6a #10120): WalletPanel with the user's tokens
     (walletTokensSorted), their total, each token's menu (tokenActions) and the hidden balances
     setting. A token opens its page (/wallet/:ledger), All activity /wallet. Each token's balance
     refreshes when the list shows it (a recent one is kept), Refresh all one ledger at a time. -->
<script lang="ts">
    import {
        conversionLedgers,
        exchangeRatesLookupStore,
        routeStore,
        swappableTokensStore,
        walletConfigStore,
        walletTokensSorted,
        type OpenChat,
    } from "@client";
    import WalletPanel from "@openchat/ui/src/features/components/WalletPanel.svelte";
    import { tokenActions } from "@src/logic/wallet/tokenActions";
    import { hideTokenBalances } from "@src/stores/settings";
    import { walletActionsDisabled } from "@src/utils/features";
    import { navigate } from "@src/utils/navigation";
    import { getContext, onMount } from "svelte";
    import type { LeftRegion, ScreenProps } from "../app/screens";
    import { walletToken } from "./wallet.adapter";

    // the region says only that it's the wallet: the selected token is the URL's
    const props: ScreenProps<Extract<LeftRegion, { kind: "wallet" }>> = $props();
    void props;

    const client = getContext<OpenChat>("client");

    const tokens = $derived(
        $walletTokensSorted.map((token) =>
            walletToken(
                token,
                $exchangeRatesLookupStore.get(token.ledger)?.toUSD,
                tokenActions(token, {
                    swappable: $swappableTokensStore,
                    manualWallet: $walletConfigStore.kind === "manual_wallet",
                    disabled: walletActionsDisabled,
                }),
            ),
        ),
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

    async function refresh(ledger?: string): Promise<void> {
        if (ledger === undefined) await client.refreshBalancesInSeries();
        else await client.refreshAccountBalance(ledger, false);
    }
</script>

<WalletPanel
    {tokens}
    {rates}
    balanceHidden={$hideTokenBalances}
    onBalanceHiddenChange={(hidden) => hideTokenBalances.set(hidden)}
    onRefresh={refresh}
    onRemoveToken={(ledger) => client.removeTokenFromWallet(ledger)}
    onToken={(ledger) => navigate(`/wallet/${ledger}`)}
    selectedToken={page?.view === "token" ? page.ledger : undefined}
    onHome={() => navigate("/wallet")}
    homeSelected={page?.view === "all"} />

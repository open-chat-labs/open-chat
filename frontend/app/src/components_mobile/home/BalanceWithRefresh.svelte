<script lang="ts">
    import { Body, Container } from "component-lib";
    import type { OpenChat } from "openchat-client";
    import { enhancedCryptoLookup as cryptoLookup } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Plus from "svelte-material-icons/Plus.svelte";
    import Refresh from "svelte-material-icons/Refresh.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        ledger: string;
        value: bigint;
        toppingUp?: boolean;
        showTopUp?: boolean;
        showRefresh?: boolean;
        refreshing?: boolean;
        conversion?: "none" | "usd" | "icp" | "btc" | "eth";
        hideBalance?: boolean;
        allowCached?: boolean;
        onClick?: () => void;
        onRefreshed?: (val: bigint) => void;
        onError?: (error: string) => void;
    }

    let {
        ledger,
        value,
        toppingUp = $bindable(false),
        showTopUp = false,
        showRefresh = true,
        refreshing = $bindable(false),
        conversion = "none",
        hideBalance = false,
        allowCached = false,
        onClick,
        onRefreshed,
        onError,
    }: Props = $props();

    export function refresh(allowCached: boolean = false) {
        onClick?.();
        refreshing = true;

        return client
            .refreshAccountBalance(ledger, allowCached)
            .then((val) => {
                onRefreshed?.(val);
            })
            .catch((err) => {
                const errorMessage = $_("unableToRefreshAccountBalance", {
                    values: { token: symbol },
                });
                client.logError(`Failed to refresh ${symbol} account balance`, err);
                onError?.(errorMessage);
            })
            .finally(() => (refreshing = false));
    }

    function topUp() {
        toppingUp = !toppingUp;
    }

    function convertValue(c: Exclude<typeof conversion, "none">, t: typeof tokenDetails): string {
        switch (c) {
            case "usd":
                return t.dollarBalance?.toFixed(2) ?? "???";
            case "icp":
                return t.icpBalance?.toFixed(3) ?? "???";
            case "btc":
                return t.btcBalance?.toFixed(6) ?? "???";
            case "eth":
                return t.ethBalance?.toFixed(6) ?? "???";
        }
    }
    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    let symbol = $derived(tokenDetails.symbol);
    let formattedValue = $derived(
        conversion === "none"
            ? client.formatTokens(value, tokenDetails.decimals)
            : convertValue(conversion, tokenDetails),
    );
    $effect(() => {
        if (ledger) {
            refresh(allowCached);
        }
    });
</script>

<Container
    width={"hug"}
    mainAxisAlignment={"end"}
    crossAxisAlignment={"center"}
    gap={"sm"}>
    <Body blur={hideBalance} width={"hug"} fontWeight={"bold"}>
        {formattedValue}
    </Body>
    {#if showRefresh && !hideBalance}
        <div class="refresh" class:refreshing onclick={() => refresh()}>
            <Refresh size={"1.5rem"} color={"var(--icon-txt)"} />
        </div>
    {/if}
    {#if showTopUp}
        <div class="top-up" onclick={topUp} title={$_("cryptoAccount.topUp")}>
            <Plus size={"1.5rem"} color={toppingUp ? "var(--icon-selected)" : "var(--icon-txt)"} />
        </div>
    {/if}
</Container>

<style lang="scss">
    .top-up,
    .refresh {
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .refresh {
        &.refreshing {
            @include spin();
        }
    }
</style>

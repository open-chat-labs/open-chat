<script lang="ts">
    import Refresh from "svelte-material-icons/Refresh.svelte";
    import Plus from "svelte-material-icons/Plus.svelte";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { OpenChat, ResourceKey } from "openchat-client";
    import Translatable from "../Translatable.svelte";
    import { enhancedCryptoLookup as cryptoLookup } from "openchat-client";

    const client = getContext<OpenChat>("client");

    interface Props {
        ledger: string;
        value: bigint;
        label?: ResourceKey | undefined;
        bold?: boolean;
        toppingUp?: boolean;
        showTopUp?: boolean;
        showRefresh?: boolean;
        refreshing?: boolean;
        conversion?: "none" | "usd" | "icp" | "btc" | "eth";
        hideBalance?: boolean;
        onClick?: () => void;
        onRefreshed?: (val: bigint) => void;
        onError?: (error: string) => void;
    }

    let {
        ledger,
        value,
        label = undefined,
        bold = false,
        toppingUp = $bindable(false),
        showTopUp = false,
        showRefresh = true,
        refreshing = $bindable(false),
        conversion = "none",
        hideBalance = false,
        onClick,
        onRefreshed,
        onError,
    }: Props = $props();

    export function refresh() {
        onClick?.();
        refreshing = true;

        return client
            .refreshAccountBalance(ledger)
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
    let tokenDetails = $derived($cryptoLookup[ledger]);
    let symbol = $derived(tokenDetails.symbol);
    let formattedValue = $derived(
        hideBalance
            ? "*****"
            : conversion === "none"
              ? client.formatTokens(value, tokenDetails.decimals)
              : convertValue(conversion, tokenDetails),
    );
    $effect(() => {
        if (ledger) {
            refresh();
        }
    });
</script>

<div class="container">
    {#if label !== undefined}
        <div class="label"><Translatable resourceKey={label} /></div>
    {/if}
    <div class="amount" class:bold>
        {formattedValue}
    </div>
    {#if showRefresh && !hideBalance}
        <div class="refresh" class:refreshing onclick={refresh}>
            <Refresh size={"1em"} color={"var(--icon-txt)"} />
        </div>
    {/if}
    {#if showTopUp}
        <div class="top-up" onclick={topUp} title={$_("cryptoAccount.topUp")}>
            <Plus size={"1em"} color={toppingUp ? "var(--icon-selected)" : "var(--icon-txt)"} />
        </div>
    {/if}
</div>

<style lang="scss">
    .container {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 6px;
    }

    .top-up,
    .refresh {
        // We want the size of the refresh icon (1em) to be 24px
        // but we can't use rem units in SVGs
        @include font-size(fs-140);
        height: $sp5;
        width: $sp5;
        cursor: pointer;
        @include mobile() {
            height: 21.59px;
            width: 21.59px;
        }
    }

    .hideBalance {
        visibility: hidden;
    }

    .refresh {
        &.refreshing {
            @include spin();
        }
    }

    .label {
        @include font(bold, normal, fs-100, 22);
        color: var(--txt-light);
        font-weight: 400;
    }

    .amount {
        @include font(bold, normal, fs-100, 22);
    }
</style>

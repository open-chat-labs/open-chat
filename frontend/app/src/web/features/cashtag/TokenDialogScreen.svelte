<!-- A token's price card, opened by a cashtag clicked in a message (`<cash-tag>`): its logo, name,
     price now, and a chart of its price over the last 7 days, as the old UI's card shows them
     (logic/cashtag). -->
<script lang="ts">
    import {
        cryptoLookup,
        exchangeRatesLookupStore,
        formatPercentChange,
        formatUsdPrice,
        OpenChat,
    } from "@client";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { TokenPriceHistory } from "@src/logic/cashtag/tokenPriceCard.svelte";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LocalDialog } from "../app/dialogs";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "token" }>> = $props();

    const client = getContext<OpenChat>("client");
    // the card's token is fixed for its life: another cashtag opens another card
    const ledger = dialog.ledger;
    const history = new TokenPriceHistory(client, ledger);

    const CHART_WIDTH = 400;
    const CHART_HEIGHT = 120;

    const token = $derived($cryptoLookup.get(ledger));
    const price = $derived($exchangeRatesLookupStore.get(ledger)?.toUSD);
    const chart = $derived(history.chart(CHART_WIDTH, CHART_HEIGHT));
    const change = $derived(history.change);
</script>

{#if token !== undefined}
    <!-- TODO(design): no token price card in the design (GAPS.md) -->
    <DialogShell title={token.name} width={400} height="auto" {onClose}>
        <div class="token">
            <img class="logo" src={token.logo} alt="" />
            <span class="symbol">${token.symbol}</span>
        </div>
        {#if price !== undefined}
            <p class="price">{formatUsdPrice(price)}</p>
        {:else}
            <p class="none">{$_("cashtag.noPrice")}</p>
        {/if}
        {#if change !== undefined}
            <p class="change" class:falling={change < 0}>
                {$_("cashtag.change7d", { values: { change: formatPercentChange(change) } })}
            </p>
        {/if}
        <!-- no chart at all when the history couldn't be loaded -->
        {#if history.history.kind !== "error"}
            <div class="chart">
                {#if history.history.kind === "loading"}
                    <Spinner />
                {:else if chart !== undefined}
                    <svg
                        role="img"
                        aria-label={$_("cashtag.chartLabel", { values: { symbol: token.symbol } })}
                        class:falling={!chart.rising}
                        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                        preserveAspectRatio="none">
                        <path class="area" d={chart.area} />
                        <path class="line" d={chart.line} vector-effect="non-scaling-stroke" />
                    </svg>
                {:else}
                    <p class="none">{$_("cashtag.noHistory")}</p>
                {/if}
            </div>
        {/if}
    </DialogShell>
{/if}

<style>
    .token {
        display: flex;
        align-items: center;
        gap: var(--space-10);
    }

    .logo {
        width: 40px;
        height: 40px;
        border-radius: var(--radius-circle);
    }

    .symbol {
        font: var(--weight-semibold) var(--text-base) / 1.2 var(--font-sans);
        color: var(--ink-2);
    }

    p {
        margin: 0;
    }

    .price {
        margin-block-start: var(--space-16);
        font: var(--weight-bold) var(--text-2xl) / 1.2 var(--font-sans);
        color: var(--ink);
    }

    .change {
        margin-block-start: var(--space-4);
        font: var(--weight-semibold) var(--text-sm) / 1.4 var(--font-sans);
        color: var(--status-online);
    }

    .change.falling {
        color: var(--status-danger);
    }

    .none {
        font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
        color: var(--ink-3);
    }

    .chart {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 120px;
        margin-block-start: var(--space-16);
    }

    svg {
        width: 100%;
        height: 100%;
        color: var(--status-online);
    }

    svg.falling {
        color: var(--status-danger);
    }

    .area {
        fill: currentColor;
        fill-opacity: 0.12;
    }

    .line {
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linejoin: round;
    }
</style>

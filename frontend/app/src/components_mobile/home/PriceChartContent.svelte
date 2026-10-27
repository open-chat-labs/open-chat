<!-- A price chart a bot sent: its title, each token's latest price and change, the chart, which the
     reader can explore (PriceChart), and where its prices are from. A token's symbol opens its price
     card, as a cashtag does. Quoted in a reply, it's just its title. -->
<script lang="ts">
    import { formatPercentChange, formatUsdPrice, type PriceChartContent } from "@client";
    import {
        PRICE_CHART_COLOURS,
        priceChartTokens,
        type PriceChartData,
    } from "@src/logic/priceChart/priceChart.svelte";
    import { cashtagClickedEvent } from "@src/web-components/cashTag";
    import Translatable from "@shared_components/Translatable.svelte";
    import { Body, ColourVars } from "component-lib";
    import ChartLine from "svelte-material-icons/ChartLine.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import PriceChart from "./PriceChart.svelte";

    interface Props {
        content: PriceChartContent;
        reply?: boolean;
    }

    let { content, reply = false }: Props = $props();

    let data: PriceChartData = $derived({
        series: content.series,
        start: content.start,
        end: content.end,
    });
    let tokens = $derived(priceChartTokens(content));
</script>

{#if reply}
    <div class="reply"><ChartLine size={"1.2em"} color={"currentColor"} />{content.title}</div>
{:else}
    <div
        class="price-chart-content"
        style:--up={ColourVars.validationSuccess}
        style:--down={ColourVars.validationError}>
        <Body fontWeight={"bold"}>{content.title}</Body>
        <div class="tokens">
            {#each tokens as token, i}
                <button
                    class="token"
                    onclick={(ev) =>
                        ev.currentTarget.dispatchEvent(cashtagClickedEvent(token.series.token))}>
                    {#if tokens.length > 1}
                        <span class="swatch" style:background-color={PRICE_CHART_COLOURS[i]}></span>
                    {/if}
                    <span class="symbol">{token.series.symbol}</span>
                    <span>{formatUsdPrice(token.usd)}</span>
                    {#if token.change !== undefined}
                        <span class="change" class:falling={token.change < 0}
                            >{formatPercentChange(token.change)}</span>
                    {/if}
                </button>
            {/each}
        </div>
        <div class="chart">
            <PriceChart {data} label={content.title} />
        </div>
        {#each content.sources as source}
            <a class="credit" href={source.url} target="_blank" rel="noopener noreferrer"
                ><Translatable
                    resourceKey={i18nKey("cashtag.priceDataBy", { source: source.name })} /></a>
        {/each}
    </div>
{/if}

<style lang="scss">
    .reply {
        display: flex;
        align-items: center;
        gap: var(--sp-xs);
    }

    .price-chart-content {
        display: flex;
        flex-direction: column;
        gap: var(--sp-sm);
        width: 22rem;
        max-width: 100%;
        padding: var(--sp-xs) 0;
    }

    .tokens {
        display: flex;
        flex-wrap: wrap;
        gap: var(--sp-xxs) var(--sp-md);
    }

    .token {
        display: inline-flex;
        align-items: center;
        gap: var(--sp-xs);
        padding: 0;
        border: none;
        background: none;
        color: inherit;
        font-size: var(--typo-bodySmall-sz);
        line-height: var(--typo-bodySmall-lh);
    }

    .swatch {
        width: 0.6rem;
        height: 0.6rem;
        border-radius: var(--rad-circle);
    }

    .symbol {
        font-weight: 700;
    }

    .change {
        color: var(--up);

        &.falling {
            color: var(--down);
        }
    }

    .chart {
        width: 100%;
        height: 10rem;
        margin: var(--sp-sm) 0 var(--sp-xs) 0;
    }

    .credit {
        font-size: 0.75rem;
        color: inherit;
        opacity: 0.7;
        text-decoration: underline;
    }
</style>

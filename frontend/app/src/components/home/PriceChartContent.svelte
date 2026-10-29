<!-- A price chart a bot sent: its title, each token's latest price and change, the chart, which the
     reader can explore (PriceChart), and where its prices are from. A token's symbol opens its price
     card, as a cashtag does. Quoted in a reply, it's just its title. -->
<script lang="ts">
    import { formatPercentChange, formatUsdPrice, type PriceChartContent } from "@client";
    import {
        PRICE_CHART_COLOURS,
        priceChartCredit,
        priceChartTokens,
        type PriceChartData,
    } from "@src/logic/priceChart/priceChart.svelte";
    import { cashtagClickedEvent } from "@src/web-components/cashTag";
    import ChartLine from "svelte-material-icons/ChartLine.svelte";
    import { _, locale } from "svelte-i18n";
    import PriceChart from "./PriceChart.svelte";

    interface Props {
        content: PriceChartContent;
        reply?: boolean;
        // in the reader's own bubble, as when they've forwarded it
        me?: boolean;
    }

    let { content, reply = false, me = false }: Props = $props();

    let data: PriceChartData = $derived({
        series: content.series,
        start: content.start,
        end: content.end,
    });
    let tokens = $derived(priceChartTokens(content));
    // eg. "Price data by ICPSwap and CoinGecko", each source's name its link
    const SOURCES = "\u0000";
    let credit = $derived(
        priceChartCredit(
            $_("cashtag.priceDataBy", { values: { source: SOURCES } }),
            SOURCES,
            content.sources,
            $locale ?? "en",
        ),
    );
</script>

{#if reply}
    <div class="reply"><ChartLine size={"1.2em"} color={"currentColor"} />{content.title}</div>
{:else}
    <!-- in the reader's own bubble it's on a panel of the other bubbles' colour, as its line and
         change colours are chosen for those -->
    <div class="price-chart-content" class:me>
        <div class="title">{content.title}</div>
        <div class="tokens">
            {#each tokens as token, i}
                <button
                    class="token"
                    onclick={(ev) =>
                        ev.currentTarget.dispatchEvent(cashtagClickedEvent(token.series.token))}>
                    <!-- one token is named by the title, so it's just its price and change -->
                    {#if tokens.length > 1}
                        <span class="swatch" style:background-color={PRICE_CHART_COLOURS[i]}></span>
                        <span class="symbol">{token.series.symbol}</span>
                    {/if}
                    <span class="price">{formatUsdPrice(token.usd)}</span>
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
        <div class="credit">
            {#each credit as part}
                {#if part.kind === "text"}{part.text}{:else}<a
                        href={part.source.url}
                        target="_blank"
                        rel="noopener noreferrer">{part.source.name}</a
                    >{/if}
            {/each}
        </div>
    </div>
{/if}

<style lang="scss">
    .reply {
        display: flex;
        align-items: center;
        gap: $sp2;
    }

    .price-chart-content {
        display: flex;
        flex-direction: column;
        gap: $sp2;
        width: toRem(400);
        max-width: 100%;
        padding: $sp2 0;

        &.me {
            padding: $sp3;
            border-radius: $sp3;
            background-color: var(--currentChat-msg-bg);
            color: var(--currentChat-msg-txt);
        }
    }

    .title {
        @include font(bold, normal, fs-100);
    }

    .tokens {
        display: flex;
        flex-wrap: wrap;
        gap: $sp1 $sp4;
    }

    .token {
        display: inline-flex;
        align-items: center;
        gap: $sp2;
        padding: 0;
        border: none;
        background: none;
        color: inherit;
        cursor: pointer;
        @include font(book, normal, fs-80);

        &:hover .symbol,
        &:hover .price:first-child {
            text-decoration: underline;
        }
    }

    .swatch {
        width: toRem(10);
        height: toRem(10);
        border-radius: 50%;
    }

    .symbol {
        @include font(bold, normal, fs-80);
    }

    .change {
        color: var(--success);

        &.falling {
            color: var(--error);
        }
    }

    .chart {
        height: toRem(160);
        margin: $sp3 0 $sp2 0;
    }

    .credit {
        @include font(book, normal, fs-60);
        text-align: end;
        opacity: 0.7;

        a {
            color: inherit;
            text-decoration: underline;
        }
    }
</style>

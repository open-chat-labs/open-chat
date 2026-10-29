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
    import { Body, ColourVars } from "component-lib";
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
    <div
        class="price-chart-content"
        style:--up={ColourVars.validationSuccess}
        style:--down={ColourVars.validationError}
        style:--panel={ColourVars.chatBubbleReceived}
        style:--panel-text={ColourVars.textPrimary}
        class:me>
        <Body fontWeight={"bold"}>{content.title}</Body>
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
        gap: var(--sp-xs);
    }

    // up to 22rem wide, but narrower on a phone: the bubble sizes itself to its content, so a fixed
    // width (or the chart's own) would push past the bubble's max width and the chart's end be cut off
    .price-chart-content {
        display: grid;
        grid-template-columns: minmax(0, 22rem);
        gap: var(--sp-sm);
        // inset as a text message's is, in line with the sender's name
        padding: var(--sp-xs) var(--sp-sm);

        // in the reader's own bubble it's on a panel of the other bubbles' colour, as its line and
        // change colours are chosen for those
        &.me {
            padding: var(--sp-md);
            border-radius: var(--rad-lg);
            background-color: var(--panel);
            color: var(--panel-text);
        }
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
        opacity: 0.7;

        a {
            color: inherit;
            text-decoration: underline;
        }
    }
</style>

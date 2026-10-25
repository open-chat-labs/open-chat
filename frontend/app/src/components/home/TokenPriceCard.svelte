<!-- A token's or coin's price card, opened by a cashtag clicked in a message (`<cash-tag>`): its
     logo, name, price now, and a chart of its price over the last 7 days, crediting where the prices
     are from where that's required (logic/cashtag). -->
<script lang="ts">
    import {
        cashtagCoinsStore,
        cryptoLookup,
        exchangeRatesLookupStore,
        formatPercentChange,
        formatUsdPrice,
        priceCredits,
        priceSourcesStore,
        type OpenChat,
        type PriceSubject,
    } from "@client";
    import {
        cashtagCardDetails,
        TokenPriceHistory,
    } from "@src/logic/cashtag/tokenPriceCard.svelte";
    import Loading from "@shared_components/Loading.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";

    interface Props {
        subject: PriceSubject;
        alignTo?: HTMLElement;
        onClose: () => void;
    }

    let { subject, alignTo, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");
    // the card's token or coin is fixed for its life: another cashtag opens another card
    const history = new TokenPriceHistory(client, subject);

    const CHART_WIDTH = 300;
    const CHART_HEIGHT = 100;

    let token = $derived(
        cashtagCardDetails(subject, $cryptoLookup, $exchangeRatesLookupStore, $cashtagCoinsStore),
    );
    let price = $derived(token?.usd);
    let chart = $derived(history.chart(CHART_WIDTH, CHART_HEIGHT));
    let change = $derived(history.change);
    let credits = $derived(priceCredits($priceSourcesStore, [token?.source, history.source]));
</script>

{#if token !== undefined}
    <Overlay dismissible {onClose}>
        <ModalContent hideHeader hideFooter fixedWidth={false} {alignTo} {onClose}>
            {#snippet body()}
                <div class="card">
                    <div class="token">
                        {#if token.logo !== undefined}
                            <img class="logo" src={token.logo} alt="" />
                        {/if}
                        <div class="names">
                            <div class="name">{token.name}</div>
                            <div class="symbol">${token.symbol}</div>
                        </div>
                    </div>
                    <div class="price">
                        {#if price !== undefined}
                            {formatUsdPrice(price)}
                        {:else}
                            <span class="none"
                                ><Translatable resourceKey={i18nKey("cashtag.noPrice")} /></span>
                        {/if}
                    </div>
                    {#if change !== undefined}
                        <div class="change" class:falling={change < 0}>
                            <Translatable
                                resourceKey={i18nKey("cashtag.change7d", {
                                    change: formatPercentChange(change),
                                })} />
                        </div>
                    {/if}
                    <!-- no chart at all when the history couldn't be loaded -->
                    {#if history.history.kind !== "error"}
                        <div class="chart">
                            {#if history.history.kind === "loading"}
                                <Loading size={"small"} />
                            {:else if chart !== undefined}
                                <svg
                                    role="img"
                                    aria-label={$_("cashtag.chartLabel", {
                                        values: { symbol: token.symbol },
                                    })}
                                    class:falling={!chart.rising}
                                    viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                                    preserveAspectRatio="none">
                                    <path class="area" d={chart.area} />
                                    <path
                                        class="line"
                                        d={chart.line}
                                        vector-effect="non-scaling-stroke" />
                                </svg>
                            {:else}
                                <span class="none"
                                    ><Translatable
                                        resourceKey={i18nKey("cashtag.noHistory")} /></span>
                            {/if}
                        </div>
                    {/if}
                    {#each credits as credit}
                        <a class="credit" href={credit.url} target="_blank" rel="noopener noreferrer"
                            >{$_("cashtag.priceDataBy", { values: { source: credit.name } })}</a>
                    {/each}
                </div>
            {/snippet}
        </ModalContent>
    </Overlay>
{/if}

<style lang="scss">
    .card {
        display: flex;
        flex-direction: column;
        gap: $sp2;
        width: toRem(300);
        max-width: 100%;
    }

    .token {
        display: flex;
        align-items: center;
        gap: $sp3;
    }

    .logo {
        width: toRem(40);
        height: toRem(40);
        border-radius: 50%;
        flex: 0 0 toRem(40);
    }

    .name {
        @include font(bold, normal, fs-100);
    }

    .symbol {
        @include font(book, normal, fs-80);
        color: var(--txt-light);
    }

    .price {
        @include font(bold, normal, fs-160);
        margin-top: $sp2;
    }

    .none {
        @include font(book, normal, fs-80);
        color: var(--txt-light);
    }

    .change {
        @include font(book, normal, fs-80);
        color: var(--success);

        &.falling {
            color: var(--error);
        }
    }

    .credit {
        @include font(book, normal, fs-70);
        color: var(--txt-light);
        text-decoration: underline;
    }

    .chart {
        display: flex;
        align-items: center;
        justify-content: center;
        height: toRem(100);
        margin-top: $sp3;

        svg {
            width: 100%;
            height: 100%;
            color: var(--success);

            &.falling {
                color: var(--error);
            }
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
    }
</style>

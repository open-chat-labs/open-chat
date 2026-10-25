<!-- A token's price card, opened by a cashtag tapped in a message (`<cash-tag>`): its logo, name,
     price now, and a chart of its price over the last 7 days (logic/cashtag). -->
<script lang="ts">
    import {
        cryptoLookup,
        exchangeRatesLookupStore,
        formatPercentChange,
        formatUsdPrice,
        type OpenChat,
    } from "@client";
    import { TokenPriceHistory } from "@src/logic/cashtag/tokenPriceCard.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import {
        Avatar,
        Body,
        BodySmall,
        Caption,
        ColourVars,
        Container,
        H2,
        Sheet,
        Spinner,
    } from "component-lib";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";

    interface Props {
        ledger: string;
        onClose: () => void;
    }

    let { ledger, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");
    // the card's token is fixed for its life: another cashtag opens another card
    const history = new TokenPriceHistory(client, ledger);

    const CHART_WIDTH = 300;
    const CHART_HEIGHT = 100;

    let token = $derived($cryptoLookup.get(ledger));
    let price = $derived($exchangeRatesLookupStore.get(ledger)?.toUSD);
    let chart = $derived(history.chart(CHART_WIDTH, CHART_HEIGHT));
    let change = $derived(history.change);
</script>

{#if token !== undefined}
    <Sheet onDismiss={onClose}>
        <Container direction={"vertical"} gap={"md"} padding={["lg", "lg", "xl", "lg"]}>
            <Container gap={"md"} crossAxisAlignment={"center"}>
                <Avatar url={token.logo}></Avatar>
                <Container direction={"vertical"}>
                    <Body width={"hug"} fontWeight={"bold"}>{token.name}</Body>
                    <Caption width={"hug"} colour={"textSecondary"} fontWeight={"bold"}
                        >${token.symbol}</Caption>
                </Container>
            </Container>
            <Container direction={"vertical"} gap={"xs"}>
                {#if price !== undefined}
                    <H2 width={"hug"} fontWeight={"bold"}>{formatUsdPrice(price)}</H2>
                {:else}
                    <BodySmall width={"hug"} colour={"textSecondary"}
                        ><Translatable resourceKey={i18nKey("cashtag.noPrice")} /></BodySmall>
                {/if}
                {#if change !== undefined}
                    <BodySmall
                        width={"hug"}
                        fontWeight={"bold"}
                        colour={change < 0 ? "validationError" : "validationSuccess"}
                        ><Translatable
                            resourceKey={i18nKey("cashtag.change7d", {
                                change: formatPercentChange(change),
                            })} /></BodySmall>
                {/if}
            </Container>
            <!-- no chart at all when the history couldn't be loaded -->
            {#if history.history.kind !== "error"}
                <div
                    class="chart"
                    style:--up={ColourVars.validationSuccess}
                    style:--down={ColourVars.validationError}>
                    {#if history.history.kind === "loading"}
                        <Spinner size={"2rem"} foregroundColour={ColourVars.primary} />
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
                            <path class="line" d={chart.line} vector-effect="non-scaling-stroke" />
                        </svg>
                    {:else}
                        <BodySmall width={"hug"} colour={"textSecondary"}
                            ><Translatable resourceKey={i18nKey("cashtag.noHistory")} /></BodySmall>
                    {/if}
                </div>
            {/if}
        </Container>
    </Sheet>
{/if}

<style lang="scss">
    .chart {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 7rem;

        svg {
            width: 100%;
            height: 100%;
            color: var(--up);

            &.falling {
                color: var(--down);
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

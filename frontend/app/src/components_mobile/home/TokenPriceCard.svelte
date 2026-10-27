<!-- A token's or coin's price card, opened by a cashtag tapped in a message (`<cash-tag>`): its
     logo, name, price now, and a chart of its price over the last 7 days, and where the prices are
     from (logic/cashtag). -->
<script lang="ts">
    import {
        cashtagCoinsStore,
        cryptoLookup,
        exchangeRatesLookupStore,
        formatPercentChange,
        formatUsdPrice,
        priceSourcesFor,
        priceSourcesStore,
        type OpenChat,
        type PriceSubject,
    } from "@client";
    import {
        cashtagCardDetails,
        lastCardDetails,
        TokenPriceHistory,
    } from "@src/logic/cashtag/tokenPriceCard.svelte";
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
    import PriceChart from "./PriceChart.svelte";

    interface Props {
        subject: PriceSubject;
        onClose: () => void;
    }

    let { subject, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");
    // the card's token or coin is fixed for its life: another cashtag opens another card
    const history = new TokenPriceHistory(client, subject);

    const known = lastCardDetails();
    let token = $derived(
        known(
            cashtagCardDetails(
                subject,
                $cryptoLookup,
                $exchangeRatesLookupStore,
                $cashtagCoinsStore,
            ),
        ),
    );
    let price = $derived(token?.usd);
    let chart = $derived(token === undefined ? undefined : history.chartData(token.symbol));
    let change = $derived(history.change);
    // where its price and chart are from, always named, and linked
    let credits = $derived(priceSourcesFor($priceSourcesStore, [token?.source, history.source]));
</script>

{#if token !== undefined}
    <Sheet onDismiss={onClose}>
        <Container direction={"vertical"} gap={"md"} padding={["lg", "lg", "xl", "lg"]}>
            <Container gap={"md"} crossAxisAlignment={"center"}>
                {#if token.logo !== undefined}
                    <Avatar url={token.logo}></Avatar>
                {/if}
                <Container direction={"vertical"}>
                    <Body width={"hug"} fontWeight={"bold"}>{token.name}</Body>
                    <Caption width={"hug"} colour={"textSecondary"} fontWeight={"bold"}
                        >${token.symbol}</Caption
                    >
                </Container>
            </Container>
            <Container direction={"vertical"} gap={"xs"}>
                {#if price !== undefined}
                    <H2 width={"hug"} fontWeight={"bold"}>{formatUsdPrice(price)}</H2>
                {:else}
                    <BodySmall width={"hug"} colour={"textSecondary"}
                        ><Translatable resourceKey={i18nKey("cashtag.noPrice")} /></BodySmall
                    >
                {/if}
                {#if change !== undefined}
                    <BodySmall
                        width={"hug"}
                        fontWeight={"bold"}
                        colour={change < 0 ? "validationError" : "validationSuccess"}
                        ><Translatable
                            resourceKey={i18nKey("cashtag.change7d", {
                                change: formatPercentChange(change),
                            })}
                        /></BodySmall
                    >
                {/if}
            </Container>
            <!-- no chart at all when the history couldn't be loaded -->
            {#if history.history.kind !== "error"}
                <div class="chart">
                    {#if history.history.kind === "loading"}
                        <Spinner size={"2rem"} foregroundColour={ColourVars.primary} />
                    {:else if chart !== undefined}
                        <PriceChart
                            data={chart}
                            label={$_("cashtag.chartLabel", {
                                values: { symbol: token.symbol },
                            })}
                        />
                    {:else}
                        <BodySmall width={"hug"} colour={"textSecondary"}
                            ><Translatable resourceKey={i18nKey("cashtag.noHistory")} /></BodySmall
                        >
                    {/if}
                </div>
            {/if}
            {#each credits as credit}
                <a
                    class="credit"
                    style:color={ColourVars.textSecondary}
                    href={credit.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    ><Translatable
                        resourceKey={i18nKey("cashtag.priceDataBy", { source: credit.name })}
                    /></a
                >
            {/each}
        </Container>
    </Sheet>
{/if}

<style lang="scss">
    .credit {
        font-size: 0.75rem;
        text-decoration: underline;
    }

    .chart {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 7rem;
    }
</style>

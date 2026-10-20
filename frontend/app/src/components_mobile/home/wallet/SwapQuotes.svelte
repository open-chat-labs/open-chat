<script lang="ts">
    import { Body, BodySmall, ColourVars, Container, Spinner } from "component-lib";
    import type { DexId, DexQuote } from "@client";
    import { dexName, formatTokens } from "@client";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "@shared_components/Translatable.svelte";

    interface Props {
        // Each DEX's quote, in the order the DEXes were asked
        quotes: [DexId, DexQuote][];
        symbolOut: string;
        decimalsOut: number;
        // The DEX whose quote the swap will use, once all the quotes are in
        best: DexId | undefined;
    }

    let { quotes, symbolOut, decimalsOut, best }: Props = $props();
</script>

<Container
    gap={"lg"}
    background={ColourVars.surface1}
    padding={"lg"}
    borderRadius={"lg"}
    direction={"vertical"}
>
    {#each quotes as [dex, quote] (dex)}
        <Container mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"center"} gap={"sm"}>
            <Body width={"hug"} fontWeight={"bold"}>{dexName(dex)}</Body>
            {#if quote.kind === "quoting"}
                <Spinner
                    size={"1.25rem"}
                    strokeWidth={"2px"}
                    foregroundColour={ColourVars.textSecondary}
                    backgroundColour={ColourVars.primary} />
            {:else if quote.kind === "quoted"}
                <Container crossAxisAlignment={"end"} width={"hug"} direction={"vertical"}>
                    <Body
                        align={"end"}
                        width={"hug"}
                        fontWeight={"bold"}
                        colour={dex === best ? "primary" : "textPrimary"}
                    >
                        {`${formatTokens(quote.amountOut, decimalsOut)} ${symbolOut}`}
                    </Body>
                    {#if dex === best}
                        <BodySmall align={"end"} width={"hug"} colour={"primary"}>
                            <Translatable resourceKey={i18nKey("tokenSwap.quotes.best")} />
                        </BodySmall>
                    {/if}
                </Container>
            {:else}
                <BodySmall
                    align={"end"}
                    width={"hug"}
                    colour={quote.kind === "failed" ? "validationError" : "textSecondary"}
                >
                    <Translatable resourceKey={i18nKey(`tokenSwap.quotes.${quote.kind}`)} />
                </BodySmall>
            {/if}
        </Container>
    {/each}
</Container>

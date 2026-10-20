<script lang="ts">
    import type { DexId, DexQuote } from "@client";
    import { dexName, formatTokens } from "@client";
    import Spinner from "@shared_components/icons/Spinner.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

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

<div class="quotes">
    {#each quotes as [dex, quote] (dex)}
        <div class="quote">
            <div class="dex">{dexName(dex)}</div>
            <div class={`outcome ${quote.kind}`}>
                {#if quote.kind === "quoting"}
                    <Spinner
                        size="1.2em"
                        foregroundColour={"var(--bd)"}
                        backgroundColour={"var(--txt)"} />
                {:else if quote.kind === "quoted"}
                    {#if dex === best}
                        <span class="best"
                            ><Translatable resourceKey={i18nKey("tokenSwap.quotes.best")} /></span>
                    {/if}
                    {`${formatTokens(quote.amountOut, decimalsOut)} ${symbolOut}`}
                {:else}
                    <Translatable resourceKey={i18nKey(`tokenSwap.quotes.${quote.kind}`)} />
                {/if}
            </div>
        </div>
    {/each}
</div>

<style lang="scss">
    .quotes {
        display: flex;
        flex-direction: column;
        border: var(--bw) solid var(--bd);
        border-radius: var(--rd);
    }

    .quote {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: $sp3;
        padding: $sp3 $sp4;
        min-height: 47px;

        &:not(:last-child) {
            border-bottom: var(--bw) solid var(--bd);
        }
    }

    .dex {
        @include font(bold, normal, fs-100);
    }

    .outcome {
        display: flex;
        align-items: center;
        gap: $sp3;
        text-align: end;

        &.quoted {
            @include font(bold, normal, fs-100);
        }

        &.unsupported,
        &.declined {
            color: var(--txt-light);
        }

        &.failed {
            color: var(--error);
        }
    }

    .best {
        @include font(book, normal, fs-70);
        padding: $sp1 $sp2;
        border-radius: var(--rd);
        background-color: var(--button-bg);
        color: var(--button-txt);
    }
</style>

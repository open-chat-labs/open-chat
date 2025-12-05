<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { ColourVars, Tooltip } from "component-lib";
    import { PremiumItem, premiumItemsStore, premiumPrices } from "openchat-client";
    import { type Snippet } from "svelte";
    import Lock from "svelte-material-icons/Lock.svelte";
    import PremiumItemPayment from "./PremiumItemPayment.svelte";
    import Translatable from "./Translatable.svelte";

    type OnClick = () => void;

    interface Props {
        onClick: OnClick;
        children: Snippet<[OnClick]>;
        item: PremiumItem;
    }

    let { onClick, children, item }: Props = $props();
    let showPayGate = $state(false);
    let hasFeature = $derived($premiumItemsStore.has(item));

    let wrappedClick = $derived.by(() => {
        return () => {
            if (hasFeature) {
                showPayGate = false;
                return onClick();
            } else {
                showPayGate = true;
            }
        };
    });
</script>

{#if showPayGate}
    <PremiumItemPayment {item} onSuccess={wrappedClick} onCancel={() => (showPayGate = false)} />
{/if}

<Tooltip enable={!hasFeature} position="top" align="middle">
    <div class="premium" class:locked={!hasFeature}>
        {@render children(wrappedClick)}

        {#if !hasFeature}
            <div class="locked">
                <Lock size={"1.3em"} color={ColourVars.secondary} />
            </div>
        {/if}
    </div>
    {#snippet popup()}
        <Translatable
            resourceKey={i18nKey("premiumItem.priceTooltip", {
                price: premiumPrices[item].toLocaleString(),
            })}></Translatable>
    {/snippet}
</Tooltip>

<style lang="scss">
    .premium {
        position: relative;
        display: flex;
        justify-content: flex-start;
        align-items: flex-start;

        .locked {
            top: -0.3rem;
            left: -0.3rem;
            transition: opacity 200ms ease-in-out;
            position: absolute;
            pointer-events: none;
        }

        &:hover {
            .locked {
                opacity: 0.8;
            }
        }
    }
</style>

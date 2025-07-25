<script lang="ts">
    import Translatable from "@src/components/Translatable.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import { chitBands } from "openchat-client";
    import Tooltip from "../../tooltip/Tooltip.svelte";

    interface Props {
        earned: number;
        showTooltip?: boolean;
    }

    let { earned, showTooltip = true }: Props = $props();

    let chitIconText = $derived(
        earned === 1_000_000 ? "1 m" : Math.floor(earned / 1_000).toString(),
    );
    let show = $derived(earned > 0);
</script>

{#if show}
    {#if showTooltip}
        <Tooltip position="top" align="middle">
            <div class={`icon`}>
                {chitIconText}
            </div>
            {#snippet popupTemplate()}
                <Translatable
                    resourceKey={i18nKey("prizes.minChitEarnedValue", {
                        n: chitBands.get(earned) ?? "0",
                    })}></Translatable>
            {/snippet}
        </Tooltip>
    {:else}
        <div class="wrapper">
            <div>
                <Translatable
                    resourceKey={i18nKey("prizes.minChitEarnedValue", {
                        n: chitBands.get(earned) ?? "0",
                    })}></Translatable>
            </div>
            <div class={`icon`}>
                {chitIconText}
            </div>
        </div>
    {/if}
{/if}

<style lang="scss">
    .icon {
        $size: 18px;
        background-repeat: no-repeat;
        width: $size;
        height: $size;
        background-position: 50%;
        background-image: url("/assets/chit.svg");
        text-shadow: 1px 1px 0 rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        color: #fff;
        justify-content: center;
        @include font(bold, normal, fs-50);
        font-size: 8px;
    }

    .wrapper {
        display: flex;
        align-items: center;
        gap: $sp2;
    }
</style>

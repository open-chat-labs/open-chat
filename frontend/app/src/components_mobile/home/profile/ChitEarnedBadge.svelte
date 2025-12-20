<script lang="ts">
    import { Tooltip, Caption, ColourVars } from "component-lib";
    import Translatable from "@src/components/Translatable.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import { chitBands, findClosestChitBand } from "openchat-client";
    import BadgeContainer from "./BadgeContainer.svelte";

    interface Props {
        earned: number;
        showTooltip?: boolean;
    }

    let { earned, showTooltip = true }: Props = $props();

    let closest = $derived(findClosestChitBand(earned));

    let chitIconText = $derived(
        closest === 1_000_000 ? "1 m" : Math.floor(closest / 1_000).toString(),
    );
    let show = $derived(closest > 0);
</script>

{#snippet renderChit()}
    <BadgeContainer
        supplementalClass="chit-badge"
        backgroundColor={ColourVars.tertiaryMuted}
        backgroundImage={"/assets/oc_logo_no_bg.svg"}>
        <Caption align="center" fontWeight="bold">{chitIconText}</Caption>
    </BadgeContainer>
{/snippet}

{#if show}
    {#if showTooltip}
        <Tooltip position="top" align="middle">
            {@render renderChit()}
            {#snippet popup()}
                <Translatable
                    resourceKey={i18nKey("prizes.minChitEarnedValue", {
                        n: chitBands.get(closest) ?? "0",
                    })}></Translatable>
            {/snippet}
        </Tooltip>
    {:else}
        <div class="wrapper">
            <div>
                <Translatable
                    resourceKey={i18nKey("prizes.minChitEarnedValue", {
                        n: chitBands.get(closest) ?? "0",
                    })}></Translatable>
            </div>
            {@render renderChit()}
        </div>
    {/if}
{/if}

<style lang="scss">
    :global {
        .chit-badge {
            .oc-logo {
                // position: absolute;
            }

            .caption {
                z-index: 1;
                scale: 0.8;
                width: 100%;
                text-shadow:
                    -1px -1px 0 var(--tertiary-muted),
                    1px -1px 0 var(--tertiary-muted),
                    -1px 1px 0 var(--tertiary-muted),
                    1px 1px 0 var(--tertiary-muted);
            }
        }
    }

    .icon {
        $size: 17px;
        background-repeat: no-repeat;
        width: $size;
        height: $size;
        background-position: 50%;
        background-image: url("/assets/chit.svg");
        filter: saturate(0.8);
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

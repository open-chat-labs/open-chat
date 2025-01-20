<script lang="ts">
    import type { ResourceKey } from "openchat-client";
    import TooltipPopup from "../TooltipPopup.svelte";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import Translatable from "../Translatable.svelte";

    interface Props {
        verified: boolean;
        size: "small" | "medium" | "large";
        tooltip?: ResourceKey;
    }

    let { verified, size, tooltip }: Props = $props();
</script>

{#if verified}
    {#if tooltip !== undefined}
        <TooltipWrapper position="top" align="middle">
            <div slot="target" class={`verified ${size}`}></div>
            <div let:position let:align slot="tooltip" class="tooltip">
                <TooltipPopup {position} {align}>
                    <Translatable resourceKey={tooltip} />
                </TooltipPopup>
            </div>
        </TooltipWrapper>
    {:else}
        <div class={`verified ${size}`}></div>
    {/if}
{/if}

<style lang="scss">
    .verified {
        width: 15px;
        height: 15px;
        background-image: url("/assets/verified.svg");
        background-size: cover;
        background-repeat: no-repeat;

        &.large {
            width: 32px;
            height: 32px;
        }

        &.medium {
            width: 20px;
            height: 20px;
        }
    }
</style>

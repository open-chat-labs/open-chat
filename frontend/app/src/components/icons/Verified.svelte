<script lang="ts">
    import type { ResourceKey } from "openchat-client";
    import TooltipPopup from "../TooltipPopup.svelte";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import Translatable from "../Translatable.svelte";

    export let verified = false;
    export let size: "small" | "medium" | "large" = "small";
    export let tooltip: ResourceKey;
</script>

{#if verified}
    <TooltipWrapper position="top" align="middle">
        <div slot="target" class={`verified ${size}`}></div>
        <div let:position let:align slot="tooltip" class="tooltip">
            <TooltipPopup {position} {align}>
                <Translatable resourceKey={tooltip} />
            </TooltipPopup>
        </div>
    </TooltipWrapper>
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

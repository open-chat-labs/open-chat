<script lang="ts">
    import { i18nKey } from "../../i18n/i18n";
    import TooltipPopup from "../TooltipPopup.svelte";
    import TooltipWrapper from "../TooltipWrapper.svelte";
    import Translatable from "../Translatable.svelte";

    export let human = false;
    export let size: "small" | "large" = "small";
</script>

{#if human}
    <TooltipWrapper position="top" align="middle">
        <div slot="target" class={`human ${size}`}></div>
        <div let:position let:align slot="tooltip" class="tooltip">
            <TooltipPopup {position} {align}>
                <Translatable resourceKey={i18nKey("human.verified")} />
            </TooltipPopup>
        </div>
    </TooltipWrapper>
{/if}

<style lang="scss">
    .human {
        width: 16px;
        height: 16px;
        background-image: url("/assets/human.svg");
        background-size: cover;
        background-repeat: no-repeat;

        &.large {
            width: 32px;
            height: 32px;
        }
    }
</style>

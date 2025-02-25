<script lang="ts">
    import TooltipWrapper from "./TooltipWrapper.svelte";
    import TooltipPopup from "./TooltipPopup.svelte";
    import Help from "svelte-material-icons/HelpCircleOutline.svelte";
    import type { Alignment, Position } from "@src/utils/alignment";

    interface Props {
        position?: Position;
        align?: Alignment;
        color?: string;
    }

    let { position = "top", align = "end", color }: Props = $props();
</script>

<TooltipWrapper {position} {align}>
    <div slot="target" on:click class="help">
        <Help {color} />
    </div>
    <div let:position let:align slot="tooltip">
        <TooltipPopup {position} {align} textLength={100} longestWord={10}>
            <slot />
        </TooltipPopup>
    </div>
</TooltipWrapper>

<style lang="scss">
    .help {
        cursor: pointer;
        margin: 2px 4px -2px 4px;
    }
</style>

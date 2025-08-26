<script lang="ts">
    import { type Snippet } from "svelte";
    import Tooltip from "./tooltip/Tooltip.svelte";
    import Help from "svelte-material-icons/HelpCircleOutline.svelte";
    import type { Alignment, Position } from "@src/utils/alignment";

    interface Props {
        position?: Position;
        align?: Alignment;
        color?: string;
        children: Snippet;
        onClick?: () => void;
    }

    let { position = "top", align = "end", color, onClick, children }: Props = $props();
</script>

<Tooltip textLength={100} longestWord={10} {position} {align}>
    <div onclick={onClick} class="help">
        <Help {color} />
    </div>
    {#snippet popupTemplate()}
        {@render children()}
    {/snippet}
</Tooltip>

<style lang="scss">
    .help {
        cursor: pointer;
        margin: 2px 4px -2px 4px;
    }
</style>

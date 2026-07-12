<script lang="ts">
    interface Props {
        align?: "end" | "fill" | "center" | "start"; // we may need more options later but I think this covers it at the moment
        nowrap?: boolean;
        nogap?: boolean;
        children?: import("svelte").Snippet;
    }

    let { align = "end", nowrap = false, nogap = false, children }: Props = $props();
    const cls = `button-group ${align}`;
</script>

<div class:nowrap class={cls} class:nogap>
    {@render children?.()}
</div>

<style lang="scss">
    :global(.button-group.fill button) {
        flex: auto;
    }

    .button-group {
        display: flex;
        gap: $sp3;
        flex-wrap: wrap;

        &.nogap {
            gap: 0;
        }

        &.nowrap {
            flex-wrap: nowrap;
        }

        &.start {
            justify-content: flex-start;
        }

        &.end {
            justify-content: flex-end;
        }

        &.center {
            justify-content: center;
        }

        &.fill {
            justify-content: space-between;
        }
    }
</style>

<script lang="ts">
    export let align: "end" | "fill" | "center" | "start" = "end"; // we may need more options later but I think this covers it at the moment
    export let nowrap = false;
    export let nogap = false;
    const cls = `button-group ${align}`;
</script>

<div class:nowrap class={cls} class:nogap>
    <slot />
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

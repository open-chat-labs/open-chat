<script lang="ts">
    export let align: "end" | "fill" | "center" | "left" = "end"; // we may need more options later but I think this covers it at the moment
    const cls = `button-group ${align}`;
</script>

<div class={cls}>
    <slot />
</div>

<style type="text/scss">
    :global(.button-group.fill button) {
        flex: auto;
    }

    .button-group {
        display: flex;
        gap: $sp3;
        align-items: center;

        &.left {
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

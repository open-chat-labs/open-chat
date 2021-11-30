<script lang="ts">
    export let compact: boolean = false;
    export let semiCompact: boolean = false;
</script>

<div class="wrapper" class:compact class:semiCompact role="button">
    <slot />
</div>

<style type="text/scss">
    .wrapper {
        padding: $sp3;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: transparent;
        transition: background-color ease-in-out 100ms;
        cursor: pointer;

        &.compact {
            padding: $sp2;
        }

        &.semiCompact {
            padding: 6px;
        }

        &:hover {
            background-color: var(--icon-hv);
        }
    }
</style>

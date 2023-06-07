<script lang="ts">
    import { rtlStore } from "../stores/rtl";

    export let flush: boolean = false;
    export let shadow: boolean = false;
    export let entry = false;
    export let gap = false;
    export let border = true;
    export let height: number = 0;
</script>

<div
    class="section-header"
    class:border
    class:flush
    class:shadow
    class:entry
    class:gap
    class:rtl={$rtlStore}
    bind:clientHeight={height}>
    <slot />
</div>

<style lang="scss">
    .section-header {
        display: flex;
        position: sticky;
        top: 0;
        align-items: center;
        width: 100%;
        padding: $sp4 $sp5;
        height: toRem(80);
        // margin-bottom: $sp3;
        background-color: var(--section-bg);
        @include z-index("section-header");
        flex: 0 0 toRem(80);

        @include mobile() {
            padding: $sp3;
        }

        &.border {
            border-bottom: 1px solid var(--bd);
        }

        &.entry {
            background-color: var(--entry-bg);
        }

        &.flush {
            margin-bottom: 0;
        }

        &.flush.rtl {
            border-left: inherit;
        }

        &.gap {
            gap: $sp4;
        }
    }
</style>

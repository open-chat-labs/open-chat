<script lang="ts">
    import { rtlStore } from "../stores/rtl";
    import { currentTheme } from "../theme/themes";

    export let flush: boolean = false;
    export let shadow: boolean = false;
    export let slim: boolean = false;
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
    class:slim
    class:halloween={$currentTheme.name === "halloween"}
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
        background-color: var(--section-bg);
        @include z-index("section-header");
        flex: 0 0 toRem(80);

        &.halloween::before {
            @include cobweb();
            top: 100%;
            left: 0;
            transform: scaleX(-1);
        }

        &.halloween::after {
            @include cobweb();
            top: 100%;
            right: 0;
        }

        @include mobile() {
            padding: $sp3 toRem(10);

            &.slim {
                height: toRem(56);
                flex: 0 0 toRem(56);
            }
        }

        &.border {
            border-bottom: var(--bw) solid var(--bd);
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

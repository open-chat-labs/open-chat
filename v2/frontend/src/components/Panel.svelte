<script lang="ts">
    import { rtlStore } from "../stores/rtl";
    export let left: boolean = false;
    export let middle: boolean = false;
    export let right: boolean = false;
</script>

<section class:left class:right class:middle class:rtl={$rtlStore}>
    <slot />
</section>

<style type="text/scss">
    $left-width: 350px;
    $right-width: 350px;
    $trans: ease-in-out 200ms;

    section {
        transition: background $trans, width $trans, right $trans, padding $trans, left $trans,
            padding-left $trans;
        background: var(--panel-bg);
        padding: $sp3;
        overflow: auto;
        @include fullHeight();

        &.middle {
            width: 100%;
            padding-left: calc(#{$left-width + $sp3});
            &.rtl {
                padding-right: calc(#{$left-width});
                padding-left: $sp3;
            }
            @include size-below(xs) {
                padding: 0;
                &.rtl {
                    padding: 0;
                }
            }
        }

        &.left {
            display: flex;
            flex-direction: column;
            min-width: 320px;
            position: absolute;
            left: 0;
            top: 0;
            width: $left-width;
            &.rtl {
                right: 0;
            }
            @include fullHeight();
            @include z-index("left-panel");
            @include size-below(xs) {
                width: 100%;
                padding: 0;
            }
        }

        &.right {
            padding: 0px;
            width: $right-width;
            display: flex;
            flex-direction: column;
            @include size-below(xs) {
                width: 100%;
            }
        }
    }
</style>

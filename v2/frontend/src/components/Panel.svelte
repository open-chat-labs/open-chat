<script lang="ts">
    export let left: boolean = false;
    export let middle: boolean = false;
    export let right: boolean = false;
</script>

<section class:left class:right class:middle>
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
            flex: auto;
            width: 100%;
            padding-left: $sp3;
            padding-right: $sp3;
            @include size-below(xs) {
                padding: 0;
            }
        }

        &.left {
            flex: 0 0 $left-width;
            background: var(--panel-left-bg);
            display: flex;
            flex-direction: column;
            min-width: 320px;
            width: $left-width;
            @include fullHeight();
            @include size-below(xs) {
                width: 100%;
                padding: 0;
                flex: auto;
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

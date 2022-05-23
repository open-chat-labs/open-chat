<script lang="ts">
    import { newLayout } from "../stores/layout";

    export let left: boolean = false;
    export let middle: boolean = false;
    export let right: boolean = false;
</script>

<section class:new-layout={newLayout} class:left class:right class:middle>
    <slot />
</section>

<style type="text/scss">
    $left-width: 40%;
    $right-width: 500px;

    section {
        background: var(--panel-bg);
        padding-bottom: 0;
        overflow: auto;
        overflow-x: hidden;

        &.middle {
            padding-left: 0;
            padding-right: 0;
            @include mobile() {
                padding: 0;
            }

            &:not(.new-layout) {
                width: 100%;
                flex: auto;
            }

            &.new-layout {
                max-width: 840px;
                flex: 13;
                background: none;
            }
        }

        &.left,
        &.right {
            flex: 7;
            display: flex;
            flex-direction: column;
        }

        &.left {
            position: relative;
            background: var(--panel-left-bg);

            @include mobile() {
                width: 100%;
                max-width: none;
                padding: 0;
                flex: auto;
                background: var(--panel-left-xs);
            }
        }

        &:not(.new-layout).left {
            min-width: 236px;
            max-width: 550px;
            flex: 0 0 $left-width;

            @include mobile() {
                flex: auto;
            }
        }

        &.new-layout.right {
            background: var(--panel-right-bg);
            padding: 0px;

            @include size-above(xl) {
                background: var(--panel-left-bg);
            }

            /* Not that below xl the right panel is a modal and not in a flexbox container anymore! */
            @include size-below(xl) {
                @include fullHeight();
                max-width: 500px;
                min-width: 500px;
            }
            @include mobile() {
                width: 100%;
                min-width: 0;
                max-width: none;
            }
        }

        &:not(.new-layout).right {
            width: $right-width;
            display: flex;
            flex-direction: column;
            @include fullHeight();
            @include mobile() {
                width: 100%;
            }
        }
    }
</style>

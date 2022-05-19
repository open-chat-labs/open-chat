<script lang="ts">
    export let left: boolean = false;
    export let middle: boolean = false;
    export let right: boolean = false;
</script>

<section class:left class:right class:middle>
    <slot />
</section>

<style type="text/scss">
    $left-width: 40%;
    $right-width: 40%;

    section {
        background: var(--panel-bg);
        padding-bottom: 0;
        overflow: auto;
        overflow-x: hidden;

        &.middle {
            flex: 13;
            padding-left: 0;
            padding-right: 0;
            @include mobile() {
                padding: 0;
            }

            @include size-below(xxl) {
                flex: 12;
            }
        }

        &.left,
        &.right {
            flex: 7;
            display: flex;
            flex-direction: column;

            @include size-below(xxl) {
                flex: 8;
            }
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

        &.right {
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
    }
</style>

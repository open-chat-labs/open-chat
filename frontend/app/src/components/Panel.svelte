<script lang="ts">
    import { numberOfColumns } from "../stores/layout";
    import { mobileWidth } from "../stores/screenDimensions";

    export let left: boolean = false;
    export let nav: boolean = false;
    export let middle: boolean = false;
    export let right: boolean = false;
    export let forceModal: boolean = false;
    export let empty: boolean = false;

    $: modal = !$mobileWidth && (forceModal || $numberOfColumns === 2);
</script>

<section class:nav class:left class:right class:middle class:modal class:empty>
    <slot />
</section>

<style type="text/scss">
    $left-width: 40%;
    $right-width: 500px;

    section {
        padding-bottom: 0;
        overflow: auto;
        overflow-x: hidden;

        &.middle {
            padding-left: 0;
            padding-right: 0;
            @include mobile() {
                padding: 0;
            }
            flex: 13;
            background: none;
        }

        &.left,
        &.right {
            flex: 7;
            display: flex;
            flex-direction: column;

            @include size-above(xxl) {
                flex: 5;
            }
        }

        &.left {
            position: relative;
            border-right: 1px solid var(--bd);
            background: var(--panel-left-bg);

            @include mobile() {
                width: 100%;
                max-width: none;
                padding: 0;
                flex: auto;
                border-right: none;
            }
        }

        &.nav {
            display: flex;
            flex-direction: column;
            flex: 0 0 toRem(80);
            background-color: red;

            @include mobile() {
                flex: 0 0 toRem(60);
            }
        }

        &.right {
            // background: var(--panel-right-bg);
            padding: 0px;
            border-left: 1px solid var(--bd);
            background: var(--panel-right-bg);

            &.modal.right {
                background: var(--panel-right-modal);
                @include fullHeight();
                max-width: 500px;
                min-width: 500px;
            }

            @include mobile() {
                background: var(--panel-right-modal);
                width: 100%;
                height: 100%;
                min-width: 0;
                max-width: none;
                border-left: none;
            }

            &.empty {
                background: transparent;
            }
        }
    }
</style>

<script lang="ts">
    import { numberOfColumns } from "../stores/layout";
    import { fullScreen } from "../stores/settings";
    import { mobileWidth } from "../stores/screenDimensions";

    export let left: boolean = false;
    export let middle: boolean = false;
    export let right: boolean = false;
    export let forceModal: boolean = false;

    $: modal = !$mobileWidth && (forceModal || $numberOfColumns === 2);
</script>

<section class:fullscreen={$fullScreen} class:left class:right class:middle class:modal>
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
            flex: 13;
            background: none;

            &:not(.fullscreen) {
                max-width: 840px;
            }
        }

        &.left,
        &.right {
            flex: 7;
            display: flex;
            flex-direction: column;

            &.fullscreen {
                @include size-above(xxl) {
                    flex: 5;
                }
            }
        }

        &.left {
            position: relative;
            background: var(--panel-left-bg);
            border-right: 1px solid var(--panel-bd);

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
            border-left: 1px solid var(--panel-bd);

            @include size-above(xl) {
                background: var(--panel-left-bg);
            }

            &.modal.right {
                background: var(--panel-right-bg);
                @include fullHeight();
                max-width: 500px;
                min-width: 500px;
            }

            @include mobile() {
                background: var(--panel-right-bg);
                width: 100%;
                height: 100%;
                min-width: 0;
                max-width: none;
            }
        }
    }
</style>

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
    $right-width: 500px;
    $trans: ease-in-out 200ms;

    section {
        transition: background $trans, width $trans, right $trans, padding $trans, left $trans,
            padding-left $trans;
        background: var(--panel-bg);
        padding: var(--panel-pd);
        padding-bottom: 0;
        overflow: auto;
        overflow-x: hidden;

        &.middle {
            flex: auto;
            width: 100%;
            padding-left: 0;
            padding-right: 0;
            @include mobile() {
                padding: 0;
            }
        }

        &.left {
            flex: 0 0 $left-width;
            background: var(--panel-left-bg);
            display: flex;
            flex-direction: column;
            min-width: 236px;
            max-width: 550px;
            position: relative;
            @include mobile() {
                background: var(--panel-left-xs);
                width: 100%;
                max-width: none;
                padding: 0;
                flex: auto;
            }
        }

        &.right {
            background: var(--panel-right-bg);
            padding: 0px;
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

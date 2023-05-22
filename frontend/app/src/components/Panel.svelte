<script lang="ts">
    import { numberOfColumns } from "../stores/layout";
    import { mobileWidth } from "../stores/screenDimensions";
    import { rtlStore } from "../stores/rtl";
    import { menuStore } from "../stores/menu";
    import { navOpen } from "../stores/layout";
    import { communitiesEnabled } from "../utils/features";

    export let left: boolean = false;
    export let nav: boolean = false;
    export let middle: boolean = false;
    export let right: boolean = false;
    export let forceModal: boolean = false;
    export let empty: boolean = false;

    $: modal = !$mobileWidth && (forceModal || $numberOfColumns === 2);

    let delay: number | undefined = undefined;

    function mouseenter() {
        if (nav) {
            delay = window.setTimeout(() => {
                navOpen.set(true);
            }, 300);
        }
    }

    function mouseleave() {
        if ($menuStore === undefined && nav) {
            window.clearTimeout(delay);
            console.log("Closing nav");
            navOpen.set(false);
        }
    }
</script>

<section
    on:mouseenter={mouseenter}
    on:mouseleave={mouseleave}
    class:rtl={$rtlStore}
    class:nav
    class:left
    class:right
    class:middle
    class:modal
    class:hovering={$navOpen}
    class:nav-supported={$communitiesEnabled}
    class:empty>
    <slot />
</section>

<style type="text/scss">
    $left-width: 40%;
    $right-width: 500px;

    section {
        padding-bottom: 0;
        overflow: auto;
        overflow-x: hidden;

        // whichever panel is the 2nd panel should be nudged right to accommodate the nav
        &.nav-supported:nth-child(2) {
            margin-inline-start: toRem(80);
            @include mobile() {
                margin-inline-start: toRem(60);
            }
        }

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

            &.rtl {
                border-right: none;
                border-left: 1px solid var(--bd);
            }

            @include mobile() {
                width: 100%;
                max-width: none;
                padding: 0;
                flex: auto;
                border-right: none;
            }
        }

        &.nav {
            position: absolute;
            display: flex;
            flex-direction: column;
            // align-items: center;
            justify-content: space-between;
            width: toRem(80);
            // width: toRem(150);
            overflow-x: hidden;
            height: 100%;
            background: var(--panel-left-bg);
            background: var(--panel-right-modal);
            padding: 0;
            border-right: 1px solid var(--bd);
            @include z-index("left-nav");
            transition: width 250ms ease-in-out;

            &.rtl {
                border-right: none;
                border-left: 1px solid var(--bd);
            }

            @include mobile() {
                width: toRem(60);
            }

            &.hovering {
                width: toRem(350);
                box-shadow: 10px 0 10px rgba(0, 0, 0, 0.1);

                @include mobile() {
                    width: toRem(250);
                }
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

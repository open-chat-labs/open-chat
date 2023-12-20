<script lang="ts">
    import { fullWidth, layoutStore } from "../stores/layout";
    import { mobileWidth } from "../stores/screenDimensions";
    import { rtlStore } from "../stores/rtl";
    import { navOpen } from "../stores/layout";
    import { currentTheme } from "../theme/themes";

    export let left: boolean = false;
    export let nav: boolean = false;
    export let middle: boolean = false;
    export let right: boolean = false;
    export let forceModal: boolean = false;
    export let empty: boolean = false;
    export let resizable: boolean = false;

    let resizeHandle: HTMLElement | undefined;
    let panel: HTMLElement | undefined;

    let previous = 0;
    let resizing = false;
    let width = 0;

    function startResize(ev: MouseEvent) {
        previous = ev.clientX;
        // width = panel?.clientWidth;
        resizing = true;
    }

    function stopResize() {
        resizing = false;
    }

    function drag(ev: MouseEvent) {
        if (resizing) {
            const diff = ev.clientX - previous;
            console.log("Dragged by ", diff);
            if (panel) {
                panel.style.setProperty("flex", `0 0 ${panel.clientWidth + diff}px`);
            }
            previous = ev.clientX;
        }
    }

    $: modal = !$mobileWidth && (forceModal || !$fullWidth);
</script>

<svelte:window on:mousemove={drag} on:mouseup={stopResize} />

<section
    bind:this={panel}
    class:rtl={$rtlStore}
    class:nav
    class:left
    class:right
    class:middle
    class:modal
    class:resizable
    class:offset={$layoutStore.showNav}
    class:hovering={$navOpen}
    class:halloween={$currentTheme.name === "halloween"}
    class:empty>
    <slot />
    {#if resizable}
        <div on:mousedown={startResize} bind:this={resizeHandle} class="handle"></div>
    {/if}
</section>

<style lang="scss">
    :global(body.witch section.right.empty) {
        background: var(--panel-right-bg);
    }

    $left-width: 40%;
    $right-width: 500px;

    section {
        padding-bottom: 0;
        overflow: auto;
        overflow-x: hidden;

        // whichever panel is the 2nd panel should be nudged right to accommodate the nav
        &.offset:nth-child(2) {
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
            max-width: 500px; // need this for routes without the left panel
            flex: 7;
            display: flex;
            flex-direction: column;

            @include size-above(xxl) {
                flex: 5;
            }
        }

        &.left {
            position: relative;
            border-right: var(--bw) solid var(--bd);
            background: var(--panel-left-bg);
            resize: horizontal;

            &.rtl {
                border-right: none;
                border-left: var(--bw) solid var(--bd);
            }

            @include mobile() {
                width: 100%;
                max-width: none;
                padding: 0;
                flex: auto;
                border-right: none;
            }
        }

        &.resizable {
            .handle {
                position: absolute;
                right: 0;
                height: 100%;
                width: 10px;
                background-color: red;
                cursor: ew-resize;
            }
        }

        &.nav {
            position: absolute;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            width: toRem(80);
            overflow-x: hidden;
            height: 100%;
            background: var(--panel-nav-bg);
            padding: $sp2 0;
            border-right: var(--bw) solid var(--bd);
            @include z-index("left-nav");
            transition: width 250ms ease-in-out;

            &.rtl {
                border-right: none;
                border-left: var(--bw) solid var(--bd);
            }

            @include mobile() {
                width: toRem(60);
                padding: $sp1 0;
            }

            &.hovering {
                width: toRem(350);
                box-shadow: 10px 0 10px rgba(0, 0, 0, 0.1);

                @include mobile() {
                    width: toRem(300);
                }
            }
        }

        &.right {
            // background: var(--panel-right-bg);
            padding: 0px;
            border-left: var(--bw) solid var(--bd);
            background: var(--panel-right-bg);
            position: relative;

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

        &.halloween::after {
            @include cobweb();
            bottom: 0;
            right: 0;
            transform: scaleY(-1);
        }
    }
</style>

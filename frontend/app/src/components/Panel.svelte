<script lang="ts">
    import { fullWidth, layoutStore } from "../stores/layout";
    import { mobileWidth } from "../stores/screenDimensions";
    import { rtlStore } from "../stores/rtl";
    import { navOpen } from "../stores/layout";
    import { currentTheme } from "../theme/themes";
    import { rightPanelWidth } from "../stores/layout";

    const MIN_COL_WIDTH = 400;
    const MAX_COL_WIDTH = 900;

    export let left: boolean = false;
    export let nav: boolean = false;
    export let middle: boolean = false;
    export let right: boolean = false;
    export let forceModal: boolean = false;
    export let empty: boolean = false;
    export let resizable: boolean = false;

    let panel: HTMLElement | undefined;

    let previous = 0;
    let resizing = false;

    function startResize(ev: MouseEvent) {
        previous = ev.screenX;
        resizing = true;
        document.body.style.cursor = "ew-resize";
    }

    function stopResize() {
        resizing = false;
        document.body.style.cursor = "";
    }

    function resetSize() {
        rightPanelWidth.set(undefined);
    }

    function clampResize(size: number): number {
        if (size > MAX_COL_WIDTH) return MAX_COL_WIDTH;
        if (size < MIN_COL_WIDTH) return MIN_COL_WIDTH;
        return size;
    }

    function drag(ev: MouseEvent) {
        if (resizing) {
            const diff = previous - ev.screenX;
            if (panel) {
                if (right) {
                    rightPanelWidth.set(clampResize(panel.clientWidth + diff));
                }
            }
            previous = ev.screenX;
        }
    }

    $: modal = !$mobileWidth && (forceModal || !$fullWidth);
    $: resizedWidth = getWidthVar($rightPanelWidth);

    function getWidthVar(rw: number | undefined): string {
        if (right) {
            if (modal) {
                return rw ? `${rw}px` : "500px";
            } else {
                return rw ? `${rw}px` : "7";
            }
        }
        return "auto";
    }
</script>

<svelte:window on:mousemove={drag} on:mouseup={stopResize} />

<section
    bind:this={panel}
    style={`--resized-width: ${resizedWidth}`}
    class:rtl={$rtlStore}
    class:nav
    class:left
    class:right
    class:middle
    class:modal
    class:resizable
    class:resizing
    class:resized={$rightPanelWidth !== undefined}
    class:offset={$layoutStore.showNav}
    class:hovering={$navOpen}
    class:halloween={$currentTheme.name === "halloween"}
    class:empty>
    <slot />
    {#if resizable}
        <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
        <div
            role="separator"
            class:resizing
            on:mousedown={startResize}
            on:dblclick={resetSize}
            class="handle">
        </div>
    {/if}
</section>

<style lang="scss">
    :global(body.witch section.right.empty) {
        background: var(--panel-right-bg);
    }

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
            min-width: 500px;
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
            flex: 0 1 500px;
            min-width: 300px;
            position: relative;
            border-right: var(--bw) solid var(--bd);
            background: var(--panel-left-bg);

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

        &.resizing {
            user-select: none;
        }

        &.resizable {
            max-width: none;
            &.resized {
                flex: 0 0 var(--resized-width);
            }
            .handle {
                position: absolute;
                right: 0;
                height: 100%;
                width: 5px;
                cursor: ew-resize;
                transition: background-color 300ms ease-in-out;

                &.resizing,
                &:hover {
                    background-color: var(--accent);
                }
            }
        }

        &.right.resizable .handle {
            left: 0;
            right: unset;
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
                // max-width: 500px;
                min-width: 500px;

                &.resized {
                    width: var(--resized-width);
                }
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

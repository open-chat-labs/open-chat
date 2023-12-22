<script lang="ts">
    import { onMount } from "svelte";
    import { rightPanelWidth } from "../stores/layout";

    const MIN_COL_WIDTH = 400;
    const MAX_COL_WIDTH = 900;

    export let section: HTMLElement;
    export let modal: boolean;
    export let resizedWidth: string;
    export let resized: boolean;
    export let resizing = false;

    let previous = 0;

    onMount(() => {
        return rightPanelWidth.subscribe((width) => {
            resized = width !== undefined;
            resizedWidth = getWidthVar(width);
        });
    });

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
            rightPanelWidth.set(clampResize(section.clientWidth + diff));
            previous = ev.screenX;
        }
    }

    function getWidthVar(rw: number | undefined): string {
        if (modal) {
            return rw ? `${rw}px` : "500px";
        } else {
            return rw ? `${rw}px` : "7";
        }
    }
</script>

<svelte:window on:mousemove={drag} on:mouseup={stopResize} />

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div
    role="separator"
    class:resizing
    on:mousedown={startResize}
    on:dblclick={resetSize}
    class="handle">
</div>

<style lang="scss">
    .handle {
        position: absolute;
        left: 0;
        height: 100%;
        width: 5px;
        cursor: ew-resize;
        transition: background-color 300ms ease-in-out;

        &.resizing,
        &:hover {
            background-color: var(--accent);
        }
    }
</style>

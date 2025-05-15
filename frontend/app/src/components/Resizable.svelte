<script lang="ts">
    import { mobileWidth, ui } from "openchat-client";

    const MIN_COL_WIDTH = 400;
    const MAX_COL_WIDTH = 900;

    interface Props {
        section: HTMLElement;
        modal: boolean;
        resizedWidth: string;
        resized: boolean;
        resizing?: boolean;
    }

    let {
        section,
        modal,
        resizedWidth = $bindable(),
        resized = $bindable(),
        resizing = $bindable(false),
    }: Props = $props();

    resizedWidth;
    resized;

    let previous = 0;

    $effect(() => {
        const isResized = ui.rightPanelWidth !== undefined;
        if (isResized !== resized) {
            resized = isResized;
        }
    });

    $effect(() => {
        const widthVar = getWidthVar(ui.rightPanelWidth);
        if (widthVar !== resizedWidth) {
            resizedWidth = widthVar;
        }
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
        ui.rightPanelWidth = undefined;
    }

    function clampResize(size: number): number {
        if (size > MAX_COL_WIDTH) return MAX_COL_WIDTH;
        if (size < MIN_COL_WIDTH) return MIN_COL_WIDTH;
        return size;
    }

    function drag(ev: MouseEvent) {
        if (resizing) {
            const diff = previous - ev.screenX;
            const updated = clampResize(section.offsetWidth + diff);
            ui.rightPanelWidth = updated;
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

<svelte:window onmousemove={drag} onmouseup={stopResize} />

{#if !$mobileWidth}
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
        role="separator"
        class:resizing
        onmousedown={startResize}
        ondblclick={resetSize}
        class="handle">
    </div>
{/if}

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

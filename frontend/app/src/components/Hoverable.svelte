<script lang="ts">
    import { onMount } from "svelte";
    import { isTouchDevice } from "../utils/devices";

    const HOVER_DELAY = 250;
    const LONGPRESS_DELAY = 500;

    const maxDiffX = 10; // max number of X pixels the mouse can move during long press before it is canceled
    const maxDiffY = 10; // max number of Y pixels the mouse can move during long press before it is canceled

    export let hovering: boolean = false;
    export let longPressed: boolean = false;
    export let enableLongPress: boolean = false;
    export let coords: { x: number; y: number } = { x: 0, y: 0 };
    export let fill = false;

    let containerDiv: HTMLDivElement;
    let hoverTimer: number | undefined;
    let longPressTimer: number | undefined;

    // track number of pixels the mouse moves during long press
    let startX = 0; // mouse x position when timer started
    let startY = 0; // mouse y position when timer started

    function startHover(e: MouseEvent) {
        if (!isTouchDevice) {
            coords.x = e.clientX;
            coords.y = e.clientY;
            hoverTimer = window.setTimeout(() => (hovering = true), HOVER_DELAY);
        }
    }

    function endHover() {
        window.clearTimeout(hoverTimer);
        hovering = false;
    }

    function handleDocumentTouchStart() {
        if (longPressed) {
            cancelLongPress();
        }
    }

    function handleTouchStart(e: TouchEvent) {
        let t = e.changedTouches[0];
        startX = coords.x = t.clientX;
        startY = coords.x = t.clientY;

        cancelLongPress();

        longPressTimer = window.setTimeout(() => {
            if (longPressTimer !== undefined) {
                document.addEventListener("touchstart", handleDocumentTouchStart, { once: true });
                longPressed = true;
            }
        }, LONGPRESS_DELAY);

        e.stopPropagation();
    }

    function handleTouchMove(e: TouchEvent) {
        // calculate total number of pixels the pointer has moved
        let t = e.changedTouches[0];
        let diffX = Math.abs(startX - t.clientX);
        let diffY = Math.abs(startY - t.clientY);

        // if pointer has moved more than allowed, cancel the long-press timer and therefore the event
        if (diffX >= maxDiffX || diffY >= maxDiffY) {
            cancelLongPress();
        }
    }

    function handleTouchEnd(e: TouchEvent) {
        clearLongPressTimer();
        if (longPressed) {
            e.stopPropagation();
        }
    }

    function clearLongPressTimer() {
        if (longPressTimer !== undefined) {
            window.clearTimeout(longPressTimer);
            longPressTimer = undefined;
        }
    }

    function cancelLongPress() {
        clearLongPressTimer();
        longPressed = false;
    }

    function onContextMenu(e: MouseEvent) {
        e.preventDefault();
        startHover(e);
    }

    onMount(() => {
        if (isTouchDevice && enableLongPress) {
            containerDiv.addEventListener("touchend", handleTouchEnd);
            containerDiv.addEventListener("touchmove", handleTouchMove);
            containerDiv.addEventListener("touchstart", handleTouchStart);
            containerDiv.addEventListener("contextmenu", onContextMenu);
        }
        containerDiv.addEventListener("mouseenter", startHover);
        containerDiv.addEventListener("mouseleave", endHover);
        containerDiv.addEventListener("contextmenu", onContextMenu);

        return () => {
            if (isTouchDevice) {
                containerDiv.removeEventListener("touchend", handleTouchEnd);
                containerDiv.removeEventListener("touchmove", handleTouchMove);
                containerDiv.removeEventListener("touchstart", handleTouchStart);
                containerDiv.removeEventListener("contextmenu", onContextMenu);
            }
            containerDiv.removeEventListener("mouseenter", startHover);
            containerDiv.removeEventListener("mouseleave", endHover);
            containerDiv.removeEventListener("contextmenu", onContextMenu);
        };
    });

    export function getBoundingClientRect() {
        return containerDiv.getBoundingClientRect();
    }

    export function getDomElement() {
        return containerDiv;
    }
</script>

<div class:fill class="noselect" bind:this={containerDiv}>
    <slot />
</div>

<style lang="scss">
    .noselect {
        @include no_user_select();
        margin: auto;

        &.fill {
            width: 100%;
            text-align: center;
        }
    }
</style>

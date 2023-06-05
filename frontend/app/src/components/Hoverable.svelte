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
        coords.x = e.clientX;
        coords.y = e.clientY;
        hoverTimer = window.setTimeout(() => (hovering = true), HOVER_DELAY);
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
                longPressed = true;
            }
        }, LONGPRESS_DELAY);
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

    function handleTouchEnd() {
        clearLongPressTimer();
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

    onMount(async () => {
        if (isTouchDevice) {
            if (enableLongPress) {
                document.addEventListener("touchstart", handleDocumentTouchStart);
                containerDiv.addEventListener("touchend", handleTouchEnd);
                containerDiv.addEventListener("touchmove", handleTouchMove);
                containerDiv.addEventListener("touchstart", handleTouchStart);
                containerDiv.addEventListener("contextmenu", (e: MouseEvent) => {
                    e.preventDefault();
                });
            }
        } else {
            containerDiv.addEventListener("mouseenter", startHover);
            containerDiv.addEventListener("mouseleave", endHover);
            containerDiv.addEventListener("contextmenu", (e: MouseEvent) => {
                e.preventDefault();
                startHover(e);
            });
        }
    });

    export function getBoundingClientRect() {
        return containerDiv.getBoundingClientRect();
    }
</script>

<div class:fill class="noselect" bind:this={containerDiv}>
    <slot />
</div>

<style lang="scss">
    .noselect {
        -webkit-touch-callout: none; // Safari
        -webkit-user-select: none; // Safari
        -khtml-user-select: none; // Konqueror HTML
        -moz-user-select: none; // Old versions of Firefox
        -ms-user-select: none; // Internet Explorer/Edge
        user-select: none; // Non-prefixed version, currently supported by Chrome, Edge, Opera and Firefox

        &.fill {
            width: 100%;
            text-align: center;
        }
    }
</style>

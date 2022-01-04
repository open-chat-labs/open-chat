<script lang="ts">
    import { onMount } from "svelte";

    const HOVER_DELAY = 250;
    const LONGPRESS_DELAY = 500;

    const maxDiffX = 10; // max number of X pixels the mouse can move during long press before it is canceled
    const maxDiffY = 10; // max number of Y pixels the mouse can move during long press before it is canceled
    
    let containerDiv: HTMLDivElement;
    let hovering: boolean;
    let longPressing: boolean;
    let hoverTimer: number | undefined;
    let longPressTimer: number | undefined;

    // track number of pixels the mouse moves during long press
    let startX = 0; // mouse x position when timer started
    let startY = 0; // mouse y position when timer started

    function startHover() {
        hoverTimer = window.setTimeout(() => (hovering = true), HOVER_DELAY);
    }

    function endHover() {
        window.clearTimeout(hoverTimer);
        hovering = false;
    }

    function handleDocumentTouchStart() {
        if (longPressing) {
            clearLongPressTimer();
        }
    }

    function handleTouchStart(e: TouchEvent) {
        let t = e.changedTouches[0];
        startX = t.clientX;
        startY = t.clientY;
        
        clearLongPressTimer();

        longPressTimer = window.setTimeout(() => {
            if (longPressTimer !== undefined) {
                longPressing = true;
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
            clearLongPressTimer();
        }
    }

    function handleTouchEnd(e: TouchEvent) {
        if (longPressTimer !== undefined) {
            window.clearTimeout(longPressTimer);
            longPressTimer = undefined;
        }
    }

    function clearLongPressTimer() {
        if (longPressTimer !== undefined) {
            window.clearTimeout(longPressTimer);
            longPressTimer = undefined;
        }
        longPressing = false;
    }

    onMount(async () => {        
        let isTouch = (('ontouchstart' in window) || (navigator.maxTouchPoints > 0));

        if (isTouch) {
            document.addEventListener("touchstart", handleDocumentTouchStart);
            containerDiv.addEventListener("touchend", handleTouchEnd);
            containerDiv.addEventListener("touchmove", handleTouchMove);
            containerDiv.addEventListener("touchstart", handleTouchStart);
            containerDiv.addEventListener("contextmenu", (e: MouseEvent) => { 
                e.preventDefault(); 
            });
        } else {
            containerDiv.addEventListener("mouseenter", startHover);
            containerDiv.addEventListener("mouseleave", endHover);
            containerDiv.addEventListener("contextmenu", (e: MouseEvent) => { 
                e.preventDefault(); 
                startHover() 
            });
        }
    });
</script>

<div class="noselect" bind:this={containerDiv}>
	<slot hovering={hovering || longPressing}></slot>
</div>

<style type="text/scss">
    .noselect {
        -webkit-touch-callout: none; // Safari
        -webkit-user-select: none; // Safari
        -khtml-user-select: none; // Konqueror HTML
        -moz-user-select: none; // Old versions of Firefox
        -ms-user-select: none; // Internet Explorer/Edge
        user-select: none; // Non-prefixed version, currently supported by Chrome, Edge, Opera and Firefox
    }    
</style>
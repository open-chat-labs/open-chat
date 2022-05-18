<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { onMount } from "svelte";

    const dispatch = createEventDispatcher();

    export let active: boolean;
    export let fade: boolean = true;
    export let alignBottomOnMobile: boolean = true;
    export let dismissible: boolean = false;
    export let alignLeft = false;

    let ref: HTMLElement;

    /**
     * This acts like a portal i.e. where ever it is rendered in component hierarchy it will
     * attatch itself to the body of the document. This is what we want for a modal.
     */

    onMount(() => {
        let portal = document.createElement("div");
        portal.className = "portal";
        document.body.appendChild(portal);
        portal.appendChild(ref);

        window.addEventListener("popstate", popState);
        return () => {
            window.removeEventListener("popstate", popState);
            document.body.removeChild(portal);
        };
    });

    // make sure that the modal is closed if there is a routing event
    function popState() {
        onClose();
    }

    function onClick() {
        if (dismissible) {
            onClose();
        }
    }

    function onKeyDown(ev: KeyboardEvent) {
        if (dismissible && ev.key === "Escape") {
            onClose();
        }
    }

    function onClose() {
        active = false;
        dispatch("close");
    }
</script>

<svelte:window on:keydown={onKeyDown} />

<div class="blueprint">
    <div
        bind:this={ref}
        class="overlay"
        class:active
        class:faded={fade}
        class:align-bottom={alignBottomOnMobile}
        class:align-left={alignLeft}
        on:click={onClick}>
        {#if active}
            <slot />
        {/if}
    </div>
</div>

<style type="text/scss">
    .blueprint {
        display: none;
    }

    .overlay {
        @include z-index("overlay");
        position: absolute;
        display: flex;
        justify-content: center;
        align-items: center;
        top: 0;
        left: 0;
        @include fullHeight();
        width: 100%;
        pointer-events: none;
        overflow: hidden;

        @include mobile() {
            &.align-bottom {
                align-items: flex-end;
            }
        }

        &.align-left {
            justify-content: left;
        }

        &.active {
            pointer-events: all;

            &.faded {
                transition: background-color ease-in-out 100ms, backdrop-filter ease-in-out 100ms;
                backdrop-filter: var(--modal-filter);
                background-color: rgba(0, 0, 0, 0.5);
            }
        }
    }
</style>

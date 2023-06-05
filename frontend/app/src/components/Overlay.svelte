<script lang="ts">
    import { createEventDispatcher, tick } from "svelte";
    import { onMount } from "svelte";

    const dispatch = createEventDispatcher();

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

        if (fade) {
            tick().then(() => ref.classList.add("faded"));
        }

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
        dispatch("close");
    }
</script>

<svelte:window on:keydown={onKeyDown} />

<div class="blueprint">
    <div
        bind:this={ref}
        class="overlay"
        class:align-bottom={alignBottomOnMobile}
        class:align-left={alignLeft}
        on:click={onClick}>
        <slot />
    </div>
</div>

<style lang="scss">
    .blueprint {
        display: none;
    }

    :global(.overlay.faded) {
        // transition: background-color 100ms ease-in-out, backdrop-filter 100ms ease-in-out;
        backdrop-filter: var(--modal-filter);
        background-color: rgba(0, 0, 0, 0.5);
    }

    .overlay {
        @include z-index("overlay");
        position: fixed;
        display: flex;
        justify-content: center;
        align-items: center;
        top: 0;
        left: 0;
        @include fullHeight();
        width: 100%;
        overflow: hidden;

        @include mobile() {
            &.align-bottom {
                align-items: flex-end;
            }
        }

        &.align-left {
            justify-content: left;
        }
    }
</style>

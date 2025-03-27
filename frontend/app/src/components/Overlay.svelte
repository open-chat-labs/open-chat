<script lang="ts">
    import { tick, type Snippet } from "svelte";
    import { onMount } from "svelte";

    interface Props {
        fade?: boolean;
        alignBottomOnMobile?: boolean;
        dismissible?: boolean;
        alignLeft?: boolean;
        children?: Snippet;
        onClose?: () => void;
    }

    let {
        fade = true,
        alignBottomOnMobile = true,
        dismissible = false,
        alignLeft = false,
        children,
        onClose,
    }: Props = $props();

    let ref: HTMLElement;

    /**
     * This acts like a portal i.e. where ever it is rendered in component hierarchy it will
     * attatch itself to the body of the document. This is what we want for a modal.
     */

    onMount(() => {
        let portal = document.createElement("div");
        portal.id = "portal-element";
        portal.className = "portal";
        document.body.appendChild(portal);
        portal.appendChild(ref);

        if (fade) {
            tick().then(() => ref?.classList.add("faded"));
        }

        window.addEventListener("popstate", popState);
        return () => {
            window.removeEventListener("popstate", popState);
            document.body.removeChild(portal);
        };
    });

    // make sure that the modal is closed if there is a routing event
    function popState() {
        onClose?.();
    }

    function onMousedown(ev: MouseEvent) {
        if (dismissible && ev.target === ref) {
            onClose?.();
        }
    }

    function onKeyDown(ev: KeyboardEvent) {
        if (dismissible && ev.key === "Escape") {
            onClose?.();
        }
    }
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="blueprint">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        bind:this={ref}
        class="overlay"
        class:align-bottom={alignBottomOnMobile}
        class:align-left={alignLeft}
        onmousedown={onMousedown}>
        {@render children?.()}
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
        height: 100%;
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

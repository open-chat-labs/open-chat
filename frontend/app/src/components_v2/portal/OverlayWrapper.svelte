<script lang="ts">
    import { onMount, tick, type Snippet } from "svelte";

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

    let container: HTMLElement | undefined;

    onMount(() => {
        if (fade) {
            tick().then(() => container?.classList.add("faded"));
        }

        window.addEventListener("popstate", popState);
        return () => {
            window.removeEventListener("popstate", popState);
        };
    });

    // make sure that the modal is closed if there is a routing event
    // TODO - this could be done with an effect based on $routeStore - might be better
    function popState() {
        onClose?.();
    }

    function onMousedown(ev: MouseEvent) {
        if (dismissible && ev.target === container) {
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

{#if children}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        bind:this={container}
        class="overlay"
        class:align-bottom={alignBottomOnMobile}
        class:align-left={alignLeft}
        onmousedown={onMousedown}>
        {@render children?.()}
    </div>
{/if}

<style lang="scss">
    :global(.overlay.faded) {
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

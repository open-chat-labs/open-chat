<script lang="ts">
    import { ColourVars, Container } from "component-lib";
    import { type Snippet } from "svelte";
    import { SheetBehavior } from "component-lib";

    interface Props {
        onDismiss?: () => void;
        children?: Snippet;
    }

    let { onDismiss, children }: Props = $props();

    const sheetBehavior = new SheetBehavior();
    sheetBehavior.onCollapsed = dismissInternal;

    $effect(() => {
        return sheetBehavior.init();
    });

    export async function closeBeforeUnmount(): Promise<void> {
        return sheetBehavior.collapse();
    }

    function dismissInternal() {
        if (onDismiss !== undefined) onDismiss?.();
    }

    function onKeyDown(ev: KeyboardEvent) {
        if (ev.key === "Escape") sheetBehavior.collapse();
    }
</script>

<svelte:window onpopstate={dismissInternal} onkeydown={onKeyDown} />

<!-- TODO | There is still duplication in this file and AnchoredSheet as they
     TODO | have very similar CSS and HTML attached to them.
-->

<button
    class="backdrop"
    class:active={sheetBehavior.openFactor > 0.01}
    style={`opacity: ${sheetBehavior.openFactor};`}
    onclick={() => sheetBehavior.collapse()}
    aria-label="close sheet">
</button>

<Container
    bind:ref={sheetBehavior.sheet}
    supplementalClass={`transient_sheet`}
    direction={"vertical"}
    parentDirection={"vertical"}
    overflow={"hidden"}
    borderRadius={["md", "md", "zero", "zero"]}
    width={"fill"}
    background={ColourVars.background1}>
    <button
        bind:this={sheetBehavior.handle}
        onpointerdown={(e) => sheetBehavior.onDragStart(e)}
        onpointermove={(e) => sheetBehavior.onDrag(e)}
        onpointerup={(e) => sheetBehavior.onDragStop(e)}
        onpointercancel={(e) => sheetBehavior.onDragStop(e)}
        oncontextmenu={(e) => e.preventDefault()}
        aria-label="handle"
        class="handle"
        class:dragged={sheetBehavior.dragged}>
        <div class="inner"></div>
    </button>

    {@render children?.()}
</Container>

<style lang="scss">
    :global {
        .transient_sheet {
            pointer-events: all;
            view-transition-class: transient_sheet;

            position: fixed !important;
            z-index: 30;
            bottom: 0;
            left: 0;
            width: 100%;
        }
    }

    .backdrop {
        all: unset;
        inset: 0;
        position: fixed;
        z-index: 30; // puts it above all content
        background-color: var(--backdrop);
        pointer-events: none;

        &.active {
            pointer-events: auto;
        }
    }

    .handle {
        all: unset;
        padding-top: var(--sp-sm);
        padding-bottom: var(--sp-sm);
        position: sticky;
        touch-action: none;
        user-select: none;
        cursor: grab;
        top: 0rem;
        left: 50%;
        transform: translateX(-50%);
        width: 4rem;

        .inner {
            height: 0.25rem;
            border-radius: var(--rad-circle);
            background-color: var(--text-tertiary);
            transition:
                background-color 0.2s ease,
                box-shadow 0.2s ease;
        }

        &.dragged .inner {
            background-color: var(--primary);
            box-shadow: 0 0 0.5rem 0.125rem var(--primary-muted);
        }
    }
</style>

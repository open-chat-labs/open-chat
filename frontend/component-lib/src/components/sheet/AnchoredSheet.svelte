<script lang="ts">
    import { ColourVars, Container, SheetBehavior, fraction, type Fraction } from "component-lib";
    import { type Snippet } from "svelte";

    // We distinguish between the content which is displayed when the component
    // is collapsed, and when it is expanded!
    interface Props {
        collapsedContent: Snippet;
        expandedContent: Snippet;
        supplementalClass?: string;
        maxViewportHeightFraction?: Fraction;
        openThreshold?: Fraction;
        closeThreshold?: Fraction;
    }

    let {
        collapsedContent,
        expandedContent,
        supplementalClass,
        maxViewportHeightFraction = fraction(0.7),
        openThreshold = fraction(0.2),
        closeThreshold = fraction(0.9),
    }: Props = $props();

    const sheetBehavior = new SheetBehavior("anchored");
    sheetBehavior.maxViewportHeightFraction = maxViewportHeightFraction;
    sheetBehavior.openThreshold = openThreshold;
    sheetBehavior.closeThreshold = closeThreshold;

    $effect(() => {
        return sheetBehavior.init();
    });

    // Fading collapsed content in/out works in reverse compared to fading in
    // expanded content, and is limited to fading in/out before we reach the
    // open threshold so it must be scaled.
    function getCollapsedContentOpacity(): number {
        return 1 - sheetBehavior.openFactor / openThreshold;
    }

    export function collapse() {
        return sheetBehavior.collapse();
    }
</script>

<!-- TODO | There is still duplication in this file and SheetWrapper as they have
     TODO | very similar CSS and HTML attached to them.
-->
<button
    bind:this={sheetBehavior.backdrop}
    class="backdrop"
    class:active={sheetBehavior.openFactor > 0.2}
    onclick={() => sheetBehavior.collapse()}
    aria-label="close sheet">
</button>

<Container
    bind:ref={sheetBehavior.sheet}
    supplementalClass={`anchored_sheet ${supplementalClass ?? ""}`}
    overflow={"hidden"}
    direction={"vertical"}
    padding={["zero", "zero", "sm", "zero"]}
    width={"fill"}
    borderRadius={["md", "md", "zero", "zero"]}
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

    {#if sheetBehavior.openFactor < openThreshold}
        <div class="collapsed_content" style={`opacity: ${getCollapsedContentOpacity()}`}>
            {@render collapsedContent()}
        </div>
    {:else}
        <div class="expanded_content" style={`opacity: ${sheetBehavior.openFactor}`}>
            {@render expandedContent()}
        </div>
    {/if}
</Container>

<style lang="scss">
    :global(.container.anchored_sheet) {
        z-index: 10;
        margin-bottom: -0.5rem;
    }

    .backdrop {
        all: unset;
        inset: 0;
        position: fixed;
        z-index: 1;
        background-color: var(--backdrop);
        pointer-events: none;
        opacity: 0;

        &.active {
            pointer-events: auto;
        }
    }

    .collapsed_content,
    .expanded_content {
        width: 100%;
    }

    .collapsed_content {
        overflow: hidden;
    }

    .expanded_content {
        overflow: auto;
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

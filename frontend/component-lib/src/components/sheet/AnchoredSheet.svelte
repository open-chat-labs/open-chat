<script module lang="ts">
    export type Fraction = number & { readonly __brand: "Fraction" };

    // Ensures fractions are properly provided!
    function fraction(value: number): Fraction {
        if (value < 0 || value > 1) {
            throw new Error("Fraction must be between 0 and 1");
        }
        return value as Fraction;
    }

    // We distinguish between the content which is displayed when the component
    // is collapsed, and when it is expanded!
    export interface Props {
        collapsedContent: Snippet;
        expandedContent: Snippet;
        supplementalClass?: string;
        maxViewportHeightFraction?: Fraction;
        openThreshold?: Fraction;
        closeThreshold?: Fraction;
    }
</script>

<script lang="ts">
    import { ColourVars, Container } from "component-lib";
    import { type Snippet } from "svelte";

    let {
        collapsedContent,
        expandedContent,
        supplementalClass,
        maxViewportHeightFraction = fraction(0.7),
        openThreshold = fraction(0.2),
        closeThreshold = fraction(0.9),
    }: Props = $props();

    const EXPANDED_HEIGHT = computeExpandedSheetHeight();
    const SNAP_DURATION = 250; // ms

    let sheet: HTMLElement;
    let handle: HTMLElement;

    let isExpanded = $state(false);
    let openFactor = $state(0);
    let startY: undefined | number;
    let startHeight: undefined | number;
    let collapsedHeight = 100;

    // Vars below are used during the snapping phase, to update the openFactor
    // value. The animation itself is a CSS transition, but openFactor is used
    // to fade the content in/out.
    let animating = false;
    let animationStart = 0;
    let animationFrom = 0;
    let animationTo: 0 | 1 = 1;
    let animationDuration = 0;

    $effect(() => {
        if (sheet) {
            collapsedHeight = sheet.offsetHeight;
        }
    });

    export function collapse() {
        isExpanded = false;
        snapTo(0);
    }

    export function collapseInstant() {
        isExpanded = false;
        openFactor = 0;
        unsetSheetTransition();
        setSheetHeight(collapsedHeight);
    }

    export function expand() {
        isExpanded = true;
        snapTo(1);
    }

    // Fading collapsed content in/out works in reverse compared to fading in
    // expanded content, and is limited to fading in/out before we reach the
    // open threshold so it must be scaled.
    function getCollapsedContentOpacity(): number {
        return 1 - openFactor / openThreshold;
    }

    // TODO recalculate on resize once we modify this for web!
    function computeExpandedSheetHeight() {
        return Math.round(
            (window.visualViewport?.height ?? window.innerHeight) * maxViewportHeightFraction,
        );
    }

    // Calc how much the sheet is open as a 0..1 fraction
    function openness(height: number) {
        return Math.min(
            1,
            Math.max(0, (height - collapsedHeight) / (EXPANDED_HEIGHT - collapsedHeight)),
        );
    }

    function setSheetHeight(height: number) {
        sheet.style.height = `${height}px`;
    }

    function setSheetTransition(duration: number) {
        sheet.style.transition = `height ${duration}ms cubic-bezier(0.2, 0, 0, 1)`;
    }

    function unsetSheetTransition() {
        sheet.style.transition = "none";
    }

    // Only track movement in y dimension!
    function onDragStart(e: PointerEvent) {
        // Remove any transition that may be attached to the sheet...
        unsetSheetTransition();

        // Set handle as the target for future drag events!
        handle.setPointerCapture(e.pointerId);

        // If the user grabs handle in the middle of animation!
        animating = false;
        startY = e.clientY;
        startHeight = sheet.getBoundingClientRect().height;
    }

    function onDrag(e: PointerEvent) {
        if (!handle.hasPointerCapture(e.pointerId) || startY == null || startHeight == null) return;

        const delta = startY - e.clientY;
        const currentHeight = Math.min(
            EXPANDED_HEIGHT,
            Math.max(collapsedHeight, startHeight + delta),
        );

        // Call the open factor and set sheet height!
        openFactor = openness(currentHeight);
        setSheetHeight(currentHeight);
    }

    function onDragStop(e: PointerEvent) {
        if (handle.hasPointerCapture(e.pointerId)) {
            handle.releasePointerCapture(e.pointerId);
        }

        startY = undefined;
        startHeight = undefined;
        if (isExpanded) {
            openFactor <= closeThreshold ? collapse() : expand();
        } else {
            openFactor >= openThreshold ? expand() : collapse();
        }
    }

    // Snap duration depends on how much the sheet is currently open, and whether
    // we're trying to collapse or expand it. If we're at the beginning of either
    // open or close threshold, we want to run the snap animation
    function snapDuration(factor: number, target: 0 | 1) {
        let duration: number;
        if (target === 1) {
            duration = ((1 - factor) / (1 - openThreshold)) * SNAP_DURATION;
        } else {
            duration = (factor / closeThreshold) * SNAP_DURATION;
        }
        return Math.max(0, Math.min(SNAP_DURATION, duration));
    }

    // This function sets the CSS height transition for the sheet, and starts
    // the animation tracker function.
    function snapTo(target: 0 | 1) {
        animating = true;
        animationStart = performance.now();
        animationFrom = openFactor;
        animationTo = target;
        animationDuration = 2 * snapDuration(animationFrom, target);

        setSheetTransition(animationDuration);
        setSheetHeight(target === 1 ? EXPANDED_HEIGHT : collapsedHeight);

        // Shorten the duration for the content fade in, so it would finish by
        // the time CSS transition is done.
        animationDuration *= 0.9;
        requestAnimationFrame(trackAnimation);
    }

    // Just tracks along the expected CSS animation duration and updates the
    // openFactor value. It does NOT animate the sheet transition!
    function trackAnimation(now: number) {
        if (!animating) return;

        const elapsed = now - animationStart;
        const t = animationDuration === 0 ? 1 : Math.min(elapsed / animationDuration, 1);

        openFactor = animationFrom + (animationTo - animationFrom) * t;

        if (t < 1) {
            requestAnimationFrame(trackAnimation);
        } else {
            openFactor = animationTo;
            animating = false;
        }
    }
</script>

<button
    class="backdrop"
    style={`opacity: ${openFactor};`}
    onclick={collapse}
    aria-label="close sheet">
</button>

<Container
    bind:ref={sheet}
    supplementalClass={`anchored_sheet ${supplementalClass ?? ""}`}
    overflow={"hidden"}
    direction={"vertical"}
    padding={["sm", "zero", "sm", "zero"]}
    width={"fill"}
    borderRadius={["md", "md", "zero", "zero"]}
    background={ColourVars.background1}>
    <button
        bind:this={handle}
        onpointerdown={onDragStart}
        onpointermove={onDrag}
        onpointerup={onDragStop}
        onpointercancel={onDragStop}
        oncontextmenu={(e) => e.preventDefault()}
        aria-label="handle"
        class="handle">
        <div class="inner"></div>
    </button>

    {#if openFactor < openThreshold}
        <div class="collapsed_content" style={`opacity: ${getCollapsedContentOpacity()}`}>
            {@render collapsedContent()}
        </div>
    {:else}
        <div class="expanded_content" style={`opacity: ${openFactor}`}>
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
        }
    }
</style>

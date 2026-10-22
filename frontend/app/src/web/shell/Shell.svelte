<!-- The app's frame (Fix Brief - App Shell Layout): a padded page with the nav rail on it and two rounded
     panels beside it, the island (left column: lists and panels, and middle: conversation or
     workspace, one surface) and the right column (details). Laid out by the breakpoints in
     layout.ts and the container queries below, both on the shell's own width. Screens fill the
     regions through snippets; the shell only places them. -->
<script lang="ts">
    import { modal } from "@openchat/ui/src/lib/behaviours/modal";
    import { useT } from "@openchat/ui/src/lib/i18n";
    import { untrack, type Snippet } from "svelte";
    import { ColumnMotion } from "./columnMotion.svelte";
    import { narrowColumn } from "./layout";
    import { clearShellWidth, currentShellLayout, setShellWidth } from "./viewport.svelte";

    type Props = {
        rail: Snippet;
        left?: Snippet;
        middle: Snippet;
        // Which column a narrow viewport shows
        narrowView?: "left" | "middle";
    } & (
        | { right?: undefined }
        | {
              right: Snippet;
              // Whether the right column shows: docked, or as a modal below the docking width
              rightOpen: boolean;
              // A modal right column always needs a way out (its backdrop, Esc)
              onCloseRight: () => void;
              // The modal's accessible name: resource key (or literal text)
              rightLabel: string;
          }
    );

    let props: Props = $props();
    const { rail, left, middle } = $derived(props);
    const narrowView = $derived(props.narrowView ?? "left");
    const t = useT();

    // each field on its own, so a crossing only re-runs what depends on the field it changed
    const railMode = $derived(currentShellLayout().rail);
    const rightMode = $derived(currentShellLayout().right);

    // the shell's content width, the one its container queries see, for the layout code
    let shell: HTMLDivElement;
    $effect(() => {
        const observer = new ResizeObserver(([entry]) =>
            setShellWidth(entry.contentBoxSize?.[0]?.inlineSize ?? entry.contentRect.width),
        );
        observer.observe(shell);
        return () => {
            observer.disconnect();
            clearShellWidth();
        };
    });
    const narrow = $derived(narrowColumn(currentShellLayout(), left !== undefined, narrowView));

    // The right column opens and closes with motion: docked, it grows from nothing (taking its gap
    // with it) and pushes the island over while it fades in; as a modal, the panel rises in over
    // a fading backdrop. The motion is CSS, on the duration and easing tokens, which also take it
    // away for reduced motion. A shell crossing the docking width swaps one form for the other
    // without it, and so does a screen that comes or goes with its column.
    const columnForm = () => (props.right ? rightMode : "none");
    const motion = new ColumnMotion(
        untrack(() => !!props.right && props.rightOpen),
        untrack(columnForm),
    );
    $effect.pre(() => {
        const open = !!props.right && props.rightOpen;
        const form = columnForm();
        untrack(() => motion.update(open, form));
    });

    // the column's own size animation (the longest of its own), not its fade or one inside it
    function onAnimationEnd(e: AnimationEvent) {
        if (e.target === e.currentTarget && /(right-size|sheet)-/.test(e.animationName)) {
            motion.ended();
        }
    }
</script>

<!-- the window: it scrolls the shell when the window is smaller than the shell's minimum, so the
     page itself never does -->
<div class="frame">
    <div class="shell" bind:this={shell} data-rail={railMode} data-narrow={narrow}>
        <!-- below the pushRail breakpoint the slot keeps the collapsed rail's width, so the expanded
         rail floats over the island (NavRail's own contract). The rail scrolls on short windows. -->
        <div class="rail" data-rail-slot>
            <div class="rail-scroll">
                <!-- a rail expanded while it pushed the columns would cover them once it floats, so it
                 starts collapsed again whenever it switches between the two -->
                {#key railMode}
                    {@render rail()}
                {/key}
            </div>
        </div>
        <div class="shell-row">
            <!-- the left column and the middle share one panel, the left's border the only divider -->
            <div class="island">
                {#if left}
                    <div class="left">
                        {@render left()}
                    </div>
                {/if}
                <main class="middle">
                    {@render middle()}
                </main>
            </div>
            <!-- open / closed is the innermost block, so its motion plays on opening and closing -->
            {#if props.right}
                {#if rightMode === "dock"}
                    {#if motion.shown}
                        <aside
                            class="right"
                            class:entering={motion.entering}
                            class:closing={motion.closing}
                            inert={motion.closing}
                            onanimationend={onAnimationEnd}>
                            <div class="right-content">
                                {@render props.right()}
                            </div>
                        </aside>
                    {/if}
                {:else if motion.shown}
                    <!-- closing, it leaves the dialog stack (Esc, the focus trap) at once and lets
                     clicks through (inert) while it plays out -->
                    <div
                        class="right-modal"
                        class:entering={motion.entering}
                        class:closing={motion.closing}
                        inert={motion.closing}
                        use:modal={props.rightOpen ? props.onCloseRight : undefined}>
                        <!-- the keyboard closes it with Esc (use:modal) -->
                        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                        <div class="scrim" onclick={props.onCloseRight} aria-hidden="true"></div>
                        <div
                            class="sheet"
                            role="dialog"
                            aria-modal="true"
                            aria-label={t(props.rightLabel)}
                            onanimationend={onAnimationEnd}>
                            {@render props.right()}
                        </div>
                    </div>
                {/if}
            {/if}
        </div>
    </div>
</div>

<style>
    .frame {
        position: fixed;
        inset: 0;
        overflow: auto;
    }

    /* the page: 12px of it around everything, the panels 10px apart on it */
    .shell {
        box-sizing: border-box;
        display: flex;
        gap: var(--space-10);
        width: 100%;
        /* the island's minimum, the rail and the gap between them, and the padding (919px) */
        min-width: calc(825px + var(--rail-collapsed) + var(--space-10) + 2 * var(--space-12));
        height: 100%;
        min-height: 720px;
        padding: var(--space-12);
        overflow: hidden;
        background: var(--surface-0);
        color: var(--ink);
        /* the breakpoints are on the shell's own width (its content box) */
        container-type: inline-size;
    }

    .rail {
        flex: none;
        position: relative;
        z-index: var(--z-sticky);
    }

    .rail-scroll {
        height: 100%;
        overflow-x: hidden;
        overflow-y: auto;
        scrollbar-width: thin;
    }

    /* expanded, the rail is a surface of its own at the page's colour, rounded on its outer side */
    .rail-scroll:has(:global([data-rail-expanded="true"])) {
        background: var(--bg);
        border-start-start-radius: var(--radius-2xl);
        border-end-start-radius: var(--radius-2xl);
    }

    /* floating, the slot keeps the collapsed rail's width and the expanded rail goes over the
       island, wider and with a shadow; it's out of flow, so it can be wider than its slot */
    .shell[data-rail="float"] .rail {
        width: var(--rail-collapsed);
        --rail-expanded: var(--rail-floating);
    }

    .shell[data-rail="float"] .rail-scroll {
        position: absolute;
        inset-block: 0;
        inset-inline-start: 0;
    }

    /* on the scroller, which would clip a shadow on the rail inside it */
    .shell[data-rail="float"] .rail-scroll:has(:global([data-rail-expanded="true"])) {
        box-shadow: var(--shadow-panel);
    }

    .shell-row {
        flex: 1;
        min-width: 0;
        display: flex;
        gap: var(--space-10);
        /* the docked right column's steps as the shell grows */
        --right-width: 375px;
    }

    /* the panels: the island (left column and middle) and the right column */
    .island,
    .right {
        overflow: hidden;
        background: var(--surface-1);
        border-radius: var(--radius-2xl);
    }

    /* a ring in light mode only, never a border */
    :global(:root[data-mode="light"]) .island,
    :global(:root[data-mode="light"]) .right,
    :global(:root[data-mode="light"]) .sheet {
        box-shadow: 0 0 0 var(--border-hairline) var(--line-1);
    }

    .island {
        flex: 1;
        min-width: 0;
        display: flex;
    }

    .left {
        box-sizing: border-box;
        flex: none;
        width: 350px;
        min-width: 0;
        border-inline-end: var(--border-hairline) solid var(--line-1);
        overflow: hidden;
    }

    .middle {
        flex: 1;
        min-width: 0;
        overflow: hidden;
    }

    @container (min-width: 1200px) {
        .left {
            width: clamp(350px, 30cqw, 550px);
        }
    }

    @container (max-width: 1255px) {
        .island {
            min-width: 825px;
        }
    }

    @container (min-width: 1876px) {
        .shell-row {
            --right-width: 425px;
        }
    }

    @container (min-width: 2476px) {
        .shell-row {
            --right-width: 500px;
        }
    }

    .right {
        box-sizing: border-box;
        flex: none;
        width: var(--right-width);
        /* it collapses toward the inline end */
        --right-nudge: 10px;
    }

    :global(:root[dir="rtl"]) .right {
        --right-nudge: -10px;
    }

    /* the full width while the column grows or shrinks, so the content doesn't reflow */
    .right-content {
        width: var(--right-width);
        height: 100%;
    }

    /* opening, it grows from nothing, taking back the gap before it, and fades in; closing, the
       reverse */
    .right.entering {
        animation:
            right-size-in var(--duration-slow) var(--ease-out),
            right-fade-in var(--duration-base) var(--ease-out);
    }

    .right.closing {
        animation:
            right-size-out var(--duration-slow) var(--ease-out) forwards,
            right-fade-out var(--duration-base) var(--ease-out) forwards;
    }

    @keyframes right-size-in {
        from {
            width: 0;
            margin-inline-start: calc(-1 * var(--space-10));
        }
    }

    @keyframes right-size-out {
        to {
            width: 0;
            margin-inline-start: calc(-1 * var(--space-10));
        }
    }

    @keyframes right-fade-in {
        from {
            opacity: 0;
            transform: translateX(var(--right-nudge));
        }
    }

    @keyframes right-fade-out {
        to {
            opacity: 0;
            transform: translateX(var(--right-nudge));
        }
    }

    /* below the docking width: the same panel, centred over a dimmed, blurred page */
    .right-modal {
        position: fixed;
        inset: 0;
        z-index: var(--z-modal);
    }

    .scrim {
        position: absolute;
        inset: 0;
        background: var(--scrim);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
    }

    .sheet {
        position: absolute;
        inset-block: 4vh;
        inset-inline: 0;
        margin-inline: auto;
        width: min(600px, calc(100vw - 48px));
        overflow: hidden;
        background: var(--surface-1);
        border-radius: var(--radius-2xl);
    }

    .entering .sheet {
        animation: sheet-in var(--duration-slow) var(--ease-out);
    }

    .closing .sheet {
        animation: sheet-out var(--duration-slow) var(--ease-out) forwards;
    }

    .entering .scrim {
        animation: scrim-in var(--duration-slow) var(--ease-out);
    }

    .closing .scrim {
        animation: scrim-out var(--duration-slow) var(--ease-out) forwards;
    }

    @keyframes sheet-in {
        from {
            opacity: 0;
            transform: translateY(12px);
        }
    }

    @keyframes sheet-out {
        to {
            opacity: 0;
            transform: translateY(12px);
        }
    }

    @keyframes scrim-in {
        from {
            opacity: 0;
        }
    }

    @keyframes scrim-out {
        to {
            opacity: 0;
        }
    }

    /* one column at a time (the narrow pass, ROUTES.md; the shell's minimum width keeps it from
       showing until then) */
    .shell[data-narrow] .left {
        flex: 1;
        width: auto;
        border-inline-end: none;
    }

    .shell[data-narrow="left"] .middle,
    .shell[data-narrow="middle"] .left {
        display: none;
    }
</style>

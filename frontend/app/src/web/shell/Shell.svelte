<!-- The app's frame: nav rail, left column (lists and panels), middle (conversation or workspace) and
     right column (details), laid out by the breakpoints in layout.ts. Screens fill the regions
     through snippets; the shell only places them. -->
<script lang="ts">
    import { modal } from "@openchat/ui/src/lib/behaviours/modal";
    import { useT } from "@openchat/ui/src/lib/i18n";
    import { untrack, type Snippet } from "svelte";
    import { cubicOut } from "svelte/easing";
    import { MediaQuery } from "svelte/reactivity";
    import { currentShellLayout } from "./viewport.svelte";

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
    const listMode = $derived(currentShellLayout().list);
    const rightMode = $derived(currentShellLayout().right);
    const rightWidth = $derived(currentShellLayout().rightWidth);
    // a narrow screen without a left column shows the middle
    const narrow = $derived(
        currentShellLayout().narrow ? (left ? narrowView : "middle") : undefined,
    );

    // The right column opens and closes with motion: docked, it grows from the inline end and
    // pushes the middle over; as a modal, the sheet slides in over a fading scrim. A window
    // crossing the docking width swaps one for the other without it, and so does reduced motion.
    const reducedMotion = new MediaQuery("prefers-reduced-motion: reduce");
    let crossing = false;
    let previousRightMode = untrack(() => rightMode);
    $effect.pre(() => {
        const mode = rightMode;
        untrack(() => {
            if (mode === previousRightMode) return;
            previousRightMode = mode;
            // the swap happens in this update (its intro starts in a microtask); anything after
            // it is an open or a close again
            crossing = true;
            setTimeout(() => (crossing = false));
        });
    });

    function duration(): number {
        if (crossing || reducedMotion.current) return 0;
        const token = getComputedStyle(document.documentElement).getPropertyValue(
            "--duration-slow",
        );
        return Number.parseFloat(token) || 280;
    }

    // the column's width, from nothing; its content keeps the full width meanwhile
    function grow(_node: HTMLElement) {
        const width = rightWidth;
        return {
            duration: duration(),
            easing: cubicOut,
            css: (t: number) => `width: ${t * width}px`,
        };
    }

    // in from the inline end (the left in a right-to-left page)
    function slide(node: HTMLElement) {
        const sign = getComputedStyle(node).direction === "rtl" ? -1 : 1;
        return {
            duration: duration(),
            easing: cubicOut,
            css: (_t: number, u: number) => `transform: translateX(${sign * u * 100}%)`,
        };
    }

    function fade(_node: HTMLElement) {
        return { duration: duration(), easing: cubicOut, css: (t: number) => `opacity: ${t}` };
    }
</script>

<div
    class="shell"
    data-rail={railMode}
    data-list={listMode}
    data-narrow={narrow}
    style:--shell-right-width="{rightWidth}px">
    <!-- below the pushRail breakpoint the slot keeps the collapsed rail's width, so the expanded
         rail floats over the columns (NavRail's own contract). The rail scrolls on short windows. -->
    <div class="rail" data-rail-slot>
        <div class="rail-scroll">
            <!-- a rail expanded while it pushed the columns would cover them once it floats, so it
                 starts collapsed again whenever it switches between the two -->
            {#key railMode}
                {@render rail()}
            {/key}
        </div>
    </div>
    {#if left}
        <div class="left">
            {@render left()}
        </div>
    {/if}
    <main class="middle">
        {@render middle()}
    </main>
    <!-- open / closed is the innermost block, so its transitions play on opening and closing -->
    {#if props.right}
        {#if rightMode === "dock"}
            {#if props.rightOpen}
                <aside class="right" transition:grow>
                    <div class="right-content">
                        {@render props.right()}
                    </div>
                </aside>
            {/if}
        {:else if props.rightOpen}
            <div class="right-modal" use:modal={props.onCloseRight}>
                <!-- the keyboard closes it with Esc (use:modal) -->
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                <div
                    class="scrim"
                    onclick={props.onCloseRight}
                    aria-hidden="true"
                    transition:fade>
                </div>
                <div
                    class="sheet"
                    role="dialog"
                    aria-modal="true"
                    aria-label={t(props.rightLabel)}
                    transition:slide>
                    {@render props.right()}
                </div>
            </div>
        {/if}
    {/if}
</div>

<style>
    .shell {
        display: flex;
        height: 100vh;
        height: 100dvh;
        overflow: hidden;
        background: var(--surface-0);
        color: var(--ink);
    }

    .rail {
        flex: none;
        position: relative;
        z-index: var(--z-sticky);
        background: var(--surface-0);
    }

    .rail-scroll {
        height: 100%;
        overflow-x: hidden;
        overflow-y: auto;
        scrollbar-width: thin;
    }

    .shell[data-rail="float"] .rail {
        width: var(--rail-collapsed);
    }

    /* out of flow, so the expanded rail can be wider than its slot */
    .shell[data-rail="float"] .rail-scroll {
        position: absolute;
        inset-block: 0;
        inset-inline-start: 0;
    }

    /* on the scroller, which would clip a shadow on the rail inside it */
    .shell[data-rail="float"] .rail-scroll:has(:global([data-rail-expanded="true"])) {
        background: var(--surface-1);
        box-shadow: var(--shadow-panel);
    }

    .left,
    .right {
        box-sizing: border-box;
    }

    .left {
        flex: none;
        width: 350px;
        min-width: 0;
        border-inline-end: var(--border-hairline) solid var(--line-1);
        overflow: hidden;
    }

    .shell[data-list="fluid"] .left {
        width: clamp(350px, 30%, 550px);
    }

    .middle {
        flex: 1;
        min-width: 0;
        overflow: hidden;
    }

    .right {
        flex: none;
        width: var(--shell-right-width);
        border-inline-start: var(--border-hairline) solid var(--line-1);
        overflow: hidden;
    }

    /* the full width while the column grows or shrinks, so the content doesn't reflow */
    .right-content {
        width: var(--shell-right-width);
        height: 100%;
    }

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
        inset-block: 0;
        inset-inline-end: 0;
        width: min(var(--shell-right-width), 100%);
        overflow: hidden;
        background: var(--surface-1);
        box-shadow: var(--shadow-panel);
    }

    /* one column at a time */
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

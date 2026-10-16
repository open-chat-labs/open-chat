<!-- The app's frame: nav rail, left column (lists and panels), middle (conversation or workspace) and
     right column (details), laid out by the breakpoints in layout.ts. Screens fill the regions
     through snippets; the shell only places them. -->
<script lang="ts">
    import { modal } from "@openchat/ui/src/lib/behaviours/modal";
    import type { Snippet } from "svelte";
    import { currentShellLayout } from "./viewport.svelte";

    interface Props {
        rail: Snippet;
        left?: Snippet;
        middle: Snippet;
        right?: Snippet;
        // Whether the right column shows: docked, or as a modal below the docking width
        rightOpen?: boolean;
        onCloseRight?: () => void;
        // Which column a narrow viewport shows
        narrowView?: "left" | "middle";
    }

    let {
        rail,
        left,
        middle,
        right,
        rightOpen = false,
        onCloseRight,
        narrowView = "left",
    }: Props = $props();

    const layout = $derived(currentShellLayout());
    // a narrow screen without a left column shows the middle
    const narrow = $derived(layout.narrow ? (left ? narrowView : "middle") : undefined);
</script>

<div
    class="shell"
    data-rail={layout.rail}
    data-list={layout.list}
    data-narrow={narrow}
    style:--shell-right-width="{layout.rightWidth}px">
    <!-- below PUSH_RAIL_MIN the slot keeps the collapsed rail's width, so the expanded rail
         floats over the columns (NavRail's own contract) -->
    <div class="rail" data-rail-slot>
        {@render rail()}
    </div>
    {#if left}
        <div class="left">
            {@render left()}
        </div>
    {/if}
    <main class="middle">
        {@render middle()}
    </main>
    {#if right && rightOpen}
        {#if layout.right === "dock"}
            <aside class="right">
                {@render right()}
            </aside>
        {:else}
            <div class="right-modal" use:modal={onCloseRight}>
                <!-- the keyboard closes it with Esc (use:modal) -->
                <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
                <div class="scrim" onclick={onCloseRight} aria-hidden="true"></div>
                <div class="sheet" role="dialog" aria-modal="true">
                    {@render right()}
                </div>
            </div>
        {/if}
    {/if}
</div>

<style>
    .shell {
        display: flex;
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

    /* NavRail's collapsed width */
    .shell[data-rail="float"] .rail {
        width: 60px;
    }

    .shell[data-rail="float"] .rail :global([data-rail-expanded="true"]) {
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

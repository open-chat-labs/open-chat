<!-- The pinned strip under a conversation's header (native plan 04, "Pinned messages"), while something
     is pinned: a segmented bar (a segment per pin, four at most, the current one in the accent),
     "Pinned message · 1 of 3" and the pin's "Author: first line"; a tap goes to that pin (the
     conversation's), and the list button opens the Pinned messages screen. -->
<script lang="ts">
    import type { Snippet } from "svelte";
    import type { StripBar } from "./pinned.adapter";

    type Props = {
        bar: StripBar;
        /** "Pinned message" or "Pinned message · 1 of 3". */
        title: string;
        /** "Author: first line" (the host's markdown, for its mentions); none while it's on its way. */
        line: Snippet | undefined;
        /** The list button's accessible name ("All pinned messages"). */
        listLabel: string;
        onTap: () => void;
        onList: () => void;
    };

    let { bar, title, line, listLabel, onTap, onList }: Props = $props();
</script>

<div class="strip">
    <button type="button" class="pin" onclick={onTap}>
        <span class="bar" aria-hidden="true">
            {#each { length: bar.segments }, i}
                <span class="segment" class:active={i === bar.active}></span>
            {/each}
        </span>
        <span class="text">
            <span class="title">{title}</span>
            <span class="line">{@render line?.()}</span>
        </span>
    </button>
    <button type="button" class="list" aria-label={listLabel} title={listLabel} onclick={onList}>
        <span class="icon" style:mask="var(--icon-list) center/contain no-repeat"></span>
    </button>
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    // 52px at least, 6px 4px 6px 16px, a hairline under it (04)
    .strip {
        flex: none;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        min-height: 52px;
        padding: var(--space-6) var(--space-4) var(--space-6) var(--space-16);
        border-bottom: 1px solid var(--line-1);
        background: var(--surface-0);
    }

    .pin {
        all: unset;
        flex: 1;
        min-width: 0;
        align-self: stretch;
        display: flex;
        align-items: center;
        gap: var(--space-10);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
    }

    // a 3px bar, a segment per pin: the current one in the accent, the others at 30%
    .bar {
        flex: none;
        align-self: stretch;
        width: 3px;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .segment {
        flex: 1;
        border-radius: var(--radius-pill);
        background: color-mix(in oklch, var(--accent) 30%, transparent);
        transition: background 0.2s ease;

        &.active {
            background: var(--accent);
        }

        @include reduced-motion {
            transition: none;
        }
    }

    .text {
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .title {
        font: var(--weight-semibold) text-size(12px) / 1.3 var(--font-sans);
        color: var(--accent-bright);
        @include truncate;
    }

    .line {
        min-width: 0;
        min-height: 1.3em;
        font: var(--weight-medium) text-size(13.5px) / 1.3 var(--font-sans);
        color: var(--ink);
        @include truncate;

        // the markdown's own paragraph, one line, without its margins
        :global(.markdown-wrapper) {
            margin: 0;
            line-height: inherit;
            color: inherit;
        }
    }

    .list {
        all: unset;
        flex: none;
        width: 44px;
        height: 44px;
        display: grid;
        place-items: center;
        border-radius: var(--radius-circle);
        color: var(--ink-2);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:focus-visible {
            outline: 2px solid var(--accent);
        }
    }

    .icon {
        width: 22px;
        height: 22px;
        background: currentColor;
    }
</style>

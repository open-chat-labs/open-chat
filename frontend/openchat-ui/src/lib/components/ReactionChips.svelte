<!-- A message's reaction chips, overlapping the bottom edge of the bubble above them. Limited to maxRows; the rest fold
     into a "+N" chip that expands them, and a close chip folds them again. Click a chip → onToggle(emoji).
     By hand: ChatBubble's chips as their own component, so every kind of message shows its reactions (MessageGroup puts
     them under the kinds that don't draw their own). -->
<script lang="ts" module>
  export interface Reaction {
    emoji: string;
    count: number;
    mine?: boolean;
  }
</script>

<script lang="ts">
  import { untrack } from 'svelte';
  import { useT } from '../i18n';

  interface Props {
    reactions: Reaction[];
    /** Rows of chips before the rest fold into "+N". */
    maxRows?: number;
    /** Right-aligned layouts (native sent bubbles): the chips at the inline end, under the message. */
    mirror?: boolean;
    onToggle?: (emoji: string) => void;
    onShowAll?: () => void;
  }

  let { reactions, maxRows = 1, mirror = false, onToggle, onShowAll }: Props = $props();
  const t = useT();

  // fit === null renders every chip so their rows can be measured
  let fit = $state<number | null>(null);
  let expanded = $state(false);
  let chips = $state<HTMLDivElement>();

  const shown = $derived(fit === null || expanded ? reactions : reactions.slice(0, fit));
  const hidden = $derived(reactions.length - shown.length);

  // no arithmetic: let the browser wrap, read how many rows it actually used,
  // and drop one chip per pass until it fits. Monotonic, so it always terminates.
  $effect(() => {
    void shown;
    const el = chips;
    if (!el || untrack(() => expanded)) return;
    const kids = [...el.children];
    if (!kids.length) return;
    const rows = new Set(kids.map((k) => Math.round(k.getBoundingClientRect().top))).size;
    if (rows <= Math.max(1, maxRows)) return;
    const count = untrack(() => (fit === null ? reactions.length : fit));
    if (count > 1) fit = count - 1;
  });

  // the row is as wide as the message (width 0, min-width 100%), whatever its chips: a stable trigger
  // to show them all and converge down again when the message's width changes
  $effect(() => {
    const el = chips;
    if (!el) return;
    let last = el.getBoundingClientRect().width;
    const ro = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width;
      if (!w || Math.abs(w - last) < 1) return;
      last = w;
      if (!untrack(() => expanded)) fit = null;
    });
    ro.observe(el);
    return () => ro.disconnect();
  });
</script>

{#if reactions.length > 0}
  <div class="reactions" class:mirror bind:this={chips}>
    {#each shown as r}
      <span
        class="chip"
        class:mine={r.mine}
        data-oc-chip
        onclick={() => onToggle?.(r.emoji)}
        role="button"
        tabindex="0"
        aria-pressed={!!r.mine}
        aria-label={t(r.mine ? 'ui.chatBubble.removeReaction' : 'ui.chatBubble.addReaction', { emoji: r.emoji, count: r.count })}>{r.emoji} {r.count}</span
      >
    {/each}
    {#if hidden > 0}
      <span
        class="chip-more"
        data-oc-more
        onclick={() => {
          onShowAll?.();
          expanded = true;
          fit = null;
        }}
        role="button"
        tabindex="0">+{hidden}</span
      >
    {/if}
    {#if expanded}
      <span
        class="collapse"
        onclick={() => {
          expanded = false;
          fit = null;
        }}
        role="button"
        tabindex="0"><span class="collapse-icon"></span></span
      >
    {/if}
  </div>
{/if}

<style lang="scss">
  @use '../styles/mixins' as *;

  .reactions {
    width: 0;
    min-width: 100%;
    box-sizing: border-box;
    padding-inline-start: 8px;
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-start;
    gap: var(--space-4);
    margin-top: -9px;
    position: relative;
    z-index: 2;

    &.mirror {
      justify-content: flex-end;
      padding-inline: 0 8px;
    }
  }

  /* chips overlap the bubble's bottom edge, so their backgrounds are opaque */
  .chip {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-6) var(--space-8);
    border-radius: var(--radius-pill);
    background: var(--card-2);
    box-shadow: inset 0 0 0 1px var(--line-2);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2);
    cursor: pointer;
    user-select: none;

    &.mine {
      background: color-mix(in oklch, var(--accent) 20%, var(--card-2));
      box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 55%, transparent);
      color: var(--ink);
    }

    &:hover {
      filter: brightness(1.15);
    }

    &:focus-visible {
      @include focus-ring;
    }
  }

  .chip-more,
  .collapse {
    display: flex;
    align-items: center;
    border-radius: var(--radius-pill);
    background: var(--card-2);
    box-shadow: inset 0 0 0 1px var(--line-2);
    cursor: pointer;
  }

  .chip-more {
    padding: var(--space-6) var(--space-8);
    font: var(--weight-semibold) var(--text-sm) / 1 var(--font-sans);
    color: var(--ink-2);
    white-space: nowrap;
  }

  .collapse {
    justify-content: center;
    height: 24px;
    min-width: 24px;
    box-sizing: border-box;
  }

  .chip-more:hover,
  .collapse:hover {
    background: var(--overlay-2);
  }

  .collapse-icon {
    @include icon(close, 10px, var(--ink-2), $flex: null);
  }
</style>

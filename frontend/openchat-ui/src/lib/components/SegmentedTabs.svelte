<!-- Segmented tab bar. Left/Right/Home/End move and select (automatic activation), RTL-aware.
     With onSelect the parent owns the selection; without, it keeps its own. counts are index-aligned (null = no pill).
     size="sm" is the compact bar (40px, 3px inset): native's chat filter and settings rows. One plate slides to the
     picked tab, wherever it sits and however wide it is (none under reduced motion). Labels stay on one line; a bar too
     narrow for them all is tight: its tabs shrink with their content and a label ends in an ellipsis (lib/tabsFit). -->
<script lang="ts">
  import { useT } from '../i18n';
  import { rove } from '../behaviours/rove';
  import { tabsFit } from '../tabsFit';

  interface Props {
    /** Tab labels: resource keys (or literal text). */
    labels: string[];
    counts?: (number | null | undefined)[];
    selectedIndex?: number;
    /** Tabs that show an accent dot; overrides dotOnLast. */
    dotIndexes?: number[] | null;
    dotOnLast?: boolean;
    /** md: 44px. sm: the compact 40px bar with a 3px inset (native). */
    size?: 'md' | 'sm';
    onSelect?: (i: number) => void;
  }

  let { labels, counts = [], selectedIndex = 0, dotIndexes = null, dotOnLast = true, size = 'md', onSelect }: Props = $props();
  const t = useT();

  let own = $state<number | null>(null);
  const active = $derived(onSelect ? selectedIndex : (own ?? selectedIndex));

  function select(i: number) {
    if (onSelect) onSelect(i);
    else own = i;
  }

  // the plate follows the picked tab's box, measured, so tabs keep their widths (a long label still widens its tab).
  // Until it's measured (or while the bar is hidden) the picked tab draws its own plate; the slide starts after the first place.
  const tabEls: HTMLElement[] = $state([]);
  let place = $state<{ x: number; w: number } | null>(null);
  let moving = $state(false);

  $effect(() => {
    const el = tabEls[active];
    if (!el) return;
    const measure = () => {
      place = el.offsetWidth ? { x: el.offsetLeft, w: el.offsetWidth } : null;
    };
    measure();
    // a tab's offset moves when any tab or the bar resizes (a count appears, the bar's width changes); none in jsdom
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    for (const t of tabEls) if (t) ro.observe(t);
    return () => ro.disconnect();
  });

  $effect(() => {
    if (!place || moving) return;
    const raf = requestAnimationFrame(() => (moving = true));
    return () => cancelAnimationFrame(raf);
  });

  // tight when the labels don't all fit on one line at their full widths (long or translated labels, a narrow phone):
  // the tabs then shrink with their content, a label ending in an ellipsis, rather than spilling out of the bar. Read
  // from the parts' full widths (a clipped label's scrollWidth is still its whole text), so it reads the same either way.
  let bar = $state<HTMLElement>();
  let tight = $state(false);

  $effect(() => {
    const el = bar;
    // a label, count or dot added or taken away
    void [labels, counts, dotIndexes, dotOnLast];
    if (!el) return;
    const px = (value: string) => parseFloat(value) || 0;
    const measure = () => {
      // a hidden bar has nothing to fit; it's measured again when it shows
      if (!el.clientWidth) return;
      const style = getComputedStyle(el);
      const tabs = tabEls.filter(Boolean).map((tab) => ({
        widths: [...tab.querySelectorAll<HTMLElement>(':scope > .label, :scope > .count, :scope > .dot')].map((part) =>
          part.classList.contains('label') ? part.scrollWidth : part.offsetWidth,
        ),
        gap: px(getComputedStyle(tab).columnGap),
      }));
      tight = !tabsFit({ width: el.clientWidth, padding: px(style.paddingLeft) + px(style.paddingRight), gap: px(style.columnGap) }, tabs);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const tab of tabEls) if (tab) for (const part of tab.children) ro.observe(part);
    return () => ro.disconnect();
  });

  function keyNav(e: KeyboardEvent & { currentTarget: HTMLElement }) {
    rove(e, '[role="tab"]', 'h')?.click();
  }
</script>

<div class="wrap">
  <div class="tabs" class:sm={size === 'sm'} class:tight bind:this={bar} role="tablist" onkeydown={keyNav}>
    {#if place}
      <div class="plate sliding" class:moving aria-hidden="true" style:width="{place.w}px" style:transform="translateX({place.x}px)"></div>
    {/if}
    {#each labels as label, i}
      {@const selected = i === active}
      <div class="tab" class:selected bind:this={tabEls[i]} onclick={() => select(i)} role="tab" aria-selected={selected} tabindex={selected ? 0 : -1}>
        {#if selected && !place}
          <div class="plate"></div>
        {/if}
        <span class="label">{t(label)}</span>
        {#if counts[i] != null}
          <span class="count">{counts[i]}</span>
        {/if}
        {#if dotIndexes ? dotIndexes.includes(i) : dotOnLast && i === labels.length - 1}
          <span class="dot"></span>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style lang="scss">
  @use '../styles/mixins' as *;

  .wrap {
    width: 100%;
  }

  .tabs {
    --tabs-pad: var(--space-4);
    position: relative;
    display: flex;
    gap: var(--space-4);
    height: var(--control-xl);
    box-sizing: border-box;
    padding: var(--space-4);
    background: var(--overlay-1);
    box-shadow: inset 0 0 0 1px var(--line-1);
    border-radius: var(--radius-md);

    // the compact bar: what the native prototype set per screen (--control-xl: 40px; --space-4: 3px)
    &.sm {
      --tabs-pad: 3px;
      gap: 3px;
      height: var(--control-lg);
      padding: 3px;
    }
  }

  .tab {
    flex: 1;
    position: relative;
    @include flex-center;
    gap: var(--space-4);
    border-radius: var(--radius-sm);
    cursor: pointer;

    .sm & {
      gap: 3px;
    }

    &:hover {
      background: var(--overlay-1);
    }

    // over the sliding plate the picked tab's hover would cover it
    &.selected:hover {
      background: none;
    }

    // too narrow for every label on one line: each tab shrinks with its content, never out of the bar
    .tight & {
      flex: 1 1 auto;
      min-width: 0;
    }
  }

  .plate {
    position: absolute;
    inset: 0;
    border-radius: var(--radius-sm);
    background: var(--card);
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.16),
      inset 0 0 0 1px var(--line-2);
  }

  // placed from the bar's padding edge by the picked tab's offset (offsetLeft is physical, so RTL needs nothing more)
  .plate.sliding {
    inset: var(--tabs-pad) auto var(--tabs-pad) 0;
  }

  .plate.moving {
    // TODO(design): the slide's timing; the design export has no moving plate
    transition:
      transform var(--duration-slow) var(--ease-out),
      width var(--duration-slow) var(--ease-out);

    @include reduced-motion {
      transition: none;
    }
  }

  // one line: a label too long for an equal share widens its tab (its min-content), the others giving way, rather
  // than breaking onto a second line inside the plate (the chat list's four search tabs at a narrow panel). In a tight
  // bar, where not every label fits, it ends in an ellipsis instead
  .label {
    position: relative;
    white-space: nowrap;
    font: var(--weight-semibold) var(--text-md) / 1 var(--font-sans);
    color: var(--ink-3);

    .selected & {
      color: var(--ink);
    }

    .tight & {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      // the clip would cut the descenders off a line-height of 1
      padding-block: 0.15em;
    }
  }

  .count {
    position: relative;
    flex-shrink: 0;
    min-width: 18px;
    box-sizing: border-box;
    padding: 2px 5px;
    text-align: center;
    border-radius: var(--radius-pill);
    background: var(--overlay-2);
    font: var(--weight-semibold) var(--text-2xs) / 1.35 var(--font-mono);
    color: var(--ink-3);

    .selected & {
      background: var(--accent);
      color: var(--on-accent);
    }
  }

  .dot {
    position: relative;
    flex-shrink: 0;
    width: 5px;
    height: 5px;
    border-radius: var(--radius-pill);
    background: var(--accent);
  }
</style>

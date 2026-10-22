<!-- Message actions surface. Two layouts, same content:
       popover (pointer / wide): one panel at the cursor or under an anchor — reaction row + actions; 🙂 morphs it into EmojiPicker in place.
       focus (touch / narrow): scrim + blur, the message cloned and lifted where it sits, reactions above, actions below; 🙂 swaps the actions for the picker.
     reactions=false drops the reaction row (opened from the hover bar's ⋯, which already offers them).
     pickerOnly opens straight to the picker (hover bar 🙂) with no back step. The host decides the layout and owns the items. -->
<script lang="ts">
  import { useT } from '../i18n';
  import { onMount, untrack } from 'svelte';
  import EmojiPicker from './EmojiPicker.svelte';

  const QUICK = ['👍', '❤️', '😂', '🎉', '🙏', '🔥', '😮', '😢'];
  const MARGIN = 8;

  type Rect = { left: number; top: number; width: number; height: number };

  interface Item {
    /** Resource key (or literal text). */
    label: string;
    variant?: 'regular' | 'danger' | 'separator';
    /** CSS mask image, e.g. var(--icon-reply). */
    mask?: string;
    onSelect?: () => void;
  }

  interface Props {
    open?: boolean;
    items?: Item[];
    point?: { x: number; y: number } | null;
    anchor?: { left: number; right: number; top: number; bottom: number } | null;
    align?: 'start' | 'end';
    /** Touch layout: scrim, lifted message clone, reactions above, actions below. */
    focus?: boolean;
    focusRect?: Rect | null;
    /** The message element to clone in the focus layout. */
    focusEl?: HTMLElement | null;
    /** Move focus to the first item on open (keyboard-opened). */
    focusFirst?: boolean;
    reactions?: boolean;
    pickerOnly?: boolean;
    recent?: string[];
    selected?: string[];
    onReact?: (emoji: string) => void;
    onClose?: () => void;
  }

  let {
    open = false,
    items = [],
    point = null,
    anchor = null,
    align = 'end',
    focus = false,
    focusRect = null,
    focusEl = null,
    focusFirst = false,
    reactions = true,
    pickerOnly = false,
    recent = [],
    selected = [],
    onReact,
    onClose,
  }: Props = $props();
  const t = useT();

  let box = $state<HTMLDivElement>();
  let cloneSlot = $state<HTMLDivElement>();
  let modeOverride = $state<{ sig: string; mode: 'menu' | 'picker' } | null>(null);
  let pos = $state<{ sig: string; base: string; left: number; top: number; cloneLeft?: number; cloneTop?: number; cloneW?: number } | null>(null);
  // bookkeeping only
  let openSig: string | null = null;
  let placedSig: string | null = null;
  let placedSize = '';
  let returnTo: HTMLElement | null = null;

  const sig = $derived(open ? JSON.stringify([point, anchor, focus ? focusRect : null, pickerOnly]) : null);
  const mode = $derived(modeOverride && modeOverride.sig === sig ? modeOverride.mode : pickerOnly ? 'picker' : 'menu');
  const picker = $derived(open && mode === 'picker');
  const placed = $derived(pos && pos.sig === `${sig}|${mode}` ? pos : null);

  // tall messages (polls, prizes, media) are capped so strip + message + actions always fit; the bottom edge (timestamp) stays, the top fades
  const capH = $derived.by(() => {
    if (!focus || !focusRect) return 0;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    const seps = items.filter((i) => i.variant === 'separator').length;
    const below = picker ? Math.min(390, vh * 0.6) : (items.length - seps) * 44 + seps * 9 + 12;
    const above = picker ? 0 : 42 + 10;
    return Math.min(focusRect.height, Math.max(80, vh - 16 - above - 10 - below));
  });

  const quick = $derived.by(() => {
    const out: string[] = [];
    for (const c of [...recent, ...QUICK]) if (!out.includes(c) && out.length < (focus ? 7 : 5)) out.push(c);
    return out;
  });

  function close() {
    const back = returnTo;
    returnTo = null;
    openSig = null;
    onClose?.();
    if (back?.isConnected) requestAnimationFrame(() => back.focus({ preventScroll: true }));
  }

  function react(c: string) {
    onReact?.(c);
    close();
  }

  function setMode(next: 'menu' | 'picker') {
    if (sig) modeOverride = { sig, mode: next };
  }

  function place() {
    if (!open || !box) return;
    const key = `${openSig}|${mode}`;
    const r = box.getBoundingClientRect(), w = r.width, h = r.height, vw = window.innerWidth, vh = window.innerHeight;
    const size = `${Math.round(w)}x${Math.round(h)}`;
    if (placedSig === key && placedSize === size) return;
    placedSize = size;
    let left: number, top: number;
    if (focus) {
      const fr = focusRect ?? { left: 20, top: vh / 3, width: 300, height: 60 };
      // the slot's offset inside the box is measured, so the clone always lands exactly in it
      const slot = box.querySelector('[data-ma-slot]');
      const slotY = slot ? slot.getBoundingClientRect().top - r.top : 0;
      left = Math.min(Math.max(MARGIN, fr.left), vw - w - MARGIN);
      top = fr.top - slotY;
      let shift = 0;
      if (top + h > vh - MARGIN) shift = vh - MARGIN - (top + h);
      if (top + shift < MARGIN) shift = MARGIN - top;
      top += shift;
      pos = { sig: key, base: openSig!, left, top, cloneLeft: left, cloneTop: top + slotY, cloneW: fr.width };
    } else {
      const prev = pos && pos.base === openSig ? pos : null;
      if (prev) {
        left = prev.left;
        top = prev.top;
      } else if (point) {
        left = point.x;
        top = point.y;
        if (left + w > vw - MARGIN) left = point.x - w;
        if (top + h > vh - MARGIN) top = point.y - h;
      } else if (anchor) {
        left = align === 'end' ? anchor.right - w : anchor.left;
        top = anchor.bottom + 6;
        if (top + h > vh - MARGIN) top = anchor.top - h - 6;
      } else {
        left = (vw - w) / 2;
        top = (vh - h) / 2;
      }
      // morphing to the picker keeps the top-left corner unless it no longer fits
      if (left + w > vw - MARGIN) left = vw - w - MARGIN;
      if (top + h > vh - MARGIN) top = vh - h - MARGIN;
      pos = { sig: key, base: openSig!, left: Math.max(MARGIN, left), top: Math.max(MARGIN, top) };
    }
    placedSig = key;
  }

  function sync() {
    if (!sig) {
      openSig = null;
      return;
    }
    if (sig !== openSig) {
      openSig = sig;
      placedSig = null;
      returnTo = document.activeElement as HTMLElement | null;
      // focus layout: clone the message so it can sit above the scrim
      if (focus && cloneSlot) {
        cloneSlot.innerHTML = '';
        if (focusEl) {
          const k = focusEl.cloneNode(true) as HTMLElement;
          k.querySelectorAll('[data-msg-acts],[data-msg-mark]').forEach((n) => n.remove());
          k.style.transform = '';
          cloneSlot.appendChild(k);
        }
      }
      requestAnimationFrame(() => {
        if (focusFirst) box?.querySelector<HTMLElement>('[data-ma-item]')?.focus({ preventScroll: true });
      });
    }
    place();
  }

  $effect(() => {
    void sig;
    void mode;
    void box;
    void cloneSlot;
    untrack(sync);
  });

  $effect(() => {
    if (!box) return;
    const ro = new ResizeObserver(() => untrack(() => place()));
    ro.observe(box);
    return () => ro.disconnect();
  });

  onMount(() => {
    const down = (e: PointerEvent) => {
      if (!open || focus) return;
      if (box && !box.contains(e.target as Node)) close();
    };
    const key = (e: KeyboardEvent) => {
      if (open && e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    const gone = (e?: Event) => {
      if (!open || focus) return;
      if (e?.target instanceof Node && box?.contains(e.target)) return;
      close();
    };
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key);
    window.addEventListener('resize', gone);
    document.addEventListener('scroll', gone, true);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', gone);
      document.removeEventListener('scroll', gone, true);
    };
  });

  function onKey(e: KeyboardEvent) {
    if (picker || !box) return;
    const els = [...box.querySelectorAll<HTMLElement>('[data-ma-item]')];
    const i = els.indexOf(document.activeElement as HTMLElement);
    const step = ({ ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 } as Record<string, number>)[e.key];
    if (step) {
      e.preventDefault();
      els[i < 0 ? 0 : (i + step + els.length) % els.length]?.focus();
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      els[e.key === 'Home' ? 0 : els.length - 1]?.focus();
    } else if ((e.key === 'Enter' || e.key === ' ') && i >= 0) {
      e.preventDefault();
      els[i].click();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      close();
    }
  }
</script>

{#snippet emoji(c: string, big: boolean)}
  {@const on = selected.includes(c)}
  <span class="emoji" class:big class:on onclick={() => react(c)} role="menuitemcheckbox" aria-checked={on} aria-label={t(on ? 'ui.messageActions.removeReaction' : 'ui.messageActions.react', { emoji: c })} tabindex="-1" data-ma-item="">{c}</span>
{/snippet}

{#snippet more(big: boolean)}
  <span class="more" class:big onclick={() => setMode('picker')} role="menuitem" aria-label={t('ui.messageActions.moreReactions')} tabindex="-1" data-ma-item="" data-tip={t('ui.messageActions.moreReactions')}><span class="more-icon"></span></span>
{/snippet}

{#if open}
  {#if focus}
    <div class="scrim" onclick={close} oncontextmenu={(e) => e.preventDefault()} role="presentation"></div>
    <div
      class="clone"
      bind:this={cloneSlot}
      style:left="{placed?.cloneLeft ?? 0}px"
      style:top="{placed?.cloneTop ?? 0}px"
      style:width={placed ? `${placed.cloneW}px` : 'auto'}
      style:height="{focusRect ? capH : 0}px"
      style:mask-image={focusRect && capH < focusRect.height ? 'linear-gradient(to bottom, transparent 0, #000 48px)' : 'none'}
      style:visibility={placed ? 'visible' : 'hidden'}
      aria-hidden="true"
    ></div>
  {/if}
  <div
    class="box"
    class:focus
    bind:this={box}
    style:left="{placed?.left ?? 0}px"
    style:top="{placed?.top ?? 0}px"
    style:visibility={placed ? 'visible' : 'hidden'}
    role="menu"
    aria-label={t('ui.messageActions.label')}
    onkeydown={onKey}
    oncontextmenu={(e) => e.preventDefault()}
  >
    {#if focus && !picker}
      <div class="strip">
        {#each quick as c}{@render emoji(c, true)}{/each}
        {@render more(true)}
      </div>
    {/if}
    {#if focus}<div class="slot" style:height="{focusRect ? capH : 0}px" data-ma-slot=""></div>{/if}
    {#if !picker}
      <div class="rows">
        {#if !focus && reactions}
          <div class="inline-strip">
            {#each quick as c}{@render emoji(c, false)}{/each}
            {@render more(false)}
          </div>
        {/if}
        {#each items as item}
          {#if item.variant === 'separator'}
            <div class="separator" role="separator"></div>
          {:else}
            <div
              class="row"
              class:danger={item.variant === 'danger'}
              onclick={() => {
                close();
                item.onSelect?.();
              }}
              role="menuitem"
              tabindex="-1"
              data-ma-item=""
            >
              <span class="row-icon" style:mask="{item.mask ?? ''} center/contain no-repeat"></span><span class="row-label">{t(item.label)}</span>
            </div>
          {/if}
        {/each}
      </div>
    {:else}
      <div class="picker">
        <div class="picker-fill"><EmojiPicker {recent} {selected} onPick={react} onBack={pickerOnly ? undefined : () => setMode('menu')} onClose={close} /></div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 94;
    background: rgba(3, 3, 6, 0.5);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    animation: ocMaFade 0.16s ease-out;
  }

  .clone {
    position: fixed;
    z-index: 95;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    pointer-events: none;
    filter: drop-shadow(0 18px 36px rgba(0, 0, 0, 0.5));
    transition: top 0.18s ease-out;
  }

  .box {
    position: fixed;
    z-index: 96;
    display: flex;
    flex-direction: column;
    gap: 0px;
    width: auto;
    animation: ocMaIn 0.14s ease-out;
  }

  .box.focus {
    gap: 10px;
    width: min(360px, calc(100vw - 16px));
  }

  .strip {
    flex: none;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 0 6px;
    border-radius: 26px;
    background: var(--surface-3, #24242e);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      0 12px 30px rgba(0, 0, 0, 0.5);
    align-self: flex-start;
  }

  .slot {
    flex: none;
  }

  .emoji,
  .more {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .emoji.big,
  .more.big {
    width: 42px;
    height: 42px;
  }

  .emoji {
    font-size: 19px;
    line-height: 1;
    user-select: none;
    background: transparent;
    transition: transform 0.12s;
  }

  .emoji.big {
    font-size: 22px;
  }

  .emoji.on {
    background: var(--accent-soft);
    box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 50%, transparent);
  }

  .emoji:hover {
    background: var(--overlay-2);
    transform: scale(1.12);
  }

  .more {
    color: var(--ink-2);
  }

  .more:hover {
    background: var(--overlay-2);
    color: var(--ink);
  }

  .emoji:focus-visible,
  .more:focus-visible {
    box-shadow: var(--focus-ring);
    outline: none;
  }

  .more-icon {
    width: 18px;
    height: 18px;
    background: currentColor;
    mask: var(--icon-emoji) center/contain no-repeat;
  }

  .rows {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    border-radius: 16px;
    background: var(--surface-3, #24242e);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      0 16px 40px rgba(0, 0, 0, 0.5);
    align-self: flex-start;
    width: 252px;
    box-sizing: border-box;
  }

  .focus .rows {
    width: min(240px, 100%);
  }

  .inline-strip {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 0 6px;
    margin-bottom: 4px;
    box-shadow: inset 0 -1px 0 var(--line-1);
  }

  .separator {
    height: 1px;
    margin: 4px 6px;
    background: var(--line-1);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    height: 36px;
    padding: 0 10px;
    border-radius: 10px;
    font: 500 13.5px/1 var(--font-sans);
    color: var(--ink);
    cursor: pointer;
    user-select: none;
  }

  .focus .row {
    height: 42px;
  }

  .row.danger {
    color: var(--status-danger);
  }

  .row:hover,
  .row:focus-visible {
    background: var(--overlay-2);
    outline: none;
  }

  .row-icon {
    flex: none;
    width: 16px;
    height: 16px;
    background: currentColor;
  }

  .row-label {
    flex: 1;
    white-space: nowrap;
  }

  .picker {
    flex: none;
    width: 340px;
    height: 380px;
    border-radius: 16px;
    background: var(--surface-3, #24242e);
    box-shadow:
      inset 0 0 0 1px var(--line-2),
      0 16px 40px rgba(0, 0, 0, 0.5);
    display: grid;
    grid-template-rows: minmax(0, 1fr);
    grid-template-columns: minmax(0, 1fr);
    overflow: hidden;
  }

  .focus .picker {
    width: min(340px, calc(100vw - 16px));
    height: min(390px, 60vh);
  }

  .picker-fill {
    min-height: 0;
    height: 100%;
  }
</style>

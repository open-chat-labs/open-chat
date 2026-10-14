<!-- The one row menu. Same items, three ways in:
       desktop right-click → `point` (opens at the cursor)
       kebab / keyboard (Shift+F10, Menu key) → `anchor` rect (opens under it, end-aligned)
       touch long-press → `anchor` {left:x,right:x,top,bottom} of the row with align "start" (anchored popover, no bottom sheet)
     Flips to stay on screen; closes on outside press, Esc, scroll or resize. Rows own open/close state.
     Focus moves to the first item on open and back to the opener on close (not when closed by pressing elsewhere).
     Esc is consumed, so a dialog around the menu stays open. -->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { MenuItem } from '../types';
  import Menu from './Menu.svelte';

  interface Props {
    open?: boolean;
    items: MenuItem[];
    point?: { x: number; y: number } | null;
    anchor?: { left: number; right: number; top: number; bottom: number } | null;
    align?: 'end' | 'start';
    minWidth?: string;
    onClose?: () => void;
  }

  let { open = false, items, point = null, anchor = null, align = 'end', minWidth = '212px', onClose }: Props = $props();

  const MARGIN = 8;

  let box = $state<HTMLDivElement>();
  let pos = $state<{ left: number; top: number; sig: string } | null>(null);
  // bookkeeping only; never rendered
  let placedSig: string | null = null;
  let placedSize = '';
  let focusedFor: string | null = null;
  let returnTo: HTMLElement | null = null;

  const sig = $derived(open ? JSON.stringify([point, anchor, items.length]) : null);
  const raw = $derived(point ? { x: point.x, y: point.y } : { x: anchor?.left ?? 0, y: anchor?.bottom ?? 0 });
  const placed = $derived(!!pos && pos.sig === sig);

  // refocus = false when the user pressed elsewhere: focus stays where they put it
  function close(refocus = true) {
    placedSig = null;
    focusedFor = null;
    const back = returnTo;
    returnTo = null;
    onClose?.();
    if (refocus && back?.isConnected && typeof back.focus === 'function') requestAnimationFrame(() => back.focus({ preventScroll: true }));
  }

  function place() {
    if (!sig) {
      placedSig = null;
      return;
    }
    if (!box) return;
    const r = box.getBoundingClientRect();
    const size = `${Math.round(r.width)}x${Math.round(r.height)}`;
    if (sig === placedSig && size === placedSize) return;
    placedSize = size;
    // the box currently sits at `from`; fixed elements can be offset by a contained ancestor, so measure it instead of assuming the viewport
    const from = pos && pos.sig === sig ? { x: pos.left, y: pos.top } : raw;
    const offX = r.left - from.x, offY = r.top - from.y, w = r.width, h = r.height;
    const vw = window.innerWidth, vh = window.innerHeight;
    let x: number, y: number;
    if (point) {
      x = point.x;
      y = point.y;
      if (x + w > vw - MARGIN) x = point.x - w;
      if (y + h > vh - MARGIN) y = point.y - h;
    } else {
      const a = anchor ?? { left: 0, right: 0, top: 0, bottom: 0 };
      x = align === 'end' ? a.right - w : a.left;
      if (x + w > vw - MARGIN) x = vw - MARGIN - w;
      y = a.bottom + 6;
      if (y + h > vh - MARGIN && a.top - h - 6 >= MARGIN) y = a.top - h - 6;
    }
    x = Math.max(MARGIN, Math.min(x, vw - MARGIN - w));
    y = Math.max(MARGIN, Math.min(y, vh - MARGIN - h));
    placedSig = sig;
    if (focusedFor !== sig) {
      focusedFor = sig;
      returnTo ??= document.activeElement as HTMLElement | null;
      const el = box;
      requestAnimationFrame(() => el.querySelector<HTMLElement>('[role="menuitem"]')?.focus({ preventScroll: true }));
    }
    const next = { left: Math.round(x - offX), top: Math.round(y - offY), sig };
    if (!pos || pos.sig !== sig || pos.left !== next.left || pos.top !== next.top) pos = next;
  }

  $effect(() => {
    sig;
    box;
    untrack(place);
  });

  // re-place whenever the menu's size changes
  $effect(() => {
    if (!box) return;
    const ro = new ResizeObserver(() => untrack(() => open && place()));
    ro.observe(box);
    return () => ro.disconnect();
  });

  onMount(() => {
    const down = (e: PointerEvent) => {
      if (open && box && !box.contains(e.target as Node)) close(false);
    };
    const key = (e: KeyboardEvent) => {
      if (!open || e.key !== 'Escape') return;
      // handled here, so an enclosing dialog (use:modal, DialogShell) doesn't close on the same press
      e.preventDefault();
      e.stopPropagation();
      close();
    };
    const gone = () => {
      if (open) close();
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

  const wrapped = $derived(
    items.map((it) =>
      it.variant === 'separator'
        ? it
        : {
            ...it,
            onSelect: () => {
              close();
              it.onSelect?.();
            },
          },
    ),
  );
</script>

{#if open}
  <div
    class="context"
    bind:this={box}
    style:left="{placed ? pos!.left : raw.x}px"
    style:top="{placed ? pos!.top : raw.y}px"
    style:visibility={placed ? 'visible' : 'hidden'}
    role="menu"
    oncontextmenu={(e) => e.preventDefault()}
  >
    <Menu items={wrapped} {minWidth} />
  </div>
{/if}

<style>
  .context {
    position: fixed;
    z-index: 95;
    display: grid;
    grid-template-columns: max-content;
  }
</style>

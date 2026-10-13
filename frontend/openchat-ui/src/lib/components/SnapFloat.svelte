<!-- Draggable floating box that snaps to 8 spots (corners + edge midpoints) inside its positioned parent.
     Drag from anywhere — a drag starts after 5px, so taps still reach buttons inside; the click after a drag is swallowed.
     Snap glides from the drop point (FLIP, 720ms ease-out). safeTop / safeBottom (px) keep it clear of a header / composer.
     position: tl | tc | tr | ml | mr | bl | bc | br (centre drops go to the nearer side) → onSnap(position). -->
<script lang="ts">
  import { tick, type Snippet } from 'svelte';

  type Spot = 'tl' | 'tc' | 'tr' | 'ml' | 'mr' | 'bl' | 'bc' | 'br';

  interface Props {
    position?: Spot;
    width?: number | string;
    /** Gap to the parent's edges, px. */
    inset?: number;
    safeTop?: number;
    safeBottom?: number;
    zIndex?: number;
    label?: string;
    role?: string;
    onSnap?: (position: Spot) => void;
    children?: Snippet;
  }

  let { position = 'br', width, inset = 20, safeTop, safeBottom, zIndex = 30, label, role = 'region', onSnap, children }: Props = $props();

  // follows `position` until the user drops it somewhere else
  let spot = $derived(position);
  let box: HTMLDivElement;

  const row = $derived(spot[0]);
  const col = $derived(spot[1]);

  function down(e: PointerEvent) {
    const el = box;
    if (e.button > 0) return;
    const x0 = e.clientX, y0 = e.clientY;
    let moved = false;
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      if (!moved) {
        moved = true;
        el.style.transition = 'none';
        el.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
      }
      ev.preventDefault();
      el.style.transform = `translate(${dx}px,${dy}px)`;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (!moved) return;
      el.style.cursor = '';
      document.body.style.userSelect = '';
      const eat = (ce: MouseEvent) => {
        ce.stopPropagation();
        ce.preventDefault();
      };
      window.addEventListener('click', eat, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', eat, { capture: true }), 0);
      const r = el.getBoundingClientRect(), pr = (el.offsetParent as HTMLElement).getBoundingClientRect();
      const cx = r.left + r.width / 2 - pr.left, cy = r.top + r.height / 2 - pr.top;
      const v = cy < pr.height / 3 ? 't' : cy > (pr.height * 2) / 3 ? 'b' : 'm';
      const h = cx < pr.width / 3 ? 'l' : cx > (pr.width * 2) / 3 ? 'r' : 'c';
      const next = (v === 'm' && h === 'c' ? 'm' + (cx < pr.width / 2 ? 'l' : 'r') : v + h) as Spot;
      el.style.transform = '';
      spot = next;
      tick().then(() => {
        const n = el.getBoundingClientRect();
        el.style.transform = `translate(${r.left - n.left}px,${r.top - n.top}px)`;
        void el.offsetWidth;
        el.style.transition = 'transform 720ms cubic-bezier(.16,1,.3,1)';
        el.style.transform = '';
      });
      onSnap?.(next);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }
</script>

<div
  class="float"
  bind:this={box}
  style:z-index={zIndex}
  style:top={row === 't' ? `${safeTop ?? inset}px` : row === 'm' ? '50%' : 'auto'}
  style:bottom={row === 'b' ? `${safeBottom ?? inset}px` : 'auto'}
  style:left={col === 'l' ? `${inset}px` : col === 'c' ? '50%' : 'auto'}
  style:right={col === 'r' ? `${inset}px` : 'auto'}
  style:translate="{col === 'c' ? '-50%' : '0'} {row === 'm' ? '-50%' : '0'}"
  style:width={width == null ? 'auto' : typeof width === 'number' ? `${width}px` : width}
  onpointerdown={down}
  ondragstart={(e) => e.preventDefault()}
  {role}
  aria-label={label}
>
  {@render children?.()}
</div>

<style>
  .float {
    position: absolute;
    touch-action: none;
    cursor: grab;
    user-select: none;
  }
</style>

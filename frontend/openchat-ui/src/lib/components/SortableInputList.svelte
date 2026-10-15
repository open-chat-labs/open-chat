<!-- List editor with drag handles. No "Add" button: a fresh empty row appears once every row is filled (up to `max`).
     Rows past `min` get ×; drag the handle (or Alt+↑/↓ on it) to reorder; duplicates are flagged. onChange(values) gets the non-empty values. -->
<script lang="ts">
  import { useT } from '../i18n';
  import { untrack } from 'svelte';

  interface Props {
    values?: string[];
    min?: number;
    max?: number;
    maxLength?: number;
    /** Noun for one row, resource key (or literal text): placeholders and labels ("Answer 1", "Remove answer 2"). */
    itemLabel?: string;
    /** Resource key (or literal text). */
    morePlaceholder?: string;
    /** Resource key (or literal text). */
    label?: string;
    onChange?: (values: string[]) => void;
  }

  let { values = [], min = 2, max = 10, maxLength = 50, itemLabel = 'ui.sortableInputList.answer', morePlaceholder, label, onChange }: Props = $props();
  const t = useT();

  const clean = (a: string[]) => a.map((x) => x.trim()).filter(Boolean);

  // rows being edited (with their empty slots); dropped when the parent sends different values
  let local = $state<string[] | null>(null);
  let seen = untrack(() => values);
  $effect.pre(() => {
    const next = values;
    untrack(() => {
      if (next === seen) return;
      seen = next;
      if (local && clean(local).join('\u0001') !== clean(next).join('\u0001')) local = null;
    });
  });

  function pad(r: string[]) {
    r = r.slice();
    while (r.length < min) r.push('');
    if (r.length < max && r.every((x) => x.trim())) r.push('');
    return r;
  }

  const rows = $derived(pad(local ?? values));
  const lower = $derived(rows.map((x) => x.trim().toLowerCase()));
  const filled = $derived(rows.filter((x) => x.trim()).length);
  const item = $derived(t(itemLabel));
  const noun = $derived(item.toLowerCase());

  let drag = $state<{ i: number; dy: number; to: number; step: number } | null>(null);
  let list: HTMLDivElement;

  function commit(r: string[]) {
    r = pad(r);
    local = r;
    onChange?.(clean(r));
  }

  function move(from: number, to: number) {
    const r = rows.slice();
    if (to < 0 || to >= r.length || from === to) return;
    const [x] = r.splice(from, 1);
    r.splice(to, 0, x);
    commit(r);
  }

  function grab(i: number, e: PointerEvent) {
    e.preventDefault();
    const els = [...list.querySelectorAll('[data-row]')];
    const tops = els.map((el) => el.getBoundingClientRect().top);
    const step = tops.length > 1 ? tops[1] - tops[0] : 52;
    const y0 = e.clientY;
    const onMove = (ev: PointerEvent) => {
      const dy = ev.clientY - y0;
      drag = { i, dy, to: Math.max(0, Math.min(els.length - 1, i + Math.round(dy / step))), step };
    };
    const up = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', up);
      const d = drag;
      drag = null;
      if (d) move(d.i, d.to);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', up);
  }

  function shift(i: number) {
    const d = drag;
    if (!d) return 'none';
    if (d.i === i) return `translateY(${d.dy}px)`;
    if (i > d.i && i <= d.to) return `translateY(-${d.step}px)`;
    if (i < d.i && i >= d.to) return `translateY(${d.step}px)`;
    return 'none';
  }

  // drop emptied rows (beyond the required ones) when focus leaves
  function tidy() {
    const kept = rows.filter((x, i) => x.trim() || i < min);
    if (kept.length !== rows.length) commit(kept);
  }
</script>

<div class="list" bind:this={list} role="list" aria-label={label ? t(label) : t('ui.sortableInputList.listLabel', { item })}>
  {#each rows as value, i}
    {@const trailing = i === rows.length - 1 && !value.trim() && i >= min}
    {@const dup = !!lower[i] && lower.indexOf(lower[i]) !== i}
    {@const dragging = drag?.i === i}
    <div class="row" class:dup class:dragging style:transform={shift(i)} role="listitem" data-row={i}>
      <span
        class="handle"
        class:trailing
        onpointerdown={(e) => !trailing && grab(i, e)}
        onkeydown={(e) => {
          if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
            e.preventDefault();
            move(i, i + (e.key === 'ArrowUp' ? -1 : 1));
          }
        }}
        role="button"
        tabindex={trailing ? -1 : 0}
        aria-label={t('ui.sortableInputList.move', { item: noun, n: i + 1 })}
        title={t('ui.sortableInputList.dragToReorder')}><span class="grip"></span></span
      >
      <input
        {value}
        oninput={(e) => {
          const n = rows.slice();
          n[i] = e.currentTarget.value;
          commit(n);
        }}
        onblur={tidy}
        maxlength={maxLength}
        placeholder={i < min ? t('ui.sortableInputList.itemN', { item, n: i + 1 }) : morePlaceholder ? t(morePlaceholder) : t('ui.sortableInputList.another', { item: noun })}
        aria-label={t('ui.sortableInputList.itemN', { item, n: i + 1 })}
        data-sortable-input
      />
      {#if dup}<span class="dup-label">{t('ui.sortableInputList.duplicate')}</span>{/if}
      {#if maxLength - value.length <= 15}<span class="left">{maxLength - value.length}</span>{/if}
      {#if !trailing && filled > min && rows.length > min}
        <span class="remove" onclick={() => commit(rows.filter((_, k) => k !== i))} role="button" tabindex="0" aria-label={t('ui.sortableInputList.remove', { item: noun, n: i + 1 })}><span class="remove-icon"></span></span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 46px;
    padding: 0 6px 0 4px;
    border-radius: 12px;
    background: var(--field, #14141a);
    box-shadow: inset 0 0 0 1px var(--line-1, rgba(255, 255, 255, 0.07));
    transition: transform 180ms var(--ease-out, ease-out);
    position: relative;
    z-index: auto;
  }

  .row.dragging {
    box-shadow:
      0 8px 24px rgba(0, 0, 0, 0.4),
      inset 0 0 0 1px var(--line-2, rgba(255, 255, 255, 0.12));
    transition: none;
    z-index: 2;
  }

  .row.dup {
    box-shadow: inset 0 0 0 1px var(--status-warning, #ffb03d);
  }

  .handle {
    flex: none;
    width: 22px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    touch-action: none;
    border-radius: 6px;
  }

  .handle.trailing {
    opacity: 0.3;
  }

  .handle:focus-visible {
    box-shadow: var(--focus-ring);
    outline: none;
  }

  .grip {
    width: 12px;
    height: 14px;
    background: radial-gradient(circle, var(--ink-4, #8a8a99) 1.3px, transparent 1.6px) 0 0/6px 5px;
  }

  input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: 0;
    outline: none;
    background: transparent;
    padding: 0;
    font: 500 14px/1 var(--font-sans);
    color: var(--ink, #ececf1);
  }

  .dup-label {
    font: 500 11.5px/1 var(--font-sans);
    color: var(--status-warning, #ffb03d);
  }

  .left {
    font: 500 11.5px/1 var(--font-mono);
    color: var(--ink-4, #8a8a99);
  }

  .remove {
    flex: none;
    display: flex;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .remove:hover {
    background: var(--overlay-2, rgba(255, 255, 255, 0.08));
  }

  .remove-icon {
    width: 12px;
    height: 12px;
    background: var(--ink-3, #9a9aa8);
    mask: var(--icon-close) center/contain no-repeat;
  }
</style>

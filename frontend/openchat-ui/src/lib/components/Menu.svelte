<!-- Generated from lib/Menu.dc.html (source hash fd3b9a33) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './Menu.logic.js';
  import MenuItem from './MenuItem.svelte';

  interface Props {
    items?: {label:string,variant?:'regular'|'danger'|'separator',mask?:string,checkMask?:string,shortcut?:string,minVw?:number,maxVw?:number,onSelect?:()=>void}[];
    heading?: string;
    minWidth?: string;
    onSelect?: (item) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="min-width:{v.minWidth};padding:var(--space-6);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--surface-2,#191921);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-panel,0 8px 24px rgba(0,0,0,.28));display:flex;flex-direction:column;gap:var(--space-4)" role="menu" aria-label={v.heading} onkeydown={v.onKeyNav}>
  {#if v.hasHeading}
    <span style="padding:var(--space-6) var(--space-10) var(--space-4);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#6E6E7C)">{t(v.heading)}</span>
  {/if}
  {#each (v.items ?? []) as item, item_i}
    <MenuItem label={item?.label} variant={item?.variant} mask={item?.mask} icon={item?.icon} checkMask={item?.checkMask} shortcut={item?.shortcut} minVw={item?.minVw} maxVw={item?.maxVw} onSelect={item?.onSelect}></MenuItem>
  {/each}
</div>

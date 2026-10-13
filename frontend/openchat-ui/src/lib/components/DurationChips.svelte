<!-- Generated from lib/DurationChips.dc.html (source hash f945e31c) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './DurationChips.logic.js';

  interface Props {
    value?: string;
    options?: string[];
    title?: string;
    hint?: string;
    branch?: boolean;
    onChange?: (value: string) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="--oc-trunk:var(--space-22);--oc-stub:var(--space-10);--oc-clear:var(--space-8);--oc-rise:var(--space-14);position:relative;width:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:var(--space-18);min-width:0;padding-top:var(--space-8)">
  {#if v.branch}
    <span style="position:absolute;inset-inline-start:var(--oc-trunk);top:calc(var(--oc-rise) * -1);width:var(--oc-stub);height:calc(var(--oc-rise) + var(--space-16));border-inline-start:1px solid var(--line-2,rgba(255,255,255,.14));border-block-end:1px solid var(--line-2,rgba(255,255,255,.14));border-end-start-radius:var(--radius-sm);pointer-events:none"></span>
  {/if}
  <div style="display:flex;flex-direction:column;gap:3px;padding-inline-start:{v.inset};padding-inline-end:var(--space-16)">
    <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">{t(v.title)}</span>
    <span style="font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.hint)}</span>
  </div>
  <div style="display:flex;flex-wrap:wrap;gap:var(--space-8) var(--space-6);padding-inline-start:{v.inset};padding-inline-end:var(--space-16)">
    {#each (v.options ?? []) as d, d_i}
      <span style="padding:var(--space-8) var(--space-12);border-radius:var(--radius-sm);background:{d?.wash};box-shadow:inset 0 0 0 1px {d?.line};font:var(--weight-semibold) var(--text-sm)/1.3 var(--font-sans);color:{d?.ink};cursor:pointer;user-select:none" onclick={d?.onSelect} role="button" tabindex="0">{t(d?.label)}</span>
    {/each}
  </div>
</div>

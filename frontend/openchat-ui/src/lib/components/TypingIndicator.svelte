<!-- Generated from lib/TypingIndicator.dc.html (source hash e4d33efe) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './TypingIndicator.logic.js';

  interface Props {
    names?: string[];
    colors?: string[];
    ringColor?: string;
    label?: string;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:flex;align-items:center;gap:var(--space-10)">
  <div style="flex:none;display:flex">
    {#each (v.people ?? []) as p, p_i}
      <span style="width:24px;height:24px;border-radius:var(--radius-pill);background:{p?.gradient};box-shadow:0 0 0 2px {v.ringColor};margin-inline-start:{p?.offset}"></span>
    {/each}
  </div>
  <div style="display:flex;align-items:center;gap:var(--space-8)">
    <div style="display:flex;align-items:center;gap:3px">
      <span style="width:5px;height:5px;border-radius:var(--radius-pill);background:var(--ink-3,#8A8A99);animation:oc-typing 1.2s infinite var(--ease-standard)"></span>
      <span style="width:5px;height:5px;border-radius:var(--radius-pill);background:var(--ink-3,#8A8A99);animation:oc-typing 1.2s .18s infinite var(--ease-standard)"></span>
      <span style="width:5px;height:5px;border-radius:var(--radius-pill);background:var(--ink-3,#8A8A99);animation:oc-typing 1.2s .36s infinite var(--ease-standard)"></span>
    </div>
    <span style="font:var(--weight-medium) var(--text-sm)/1 var(--font-sans);color:var(--ink-3,#8A8A99)">{t(v.label)}</span>
  </div>
</div>

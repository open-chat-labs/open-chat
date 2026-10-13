<!-- Generated from lib/QuickAmountChips.dc.html (source hash a622f26e) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './QuickAmountChips.logic.js';

  interface Props {
    options?: number[];
    size?: string;
    onSelect?: (fraction: number) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:flex;align-items:center;gap:6px" role="group" aria-label="Quick amounts">{#each (v.chips ?? []) as c, c_i}<span class="dc-p0" style="flex:none;height:{v.h};padding:0 {v.padX};display:flex;align-items:center;border-radius:{v.radius};background:var(--overlay-1,rgba(255,255,255,.06));font:600 {v.fs}/1 var(--font-sans);color:var(--ink-2,#C9C9D4);cursor:pointer;user-select:none;" onclick={c?.pick} role="button" tabindex="0">{t(c?.label)}</span>{/each}</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.1)) !important}
</style>

<!-- Generated from lib/PanelCover.dc.html (source hash 8d024aca) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './PanelCover.logic.js';

  interface Props {
    cover?: string;
    actions?: ('favourite'|'close'|'share'|'edit')[];
    trailActions?: string[];
    handlers?: Record<string,()=>void>;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:relative;height:118px;flex:none;margin:var(--space-8) var(--space-8) 0;border-radius:var(--radius-lg);overflow:hidden;background:{v.cover}">
  <div style="position:absolute;top:var(--space-8);inset-inline-start:var(--space-8);display:flex;gap:var(--space-6)">
    {#each (v.leadActions ?? []) as action, action_i}
      <div class="dc-p0" style="width:30px;height:30px;border-radius:var(--radius-sm);background:var(--card-2,#1B1B21);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12));display:flex;align-items:center;justify-content:center;cursor:pointer;" onclick={action?.onPress} role="button" tabindex="0">
        <span style="width:16px;height:16px;background:var(--ink-3,#9A9AA8);mask:{action?.mask}"></span>
      </div>
    {/each}
  </div>
  <div style="position:absolute;top:var(--space-8);inset-inline-end:var(--space-8);display:flex;gap:var(--space-6)">
    {#each (v.trailActions ?? []) as action, action_i}
      <div class="dc-p1" style="width:30px;height:30px;border-radius:var(--radius-sm);background:var(--card-2,#1B1B21);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12));display:flex;align-items:center;justify-content:center;cursor:pointer;" onclick={action?.onPress} role="button" tabindex="0">
        <span style="width:16px;height:16px;background:var(--ink-3,#9A9AA8);mask:{action?.mask}"></span>
      </div>
    {/each}
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
  .dc-p1:hover{background:var(--btn-hover,rgba(255,255,255,.1)) !important}
</style>

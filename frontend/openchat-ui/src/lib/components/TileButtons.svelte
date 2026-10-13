<!-- Generated from lib/TileButtons.dc.html (source hash 58a09cd3) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './TileButtons.logic.js';

  interface Props {
    tiles?: (string|{icon:string,label:string})[];
    handlers?: Record<string,()=>void>;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:grid;grid-template-columns:{v.columns};gap:var(--space-6);width:100%">
  {#each (v.tiles ?? []) as tile, tile_i}
    <div class="dc-p0" style="min-width:0;display:flex;flex-direction:column;align-items:center;gap:7px;padding:var(--space-16) 0;border-radius:var(--radius-md);background:{tile?.bg};box-shadow:{tile?.ring};cursor:pointer;user-select:none;" onclick={tile?.onPress} role="button" tabindex="0">
      <span style="width:16px;height:16px;background:{tile?.ink};mask:{tile?.mask}"></span>
      <span style="font:var(--weight-semibold) var(--text-xs)/1 var(--font-sans);color:{tile?.labelInk};white-space:nowrap">{t(tile?.label)}</span>
    </div>
  {/each}
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
</style>

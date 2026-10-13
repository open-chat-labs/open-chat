<!-- Generated from lib/CopyButton.dc.html (source hash 454e21c1) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './CopyButton.logic.js';

  interface Props {
    value?: string;
    label?: string;
    size?: string;
    onCopy?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<span class="dc-p0" style="flex:none;width:{v.box};height:{v.box};border-radius:8px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;" onclick={v.copy} role="button" tabindex="0" title={v.tip} aria-label={v.tip}><span style="width:{v.icon};height:{v.icon};background:{v.ink};mask:{v.mask}"></span></span>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.08)) !important}
</style>

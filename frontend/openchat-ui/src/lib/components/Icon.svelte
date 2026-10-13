<!-- Generated from lib/Icon.dc.html (source hash 88fc81a7) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './Icon.logic.js';

  interface Props {
    icon?: string;
    size?: number;
    color?: string;
    flip?: boolean;
    label?: string;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<span style="flex:none;display:inline-block;vertical-align:middle;width:{v.px};height:{v.px};background:{v.color};mask:{v.mask}" role={v.role} aria-label={v.label} aria-hidden={v.hidden} data-oc-flip={v.flip}></span>

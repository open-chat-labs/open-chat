<!-- Generated from lib/RoundIconButton.dc.html (source hash 93c63369) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './RoundIconButton.logic.js';

  interface Props {
    icon?: string;
    label?: string;
    variant?: 'default' | 'on' | 'off' | 'danger' | 'overlay';
    size?: 'sm' | 'md' | 'lg';
    pressed?: boolean;
    tooltip?: boolean;
    onPress?: (e: Event) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<span class="dc-p0" style="flex:none;width:{v.px};height:{v.px};border-radius:50%;background:{v.bg};display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background 160ms,filter 160ms" onclick={v.press} onkeydown={v.key} role="button" tabindex="0" aria-label={v.label} aria-pressed={v.pressed} data-tip={v.tip}><span style="width:{v.ipx};height:{v.ipx};background:{v.ink};mask:{v.mask}"></span></span>

<style>
  .dc-p0:hover{filter:brightness(1.15) !important}
  .dc-p0:focus{outline:2px solid var(--accent,#FF5672) !important;outline-offset:2px !important}
</style>

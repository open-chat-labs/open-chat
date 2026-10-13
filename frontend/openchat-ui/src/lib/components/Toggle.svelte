<!-- Generated from lib/Toggle.dc.html (source hash 4b90cec2) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './Toggle.logic.js';

  interface Props {
    label?: string;
    help?: string;
    on?: boolean;
    disabled?: boolean;
    onChange?: (on: boolean) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:flex;flex:none;align-items:center;gap:var(--space-14);width:{v.rootWidth};height:{v.rootHeight}">
  {#if v.hasLabel}
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--space-4)">
      <span style="font:var(--weight-semibold) var(--text-md)/1.3 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.label)}</span>
      {#if v.hasHelp}
        <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-3,#7C7C8C)">{t(v.help)}</span>
      {/if}
    </div>
  {/if}
  <div style="flex:none;width:42px;height:24px;border-radius:var(--radius-pill);padding:var(--space-4);box-sizing:border-box;display:flex;align-items:center;cursor:{v.cursor};opacity:{v.opacity};transition:background var(--duration-base,200ms) var(--ease-out);background:{v.trackBg}" onclick={v.toggle} role="switch" aria-checked={v.ariaChecked} aria-label={v.ariaName} aria-disabled={v.ariaDisabled} tabindex="0">
    <span style="flex:none;width:18px;height:18px;border-radius:var(--radius-pill);transition:transform var(--duration-base,200ms) var(--ease-out),background var(--duration-base,200ms) var(--ease-out);transform:{v.knobShift};background:{v.knobBg}"></span>
  </div>
</div>

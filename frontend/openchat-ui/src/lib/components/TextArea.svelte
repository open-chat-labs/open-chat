<!-- Generated from lib/TextArea.dc.html (source hash 6aad1311) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './TextArea.logic.js';

  interface Props {
    value?: string;
    placeholder?: string;
    help?: string;
    maxLength?: number;
    minHeight?: number;
    error?: boolean;
    errorText?: string;
    onInput?: (e: Event) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:100%;display:flex;flex-direction:column;gap:var(--space-8);min-width:0">
  <div style="display:flex;gap:var(--space-12);min-width:0;padding:var(--space-14) var(--space-16);box-sizing:border-box;border-radius:var(--radius-lg);background:var(--field,#14141a);box-shadow:inset 0 0 0 1px {v.line}">
    <textarea style="flex:1;min-width:0;min-height:{v.minHeight};resize:none;overflow:hidden;background:none;border:0;outline:none;font:var(--weight-regular) var(--text-md)/1.65 var(--font-sans);color:var(--ink,#ECECF1)" use:ref={v.areaRef} value={v.value} oninput={v.onInput} placeholder={v.placeholder} maxlength={v.maxLength} rows={v.rows}></textarea>
    {#if v.showCount}
      <span style="flex:none;font:var(--weight-medium) var(--text-sm)/1 var(--font-mono);color:{v.leftInk}">{t(v.left)}</span>
    {/if}
  </div>
  {#if v.hasNote}
    <div style="display:flex;align-items:center;gap:var(--space-6);min-width:0;padding-inline-start:var(--space-16)">
      {#if v.error}
        <span style="flex:none;width:13px;height:13px;background:var(--status-danger,#F5493D);mask:{v.alertMask}"></span>
      {/if}
      <span style="flex:1;min-width:0;font:{v.noteWeight} var(--text-sm)/1.4 var(--font-sans);color:{v.noteInk};text-wrap:pretty">{t(v.note)}</span>
    </div>
  {/if}
</div>

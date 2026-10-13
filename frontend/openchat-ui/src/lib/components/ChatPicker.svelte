<!-- Generated from lib/ChatPicker.dc.html (source hash 3d01a726) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './ChatPicker.logic.js';
  import Button from './Button.svelte';
  import DialogShell from './DialogShell.svelte';
  import Field from './Field.svelte';
  import IconButton from './IconButton.svelte';
  import TextArea from './TextArea.svelte';

  interface Props {
    title?: string;
    sendLabel?: string;
    previewLabel?: string;
    item?: { title: string, sub?: string, mark?: string, icon?: string, grad?: string, round?: boolean };
    chats?: { name: string, kind?: string, grad: string, radius?: string }[];
    onSend?: (v: { chat: string, message: string }) => void;
    onClose?: () => void;
    z?: number;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<DialogShell title={v.dialogTitle} width={460} height="min(600px,100%)" flush={true} z={v.z} onClose={v.onClose}>
  <div style="min-height:0;display:flex;flex-direction:column">
    {#if v.isPick}
      <div style="flex:none;display:flex;flex-direction:column;gap:var(--space-12);padding:var(--space-16) var(--space-16) var(--space-8)">
        {#if v.hasItem}
          <div style="display:flex;align-items:center;gap:var(--space-12);padding:var(--space-12) var(--space-14);border-radius:var(--radius-md,12px);background:var(--overlay-1,rgba(255,255,255,.04))">
            <span style="flex:none;width:32px;height:32px;border-radius:{v.itemRadius};display:flex;align-items:center;justify-content:center;background:{v.itemBg};font:700 14px/1 var(--font-sans);color:{v.itemInk}"><span style="display:{v.itemIconShow};width:16px;height:16px;background:currentColor;mask:{v.itemMask}"></span>{t(v.itemMark)}</span>
            <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px"><span style="font:var(--weight-semibold) 13.5px/1.2 var(--font-sans);color:var(--ink,#ECECF1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.itemTitle)}</span><span style="font:var(--weight-regular) 12px/1.2 var(--font-mono);color:var(--ink-4,#8A8A99);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.itemSub)}</span></span>
          </div>
        {/if}
        <Field placeholder="Search chats" value={v.q} onInput={v.onQuery} onClear={v.clearQuery} showShortcut={false}></Field>
      </div>
      <div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:2px;padding:var(--space-4) var(--space-10) var(--space-16)" role="listbox" aria-label="Chats">
        <span style="padding:10px 8px 8px;font:var(--weight-semibold) 11.5px/1 var(--font-mono);letter-spacing:.08em;color:var(--ink-4,#8A8A99)">{t(v.listLabel)}</span>
        {#each (v.chats ?? []) as c, c_i}
          <div class="dc-p0" style="display:flex;align-items:center;gap:var(--space-12);min-height:56px;padding:0 var(--space-10);border-radius:var(--radius-md,12px);cursor:pointer;" onclick={c?.pick} role="option" aria-selected="false" tabindex="0">
            <span style="flex:none;width:36px;height:36px;border-radius:{c?.radius};background:{c?.grad}"></span>
            <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px"><span style="font:var(--weight-semibold) var(--text-md)/1.1 var(--font-sans);color:var(--ink,#ECECF1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(c?.name)}</span><span style="font:var(--weight-regular) 12px/1 var(--font-sans);color:var(--ink-4,#8A8A99)">{t(c?.kind)}</span></span>
            <span style="flex:none;width:16px;height:16px;background:var(--ink-4,#8A8A99);mask:var(--icon-chevron-right) center/contain no-repeat" data-oc-flip=""></span>
          </div>
        {/each}
        {#if v.empty}<span style="padding:24px 12px;text-align:center;font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-4,#8A8A99)">No chats match “{t(v.q)}”.</span>{/if}
      </div>
    {/if}
    {#if v.isConfirm}
      <div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:var(--space-16);padding:var(--space-16)">
        <div style="display:flex;align-items:center;gap:var(--space-12)">
          <IconButton variant="ghost" icon="back" label="Choose another chat" onClick={v.back}></IconButton>
          <span style="flex:none;width:36px;height:36px;border-radius:{v.to?.radius};background:{v.to?.grad}"></span>
          <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px"><span style="font:var(--weight-regular) 12px/1 var(--font-sans);color:var(--ink-4,#8A8A99)">Sending to</span><span style="font:var(--weight-semibold) var(--text-md)/1.1 var(--font-sans);color:var(--ink,#ECECF1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.to?.name)}</span></span>
        </div>
        <div style="display:flex;flex-direction:column;gap:var(--space-8);padding:var(--space-12) var(--space-14);border-radius:var(--radius-md,12px);background:var(--overlay-1,rgba(255,255,255,.04))">
          <span style="font:var(--weight-semibold) 11px/1 var(--font-mono);letter-spacing:.08em;color:var(--ink-4,#8A8A99)">{t(v.previewLabel)}</span>
          <div style="display:flex;align-items:center;gap:var(--space-12)">
            <span style="flex:none;width:32px;height:32px;border-radius:{v.itemRadius};display:flex;align-items:center;justify-content:center;background:{v.itemBg};font:700 14px/1 var(--font-sans);color:{v.itemInk}"><span style="display:{v.itemIconShow};width:16px;height:16px;background:currentColor;mask:{v.itemMask}"></span>{t(v.itemMark)}</span>
            <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px"><span style="font:var(--weight-semibold) 13.5px/1.3 var(--font-sans);color:var(--ink,#ECECF1);overflow-wrap:anywhere">{t(v.itemTitle)}</span><span style="font:var(--weight-regular) 12px/1.3 var(--font-mono);color:var(--ink-4,#8A8A99);overflow-wrap:anywhere">{t(v.itemSub)}</span></span>
          </div>
        </div>
        <TextArea value={v.msg} placeholder="Add a message (optional)" help="" maxLength={500} minHeight={76} onInput={v.onMsg}></TextArea>
      </div>
      <div style="flex:none;display:flex;justify-content:flex-end;gap:var(--space-8);padding:var(--space-12) var(--space-16) var(--space-16);border-top:1px solid var(--line-1,rgba(255,255,255,.07))">
        <Button label="Back" variant="secondary" onClick={v.back}></Button>
        <Button label={v.sendLabel} variant="primary" onClick={v.send}></Button>
      </div>
    {/if}
  </div>
</DialogShell>

<style>
  .dc-p0:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
</style>

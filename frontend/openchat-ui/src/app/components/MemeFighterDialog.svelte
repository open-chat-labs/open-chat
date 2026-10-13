<!-- Generated from lib/MemeFighterDialog.dc.html (source hash a1fc291c) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './MemeFighterDialog.logic.js';
  import Button from '../../lib/components/Button.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';

  interface Props {
    z?: number;
    onAttach?: (meme: { src: string; template: string }) => void;
    onClose?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:fixed;inset:0;z-index:{v.z};display:flex;align-items:center;justify-content:center;padding:{v.outerPad}">
  <div style="position:absolute;inset:0;background:var(--scrim);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)" onclick={v.onClose} aria-hidden="true"></div>
  <div style="position:relative;width:100%;max-width:{v.dlgW};height:{v.dlgH};max-height:100%;outline:none;display:flex;flex-direction:column;overflow:hidden;border-radius:var(--radius-xl,22px);background:var(--surface-1,#0e0e12);color:var(--ink,#ECECF1);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),0 24px 64px rgba(0,0,0,.45)" use:ref={v.boxRef} data-oc-managed="" tabindex="-1" role="dialog" aria-modal="true" aria-label="Meme Fighter" onkeydown={v.onKey}>
    <div style="flex:none;display:flex;align-items:center;gap:8px;height:{v.headH};box-sizing:border-box;padding:0 12px 0 {v.headPadL};border-bottom:1px solid var(--line-1,rgba(255,255,255,.07))">
      {#if v.showBack}<IconButton variant="ghost" icon="back" label="Back to templates" onClick={v.back}></IconButton>{/if}
      <span style="flex:1;padding-left:{v.titlePad};font:700 17px/1 var(--font-sans)">{t(v.headTitle)}</span>
      <IconButton variant="ghost" icon="close" label="Close" onClick={v.onClose}></IconButton>
    </div>
    {#if v.wide}
      <div style="flex:1;min-height:0;display:grid;grid-template-columns:300px minmax(0,1fr)">
        <div style="min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:14px;padding:16px;border-right:1px solid var(--line-1,rgba(255,255,255,.07))">
          <div style="flex:none;display:flex;align-items:center;gap:10px;height:40px;padding:0 12px;border-radius:11px;background:var(--field,#14141a);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))">
            <span style="width:15px;height:15px;flex:none;background:var(--ink-3,#9A9AA8);-webkit-mask:var(--icon-search) center/contain no-repeat;mask:var(--icon-search) center/contain no-repeat"></span>
            <input style="flex:1;min-width:0;border:0;outline:none;background:transparent;font:500 13.5px/1 var(--font-sans);color:var(--ink,#ECECF1)" value={v.q} oninput={v.onQ} placeholder="Search templates" aria-label="Search templates">
          </div>
          <div style="flex:none;display:flex;flex-wrap:wrap;gap:6px">
            {#each v.vibes ?? [] as vb, i0}
              <button style="display:flex;align-items:center;gap:5px;height:30px;padding:0 10px 0 8px;border:0;border-radius:999px;background:{vb.bg};box-shadow:inset 0 0 0 1px {vb.ring};color:{vb.ink};font:600 12px/1 var(--font-sans);cursor:pointer" onclick={vb.onClick} aria-pressed={vb.sel}><span style="font-size:13px;line-height:1">{t(vb.emoji)}</span>{t(vb.label)}</button>
            {/each}
          </div>
          <div style="flex:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
            {#each v.all ?? [] as tk, i1}
              <div style="display:flex;flex-direction:column;gap:6px;cursor:pointer" onclick={tk.onClick} role="button" tabindex="0" aria-pressed={tk.sel} aria-label={tk.name}>
                <div class="dc-p0" style="display:grid;grid-template-columns:{tk.cols};gap:2px;aspect-ratio:4/3;border-radius:10px;overflow:hidden;background:#111;box-shadow:{tk.ring}">
                  {#each tk.cells ?? [] as c, i2}<span style="background:{c}"></span>{/each}
                </div>
                <span style="font:600 12px/1.2 var(--font-sans);color:{tk.ink}">{t(tk.name)}</span>
              </div>
            {/each}
          </div>
          {#if v.noResults}<span style="padding:20px 0;text-align:center;font:400 13px/1.4 var(--font-sans);color:var(--ink-4,#8A8A99)">No templates match</span>{/if}
        </div>
        <div style="min-height:0;display:flex;flex-direction:column">
          <div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:18px;padding:22px">
            <div style="position:relative;flex:none;width:100%;max-width:{v.c2Max};align-self:center;aspect-ratio:{v.ar};border-radius:14px;overflow:hidden;container-type:inline-size">
              <div style="position:absolute;inset:0;display:grid;grid-template-columns:{v.tpl.cols};gap:2px;background:#111">
                {#each v.tpl.cells ?? [] as c, i3}<span style="background:{c}"></span>{/each}
              </div>
              {#each v.boxes ?? [] as b, i4}
                <div style="position:absolute;left:{b.x};top:{b.y};width:{b.w};height:{b.h};display:flex;align-items:center;justify-content:center;padding:0 {b.padX};box-sizing:border-box;border-radius:8px;outline:{b.cOutline};outline-offset:-2px">
                  <span style="text-align:center;text-transform:uppercase;font:400 {b.fs}/1.05 'Anton',Impact,sans-serif;color:#fff;-webkit-text-stroke:1px #000;paint-order:stroke fill;text-shadow:0 1px 2px rgba(0,0,0,.6);word-break:normal;overflow-wrap:normal;white-space:pre-line">{t(b.shown)}</span>
                  <span style="position:absolute;top:-1px;left:-1px;min-width:20px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:6px 0 6px 0;background:var(--accent,#FF5672);font:700 11px/1 var(--font-mono);color:var(--on-accent,#2E0512)">{t(b.n)}</span>
                </div>
              {/each}
            </div>
            <div style="flex:none;display:flex;flex-direction:column;gap:10px">
              {#each v.boxes ?? [] as b, i5}
                <label style="display:flex;align-items:center;gap:10px;height:46px;padding:0 6px 0 8px;border-radius:12px;background:var(--field,#14141a);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))">
                  <span style="flex:none;min-width:26px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:7px;background:var(--accent,#FF5672);font:700 12px/1 var(--font-mono);color:var(--on-accent,#2E0512)">{t(b.n)}</span>
                  <input style="flex:1;min-width:0;border:0;outline:none;background:transparent;font:500 14px/1 var(--font-sans);color:var(--ink,#ECECF1)" value={b.value} oninput={b.onInput} onfocus={b.onFocus} onblur={v.blurC} placeholder={b.phLong} aria-label={b.label}>
                </label>
              {/each}
            </div>
          </div>
          <div style="flex:none;display:flex;align-items:center;gap:10px;padding:14px 20px;border-top:1px solid var(--line-1,rgba(255,255,255,.07))">
            <span style="flex:1;min-width:0;font:600 13px/1.35 var(--font-sans)">{t(v.tpl.name)}</span>
            {#if v.hasText}<Button label="Clear text" variant="ghost" onClick={v.clear}></Button>{/if}
            <Button label={v.cta} disabled={v.noText} onClick={v.generate}></Button>
          </div>
        </div>
      </div>
    {/if}
    {#if v.narrowBrowse}
      <div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:16px;padding:14px 16px 20px">
          <div style="flex:none;display:flex;align-items:center;gap:10px;height:44px;padding:0 14px;border-radius:12px;background:var(--field,#14141a);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))">
            <span style="width:16px;height:16px;flex:none;background:var(--ink-3,#9A9AA8);-webkit-mask:var(--icon-search) center/contain no-repeat;mask:var(--icon-search) center/contain no-repeat"></span>
            <input style="flex:1;min-width:0;border:0;outline:none;background:transparent;font:500 14px/1 var(--font-sans);color:var(--ink,#ECECF1)" value={v.q} oninput={v.onQ} placeholder="Search templates" aria-label="Search templates">
          </div>
          <div style="flex:none;display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:0 16px">
            {#each v.vibes ?? [] as vb, i6}
              <button style="flex:none;display:flex;align-items:center;gap:6px;height:36px;padding:0 12px 0 10px;border:0;border-radius:999px;background:{vb.bg};box-shadow:inset 0 0 0 1px {vb.ring};color:{vb.ink};font:600 13px/1 var(--font-sans);cursor:pointer" onclick={vb.onClick} aria-pressed={vb.sel}><span style="font-size:15px;line-height:1">{t(vb.emoji)}</span>{t(vb.label)}</button>
            {/each}
          </div>
          <div style="flex:none;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
            {#each v.all ?? [] as tk, i7}
              <div style="display:flex;flex-direction:column;gap:7px;cursor:pointer" onclick={tk.onClick} role="button" tabindex="0" aria-label={tk.name}>
                <div style="display:grid;grid-template-columns:{tk.cols};gap:2px;aspect-ratio:4/3;border-radius:12px;overflow:hidden;background:#111;box-shadow:{tk.ring}">
                  {#each tk.cells ?? [] as c, i8}<span style="background:{c}"></span>{/each}
                </div>
                <span style="font:600 12.5px/1.2 var(--font-sans);color:{tk.ink}">{t(tk.name)}</span>
              </div>
            {/each}
          </div>
          {#if v.noResults}<span style="padding:20px 0;text-align:center;font:400 13px/1.4 var(--font-sans);color:var(--ink-4,#8A8A99)">No templates match</span>{/if}
        </div>
    {/if}
    {#if v.narrowEdit}
      <div style="flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;gap:16px;padding:16px">
          <div style="position:relative;flex:none;width:100%;max-width:{v.nMax};align-self:center;aspect-ratio:{v.ar};border-radius:12px;overflow:hidden;container-type:inline-size">
            <div style="position:absolute;inset:0;display:grid;grid-template-columns:{v.tpl.cols};gap:2px;background:#111">
              {#each v.tpl.cells ?? [] as c, i9}<span style="background:{c}"></span>{/each}
            </div>
            {#each v.boxes ?? [] as b, i10}
              <div style="position:absolute;left:{b.x};top:{b.y};width:{b.w};height:{b.h};display:flex;align-items:center;justify-content:center;padding:0 {b.padX};box-sizing:border-box;border-radius:7px;outline:{b.cOutline};outline-offset:-2px">
                <span style="text-align:center;text-transform:uppercase;font:400 {b.fs}/1.05 'Anton',Impact,sans-serif;color:#fff;-webkit-text-stroke:1px #000;paint-order:stroke fill;text-shadow:0 1px 2px rgba(0,0,0,.6);word-break:normal;overflow-wrap:normal;white-space:pre-line">{t(b.shown)}</span>
                <span style="position:absolute;top:-1px;left:-1px;min-width:18px;height:18px;display:flex;align-items:center;justify-content:center;border-radius:5px 0 5px 0;background:var(--accent,#FF5672);font:700 10px/1 var(--font-mono);color:var(--on-accent,#2E0512)">{t(b.n)}</span>
              </div>
            {/each}
          </div>
          <div style="flex:none;display:flex;flex-direction:column;gap:10px">
            {#each v.boxes ?? [] as b, i11}
              <label style="display:flex;align-items:center;gap:10px;height:48px;padding:0 6px 0 8px;border-radius:12px;background:var(--field,#14141a);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))">
                <span style="flex:none;min-width:26px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:7px;background:var(--accent,#FF5672);font:700 12px/1 var(--font-mono);color:var(--on-accent,#2E0512)">{t(b.n)}</span>
                <input style="flex:1;min-width:0;border:0;outline:none;background:transparent;font:500 15px/1 var(--font-sans);color:var(--ink,#ECECF1)" value={b.value} oninput={b.onInput} onfocus={b.onFocus} onblur={v.blurC} placeholder={b.phLong} aria-label={b.label}>
              </label>
            {/each}
          </div>
        </div>
        <div style="flex:none;display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid var(--line-1,rgba(255,255,255,.07))">
          {#if v.hasText}<Button label="Clear" variant="ghost" onClick={v.clear}></Button>{/if}
          <div style="flex:1;min-width:0"><Button label={v.cta} disabled={v.noText} onClick={v.generate} fullWidth={true}></Button></div>
        </div>
    {/if}
  </div>
</div>

<style>
  .dc-p0:hover{box-shadow:0 0 0 2px var(--accent,#FF5672) !important}
</style>

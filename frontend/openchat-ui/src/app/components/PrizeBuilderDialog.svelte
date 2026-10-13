<!-- Generated from lib/PrizeBuilderDialog.dc.html (source hash 5169413b) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './PrizeBuilderDialog.logic.js';
  import type { Prize } from '../../lib/types';
  import Button from '../../lib/components/Button.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';
  import PrizeMessage from '../../lib/components/PrizeMessage.svelte';
  import QuickAmountChips from '../../lib/components/QuickAmountChips.svelte';
  import Toggle from '../../lib/components/Toggle.svelte';
  import TokenAvatar from '../../lib/components/TokenAvatar.svelte';

  interface Props {
    z?: number;
    initial?: Prize | null;
    onAttach?: (prize: Prize) => void;
    onClose?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:fixed;inset:0;z-index:{v.z};display:flex;align-items:center;justify-content:center;padding:24px">
  <div style="position:absolute;inset:0;background:var(--scrim);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)" onclick={v.onClose} aria-hidden="true"></div>
  <div style="position:relative;width:100%;max-width:{v.dlgW};max-height:100%;outline:none;display:flex;flex-direction:column;overflow:hidden;border-radius:var(--radius-xl,22px);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),0 24px 64px rgba(0,0,0,.45)" use:ref={v.boxRef} data-oc-managed="" tabindex="-1" role="dialog" aria-modal="true" aria-label={v.title} onkeydown={v.onKey}>
    <div style="flex:none;display:flex;align-items:center;gap:12px;height:var(--header-h,66px);box-sizing:border-box;padding:0 12px 0 22px;border-bottom:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span style="flex:1;font:700 17px/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.title)}</span>
      <IconButton variant="ghost" icon="close" label="Close" onClick={v.onClose}></IconButton>
    </div>
    <div style="flex:1;min-height:0;overflow-y:auto;display:grid;grid-template-columns:{v.grid}">
      <div style="display:flex;flex-direction:column;gap:18px;padding:22px;min-width:0">
        <div style="display:flex;flex-direction:column;align-items:center;gap:14px;padding:22px 16px 18px;border-radius:18px;background:var(--field,#14141a);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))">
          <div class="dc-p0" style="display:flex;align-items:center;gap:10px;padding:6px 12px 6px 6px;border-radius:999px;background:var(--overlay-1,rgba(255,255,255,.05));cursor:pointer" onclick={v.openTok} role="button" tabindex="0" aria-label="Change prize token" aria-haspopup="dialog">
            <TokenAvatar symbol={v.tok.symbol} mark={v.tok.mark} gradient={v.tok.gradient} size={28}></TokenAvatar>
            <span style="font:700 14px/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.tok.symbol)}</span>
            <span style="font:500 12px/1 var(--font-mono);color:var(--ink-4,#8A8A99)">{t(v.balText)}</span>
            <span style="width:14px;height:14px;background:var(--ink-3,#9A9AA8);-webkit-mask:var(--icon-chevron-down) center/contain no-repeat;mask:var(--icon-chevron-down) center/contain no-repeat"></span>
          </div>
          <input style="width:100%;border:0;outline:none;background:transparent;text-align:center;font:700 40px/1.1 var(--font-sans);letter-spacing:-.02em;color:var(--ink,#ECECF1)" use:ref={v.amtRef} value={v.amt} oninput={v.onAmt} inputmode="decimal" placeholder="0" aria-label="Total prize amount">
          <span style="font:400 12px/1.4 var(--font-sans);color:{v.amtHintInk};text-align:center">{t(v.amtHint)}</span>
          <QuickAmountChips size="sm" onSelect={v.onQuick}></QuickAmountChips>
        </div>
        <div style="display:flex;flex-direction:column;border-radius:14px;background:var(--surface-2,#15151b);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07));overflow:hidden">
          {#each v.rows ?? [] as r, i0}
            <div style="display:flex;flex-direction:column;border-top:{r.line}">
              <div class="dc-p1" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer" onclick={r.onClick} role="button" tabindex="0" aria-expanded={r.open}>
                <span style="width:18px;height:18px;flex:none;background:var(--ink-3,#9A9AA8);-webkit-mask:{r.mask};mask:{r.mask}"></span>
                <span style="flex:none;font:600 13.5px/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">{t(r.label)}</span>
                <span style="flex:1;min-width:0;text-align:right;font:500 13px/1.3 var(--font-sans);color:var(--ink,#ECECF1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(r.value)}</span>
                <span style="width:14px;height:14px;flex:none;background:var(--ink-4,#8A8A99);transform:rotate({r.rot});transition:transform .2s;-webkit-mask:var(--icon-chevron-down) center/contain no-repeat;mask:var(--icon-chevron-down) center/contain no-repeat"></span>
              </div>
              {#if r.isWin}
                <div style="display:flex;flex-direction:column;gap:12px;padding:2px 16px 16px">
                  <div style="display:flex;align-items:center;gap:6px;height:44px;padding:0 4px;border-radius:12px;background:var(--field,#14141a);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1))">
                    <button class="dc-p2" style="width:36px;height:36px;border:0;border-radius:9px;background:var(--overlay-1,rgba(255,255,255,.05));color:var(--ink,#ECECF1);font:500 20px/1 var(--font-sans);cursor:pointer" onclick={v.winDown} aria-label="Fewer winners">−</button>
                    <input style="flex:1;min-width:0;border:0;outline:none;background:transparent;text-align:center;font:700 16px/1 var(--font-sans);color:var(--ink,#ECECF1)" value={v.win} oninput={v.onWin} inputmode="numeric" aria-label="Number of winners">
                    <button class="dc-p3" style="width:36px;height:36px;border:0;border-radius:9px;background:var(--overlay-1,rgba(255,255,255,.05));color:var(--ink,#ECECF1);font:500 20px/1 var(--font-sans);cursor:pointer" onclick={v.winUp} aria-label="More winners">+</button>
                  </div>
                  <span style="margin-top:-4px;font:400 12px/1.4 var(--font-sans);color:var(--ink-4,#8A8A99)">1 to 1,000 winners</span>
                  <Toggle label="Split evenly" help="Off: each winner gets a random amount." on={v.even} onChange={v.onEven}></Toggle>
                </div>
              {/if}
              {#if r.isDur}
                <div style="display:flex;flex-wrap:wrap;gap:6px;padding:2px 16px 16px">
                  {#each v.durs ?? [] as d, i1}
                    <button style="height:34px;padding:0 14px;border:0;border-radius:999px;background:{d.bg};box-shadow:inset 0 0 0 1px {d.ring};color:{d.ink};font:600 13px/1 var(--font-sans);cursor:pointer" onclick={d.onClick} aria-pressed={d.sel}>{t(d.label)}</button>
                  {/each}
                </div>
              {/if}
              {#if r.isWho}
                <div style="display:flex;flex-direction:column;gap:10px;padding:2px 16px 16px">
                  <div style="display:flex;flex-wrap:wrap;gap:6px">
                    {#each v.chips ?? [] as ch, i2}
                      <button style="display:flex;align-items:center;gap:7px;height:34px;padding:0 12px 0 10px;border:0;border-radius:999px;background:{ch.bg};box-shadow:inset 0 0 0 1px {ch.ring};color:{ch.ink};font:600 13px/1 var(--font-sans);cursor:pointer" onclick={ch.onClick} aria-pressed={ch.on}>
                        <span style="width:15px;height:15px;background:currentColor;-webkit-mask:{ch.mask};mask:{ch.mask}"></span>{t(ch.label)}<span style="width:12px;height:12px;background:currentColor;opacity:.8;-webkit-mask:{ch.trail};mask:{ch.trail}"></span>
                      </button>
                    {/each}
                  </div>
                  {#if v.pickOpen}
                    <div style="display:flex;flex-direction:column;gap:10px;padding:12px;border-radius:12px;background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
                      <span style="font:600 12.5px/1.3 var(--font-sans);color:var(--ink-2,#C9C9D4)">{t(v.pickTitle)}</span>
                      <div style="display:flex;flex-wrap:wrap;gap:6px">
                        {#each v.pickOpts ?? [] as p, i3}
                          <button style="height:32px;padding:0 12px;border:0;border-radius:999px;background:{p.bg};box-shadow:inset 0 0 0 1px {p.ring};color:{p.ink};font:600 12.5px/1 var(--font-sans);cursor:pointer" onclick={p.onClick}>{t(p.label)}</button>
                        {/each}
                      </div>
                    </div>
                  {/if}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      </div>
      {#if v.wide}
        <div style="display:flex;flex-direction:column;gap:18px;padding:22px;background:var(--surface-0,#07070a);border-left:1px solid var(--line-1,rgba(255,255,255,.07))">
          <span style="font:600 11px/1 var(--font-mono);letter-spacing:.08em;color:var(--ink-4,#8A8A99)">PREVIEW</span>
          <PrizeMessage token={v.tok} winners={v.winN} claimed={0} endsIn={v.durShort} endingSoon={false} gates={v.gates} state="open" note="" time="now"></PrizeMessage>
          <div style="display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-radius:14px;background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07))">
            {#each v.costRows ?? [] as c, i4}
              <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding-top:{c.pad};border-top:{c.line}">
                <span style="font:{c.weight} 13px/1.3 var(--font-sans);color:{c.labelInk}">{t(c.label)}</span>
                <span style="font:{c.weight} 13px/1.3 var(--font-mono);color:{c.valueInk}">{t(c.value)}</span>
              </div>
            {/each}
          </div>
          <span style="font:400 12px/1.5 var(--font-sans);color:var(--ink-4,#8A8A99);text-wrap:pretty">{t(v.perWinnerLong)}</span>
        </div>
      {/if}
    </div>
    <div style="flex:none;display:flex;align-items:center;gap:10px;padding:14px 22px;border-top:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span style="flex:1;min-width:0;font:500 12.5px/1.35 var(--font-sans);color:{v.footInk}">{t(v.footText)}</span>
      <Button label="Cancel" variant="ghost" onClick={v.onClose}></Button>
      <Button label={v.cta} disabled={v.notOk} onClick={v.attach}></Button>
    </div>
    {#if v.tokOpen}
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;background:var(--scrim,rgba(0,0,0,.5));backdrop-filter:blur(4px)">
        <div style="width:100%;max-width:380px;display:flex;flex-direction:column;border-radius:18px;background:var(--surface-2,#15151b);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),0 16px 40px rgba(0,0,0,.4);overflow:hidden" role="dialog" aria-label="Prize token">
          <div style="display:flex;align-items:center;padding:0 8px 0 18px;height:54px;border-bottom:1px solid var(--line-1,rgba(255,255,255,.07))"><span style="flex:1;font:700 15px/1 var(--font-sans);color:var(--ink,#ECECF1)">Prize token</span><IconButton variant="ghost" icon="close" label="Close" onClick={v.closeTok}></IconButton></div>
          <div style="display:flex;flex-direction:column;padding:6px">
            {#each v.toks ?? [] as tk, i5}
              <div class="dc-p4" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;background:{tk.bg};cursor:pointer" onclick={tk.onClick} role="button" tabindex="0">
                <TokenAvatar symbol={tk.symbol} mark={tk.mark} gradient={tk.gradient} size={40}></TokenAvatar>
                <span style="flex:1;font:600 14px/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(tk.symbol)}</span>
                <span style="font:500 13px/1 var(--font-mono);color:var(--ink-3,#9A9AA8)">{t(tk.bal)}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.1)) !important}
  .dc-p0:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
  .dc-p1:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p1:focus-visible{box-shadow:inset var(--focus-ring) !important;outline:none !important}
  .dc-p2:hover{background:var(--overlay-2,rgba(255,255,255,.1)) !important}
  .dc-p3:hover{background:var(--overlay-2,rgba(255,255,255,.1)) !important}
  .dc-p4:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
  .dc-p4:focus-visible{box-shadow:var(--focus-ring) !important;outline:none !important}
</style>

<!-- Generated from lib/WalletSend.dc.html (source hash 7681cb15) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './WalletSend.logic.js';
  import DetailRow from '../../lib/components/DetailRow.svelte';
  import DialogShell from '../../lib/components/DialogShell.svelte';
  import ListSectionLabel from '../../lib/components/ListSectionLabel.svelte';
  import PageHeader from '../../lib/components/PageHeader.svelte';
  import QuickAmountChips from '../../lib/components/QuickAmountChips.svelte';
  import SideCard from '../../lib/components/SideCard.svelte';

  interface Props {
    token?: string;
    onClose?: () => void;
    onSent?: (v: { symbol: string, amount: number, fiat: number, to: string, dp: number }) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:absolute;inset:0;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;background:var(--surface-1,#0e0e12)" use:ref={v.rootRef} data-screen-label="Wallet send">
      <PageHeader title={v.s2.title} onBack={v.s2.back} avatarMark={v.s2.headMark} avatarGradient={v.s2.tok.grad}>{#if v.s2.showFormHead}<span style="font:500 12.5px/1 'JetBrains Mono',monospace;color:var(--ink-4,#8A8A99)">{t(v.s2.tok.balance)}</span>{/if}</PageHeader>
      {#if v.wideForm}
      <div style="flex:1;min-height:0;overflow-y:auto;display:grid;grid-template-columns:minmax(0,1fr) 320px;grid-auto-rows:auto;align-content:start;gap:28px;padding:28px max(32px, calc((100% - 960px) / 2));align-items:stretch">
        <div style="display:flex;flex-direction:column;gap:32px;min-width:0">
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:5px;border-radius:14px;background:var(--overlay-1)">
              {#each v.s2.modes ?? [] as o, i0}<span style="display:flex;align-items:center;justify-content:center;gap:9px;height:44px;border-radius:10px;background:{o.bg};font:600 14px/1 'Plus Jakarta Sans',sans-serif;color:{o.ink};cursor:pointer" onclick={o.pick} tabindex="0" role="tab" aria-selected={o.on}><span style="width:14px;height:14px;background:{o.ink};mask:{o.mask}"></span>{t(o.label)}</span>{/each}
            </div>
            {#if v.s2.isUser}
              <span style="margin-top:22px;font:600 11.5px/1 'JetBrains Mono',monospace;letter-spacing:.08em;color:var(--ink-4,#8A8A99)">OPENCHAT USER</span>
              {#if v.s2.hasUser}
                <div style="display:flex;align-items:center;gap:12px;height:56px;padding:0 10px 0 14px;border-radius:12px;background:var(--overlay-1);box-shadow:inset 0 0 0 1px var(--accent,#FF5672)">
                  <span style="width:32px;height:32px;border-radius:50%;background:{v.s2.user.grad}"></span>
                  <span style="flex:1;display:flex;flex-direction:column;gap:4px"><span style="font:600 14px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink,#ECECF1)">{t(v.s2.user.name)}</span><span style="font:400 12px/1 'JetBrains Mono',monospace;color:var(--ink-4,#8A8A99)">{t(v.s2.user.handle)}</span></span>
                  <span class="dc-p0" style="width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer" onclick={v.s2.clearUser} role="button" tabindex="0" aria-label="Clear" title="Clear"><span style="width:14px;height:14px;background:var(--ink-3,#9A9AA8);mask:{v.m.close}"></span></span>
                </div>
              {/if}
              {#if v.s2.noUser}
                <div style="display:flex;align-items:center;gap:10px;height:56px;padding:0 14px;border-radius:12px;background:var(--overlay-1);box-shadow:inset 0 0 0 1px var(--line-1)"><span style="width:15px;height:15px;background:var(--ink-4,#8A8A99);mask:{v.m.search}"></span><span style="flex:1;font:400 14px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink-5,#6E6E7C)">Search OpenChat users</span></div>
              {/if}
              <div style="display:flex;flex-wrap:wrap;gap:6px">
                {#each v.s2.quick ?? [] as p, i1}<span class="dc-p1" style="display:flex;align-items:center;gap:8px;height:34px;padding:0 12px 0 4px;border-radius:999px;background:{p.bg};box-shadow:{p.ring};cursor:pointer" onclick={p.pick} tabindex="0" role="button"><span style="width:26px;height:26px;border-radius:50%;background:{p.grad}"></span><span style="font:600 12.5px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink,#ECECF1)">{t(p.first)}</span></span>{/each}
              </div>
            {/if}
            {#if v.s2.isAddr}
              <span style="margin-top:22px;font:600 11.5px/1 'JetBrains Mono',monospace;letter-spacing:.08em;color:var(--ink-4,#8A8A99)">ADDRESS</span>
              <div style="display:flex;align-items:center;gap:10px;min-height:56px;padding:10px 10px 10px 14px;box-sizing:border-box;border-radius:12px;background:var(--overlay-1);box-shadow:inset 0 0 0 1px {v.s2.addrLine}">
                <input style="flex:1;min-width:0;border:0;outline:0;background:transparent;font:500 13.5px/1.5 'JetBrains Mono',monospace;color:var(--ink,#ECECF1)" value={v.s2.address} oninput={v.s2.onAddress} placeholder="Paste or type an address" aria-label="Destination address">
                {#if v.s2.hasDetect}<span style="flex:none;height:24px;padding:0 8px;display:flex;align-items:center;gap:5px;border-radius:7px;background:{v.s2.detectBg};font:600 11.5px/1 'Plus Jakarta Sans',sans-serif;color:{v.s2.detectInk};white-space:nowrap"><span style="width:11px;height:11px;background:{v.s2.detectInk};mask:{v.s2.detectMask}"></span>{t(v.s2.detectLabel)}</span>{/if}
              </div>
              <div style="display:flex;gap:6px">{#each v.s2.tools ?? [] as a, i2}<span class="dc-p2" style="display:flex;align-items:center;gap:7px;height:34px;padding:0 12px;border-radius:10px;background:var(--overlay-1);font:600 12.5px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink-2,#C9C9D4);cursor:pointer" onclick={a.go} tabindex="0" role="button"><span style="width:14px;height:14px;background:var(--ink-2,#C9C9D4);mask:{a.mask}"></span>{t(a.label)}</span>{/each}</div>
            {/if}
          </div>
          {#if v.s2.showNets}
            <div style="display:flex;flex-direction:column;gap:10px">
              <ListSectionLabel label="NETWORK"></ListSectionLabel>
              <div style="position:relative">
                <div class="dc-p3" style="display:flex;align-items:center;gap:12px;height:56px;padding:0 14px 0 16px;border-radius:12px;background:var(--overlay-1);box-shadow:inset 0 0 0 1px {v.s2.netLine};cursor:pointer;user-select:none" onclick={v.s2.toggleNet} tabindex="0" role="button" aria-expanded={v.s2.netOpen}>
                  <span style="flex:1;min-width:0;font:600 14px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink,#ECECF1)">{t(v.s2.netSel.label)}</span>
                  <span style="flex:none;font:500 12.5px/1 'JetBrains Mono',monospace;color:var(--ink-3,#9A9AA8)">{t(v.s2.netSel.time)} · {t(v.s2.netSel.fee)}</span>
                  <span style="flex:none;width:13px;height:13px;background:var(--ink-3,#9A9AA8);mask:{v.m.caret};transform:{v.s2.netCaret}"></span>
                </div>
                {#if v.s2.netOpen}
                  <div style="position:fixed;inset:0;z-index:9" onclick={v.s2.toggleNet}></div>
                  <div style="position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:10;display:flex;flex-direction:column;padding:6px;border-radius:12px;background:var(--surface-2,#1b1b22);box-shadow:inset 0 0 0 1px var(--line-2),0 18px 40px rgba(0,0,0,.5)">
                    {#each v.s2.nets ?? [] as n, i3}<div class="dc-p4" style="display:flex;align-items:center;gap:12px;min-height:56px;padding:0 12px;border-radius:9px;cursor:pointer" onclick={n.pick} tabindex="0" role="option" aria-selected={n.on}>
                      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px"><span style="font:600 14px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink,#ECECF1)">{t(n.label)}</span><span style="font:400 12px/1.3 'Plus Jakarta Sans',sans-serif;color:var(--ink-4,#8A8A99)">{t(n.short)}</span></span>
                      <span style="flex:none;width:80px;text-align:end;font:600 12.5px/1 'JetBrains Mono',monospace;color:var(--ink-2,#C9C9D4)">{t(n.time)}</span>
                      <span style="flex:none;width:110px;text-align:end;font:500 12.5px/1 'JetBrains Mono',monospace;color:var(--ink-3,#9A9AA8)">{t(n.fee)}</span>
                      <span style="flex:none;width:16px;height:16px;background:{n.tick};mask:{v.m.check}"></span>
                    </div>{/each}
                  </div>
                {/if}
              </div>
            </div>
          {/if}
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;align-items:center"><span style="flex:1;font:600 11.5px/1 'JetBrains Mono',monospace;letter-spacing:.08em;color:var(--ink-4,#8A8A99)">AMOUNT</span><span style="font:500 12px/1 'JetBrains Mono',monospace;color:var(--ink-4,#8A8A99)">Available {t(v.s2.available)}</span></div>
            <div style="display:flex;align-items:center;gap:14px;height:92px;padding:0 14px 0 20px;border-radius:14px;background:var(--overlay-1);box-shadow:inset 0 0 0 1px {v.s2.amtLine}">
              <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px">
                <div style="display:flex;align-items:baseline;gap:8px">{#if v.s2.inUsd}<span style="font:700 34px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink-3,#9A9AA8)">$</span>{/if}<input style="flex:1;min-width:0;border:0;outline:0;padding:0;background:transparent;font:700 34px/1 'Plus Jakarta Sans',sans-serif;letter-spacing:-.02em;color:var(--ink,#ECECF1);font-variant-numeric:tabular-nums" value={v.s2.amount} oninput={v.s2.onAmount} inputmode="decimal" placeholder="0" aria-label="Amount"></div>
                <span style="font:500 13px/1 'JetBrains Mono',monospace;color:{v.s2.amtNoteInk}">{t(v.s2.amtNote)}</span>
              </div>
              <span class="dc-p5" style="flex:none;display:flex;align-items:center;gap:7px;height:40px;padding:0 12px;border-radius:10px;background:var(--overlay-2);font:700 14px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink,#ECECF1);cursor:pointer;user-select:none" onclick={v.s2.toggleUnit} tabindex="0" aria-label="Switch between token and USD" role="button" title="Switch between token and USD">{t(v.s2.unitLabel)}<span style="width:13px;height:13px;background:var(--ink-3,#9A9AA8);mask:{v.m.swap}"></span></span>
            </div>
            <QuickAmountChips size="md" onSelect={v.s2.onChip}></QuickAmountChips>
          </div>
          {#if v.s2.msgCollapsed}<span class="dc-p6" style="align-self:flex-start;display:flex;align-items:center;gap:8px;height:36px;padding:0 12px 0 8px;margin-top:-8px;border-radius:10px;font:600 13.5px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink-2,#C9C9D4);cursor:pointer;user-select:none" onclick={v.s2.openMsg} tabindex="0" role="button"><span style="width:16px;height:16px;background:var(--ink-2,#C9C9D4);mask:{v.m.plus}"></span>Add a message</span>{/if}
          {#if v.s2.msgOpen}
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;align-items:center;gap:6px"><ListSectionLabel label="MESSAGE"></ListSectionLabel><span style="font:500 11.5px/1 'JetBrains Mono',monospace;color:var(--ink-5,#6E6E7C)">· OPTIONAL</span></div>
            <textarea style="resize:none;min-height:124px;padding:16px 18px;box-sizing:border-box;border:0;outline:0;border-radius:12px;background:var(--overlay-1);font:400 14px/1.5 'Plus Jakarta Sans',sans-serif;color:var(--ink,#ECECF1)" value={v.s2.message} oninput={v.s2.onMessage} placeholder={v.s2.msgPlaceholder} rows="5"></textarea>
          </div>
          {/if}
        </div>
        <div style="min-width:0;align-self:stretch;display:grid"><SideCard>
          <ListSectionLabel label="SUMMARY"></ListSectionLabel>
          <div style="display:flex;align-items:center;gap:14px;padding:22px 0 24px">
            <span style="flex:none;width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:{v.s2.tok.grad};font:700 19px/1 'Plus Jakarta Sans',sans-serif;color:#0b0b10">{t(v.s2.tok.mark)}</span>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px"><span style="font:700 30px/1.05 'Plus Jakarta Sans',sans-serif;letter-spacing:-.02em;color:{v.s2.sumInk};word-break:break-word">{t(v.s2.sumAmount)}</span><span style="font:500 13px/1 'JetBrains Mono',monospace;color:var(--ink-3,#9A9AA8)">{t(v.s2.sumFiat)}</span></div>
          </div>
          <div style="display:flex;flex-direction:column;border-top:1px solid var(--line-1)">
            <div style="display:flex;align-items:center;gap:12px;min-height:64px;border-bottom:1px solid var(--line-1)">
              <span style="flex:none;font:500 13.5px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink-3,#9A9AA8)">To</span>
              <span style="flex:1;min-width:0;display:flex;align-items:center;justify-content:flex-end;gap:10px">
                {#if v.s2.sumHasAvatar}<span style="flex:none;width:28px;height:28px;border-radius:50%;background:{v.s2.user.grad}"></span>{/if}
                <span style="min-width:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px"><span style="max-width:100%;font:600 14px/1.2 'Plus Jakarta Sans',sans-serif;color:{v.s2.toInk};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.s2.toMain)}</span>{#if v.s2.hasToSub}<span style="font:400 12px/1 'JetBrains Mono',monospace;color:var(--ink-4,#8A8A99)">{t(v.s2.toSub)}</span>{/if}</span>
              </span>
            </div>
            {#each v.s2.rows ?? [] as r, i4}<DetailRow label={r.k} value={r.v} valueColor={r.ink} size="lg" rule="bottom"></DetailRow>{/each}
            {#if v.s2.hasMsg}<div style="display:flex;flex-direction:column;gap:8px;padding:16px 0;border-bottom:1px solid var(--line-1)"><span style="font:500 13.5px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink-3,#9A9AA8)">Message</span><span style="font:400 13.5px/1.5 'Plus Jakarta Sans',sans-serif;color:var(--ink-2,#C9C9D4);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">{t(v.s2.message)}</span></div>{/if}
            <div style="display:flex;align-items:center;gap:10px;min-height:64px"><span style="flex:none;font:700 14.5px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink,#ECECF1)">Total</span><span style="flex:1;min-width:0;text-align:end;display:flex;flex-direction:column;align-items:flex-end;gap:5px"><span style="font:700 15px/1.2 'JetBrains Mono',monospace;color:{v.s2.totalInk}">{t(v.s2.total)}</span><span style="font:400 12px/1 'JetBrains Mono',monospace;color:var(--ink-4,#8A8A99)">{t(v.s2.totalFiat)}</span></span></div>
          </div>
          {#if v.s2.hasHistory}
            <div style="display:flex;flex-direction:column;gap:10px;padding-top:24px">
              <ListSectionLabel label={v.s2.histLabel}></ListSectionLabel>
              <div style="display:flex;flex-direction:column;gap:4px">
                {#each v.s2.history ?? [] as h, i5}<div class="dc-p7" style="display:flex;align-items:center;gap:10px;min-height:44px;padding:0 10px;margin:0 -10px;border-radius:10px;cursor:pointer" onclick={h.reuse} tabindex="0" aria-label="Use this amount" role="button" title="Use this amount"><span style="flex:none;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--overlay-2)"><span style="width:11px;height:11px;background:var(--ink-2,#C9C9D4);mask:{h.mask}"></span></span><span style="flex:1;min-width:0;font:500 13px/1.2 'Plus Jakarta Sans',sans-serif;color:var(--ink-2,#C9C9D4)">{t(h.label)}</span><span style="flex:none;font:600 12.5px/1 'JetBrains Mono',monospace;color:{h.ink}">{t(h.amount)}</span></div>{/each}
              </div>
            </div>
          {/if}
          <span style="flex:1;min-height:24px"></span>
          <span style="display:flex;align-items:center;justify-content:center;height:46px;border-radius:12px;background:{v.s2.ctaBg};font:700 14px/1 'Plus Jakarta Sans',sans-serif;color:{v.s2.ctaInk};cursor:{v.s2.ctaCursor};user-select:none" onclick={v.s2.go} tabindex="0" role="button" aria-disabled={v.s2.blocked}>{t(v.s2.ctaLabel)}</span>
          <span style="margin-top:14px;font:400 12px/1.5 'Plus Jakarta Sans',sans-serif;color:var(--ink-4,#8A8A99);text-align:center;text-wrap:pretty">{t(v.s2.ctaHint)}</span>
        </SideCard></div>
      </div>
      {/if}
      
      {#if v.narrowForm}
        <div style="flex:1;min-height:0;overflow-y:auto;padding:24px 22px 28px">
          <div style="display:flex;flex-direction:column;gap:32px;min-width:0">
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:5px;border-radius:14px;background:var(--overlay-1)">
              {#each v.s2.modes ?? [] as o, i6}<span style="display:flex;align-items:center;justify-content:center;gap:9px;height:44px;border-radius:10px;background:{o.bg};font:600 14px/1 'Plus Jakarta Sans',sans-serif;color:{o.ink};cursor:pointer" onclick={o.pick} tabindex="0" role="tab" aria-selected={o.on}><span style="width:14px;height:14px;background:{o.ink};mask:{o.mask}"></span>{t(o.label)}</span>{/each}
            </div>
            {#if v.s2.isUser}
              <span style="margin-top:22px;font:600 11.5px/1 'JetBrains Mono',monospace;letter-spacing:.08em;color:var(--ink-4,#8A8A99)">OPENCHAT USER</span>
              {#if v.s2.hasUser}
                <div style="display:flex;align-items:center;gap:12px;height:56px;padding:0 10px 0 14px;border-radius:12px;background:var(--overlay-1);box-shadow:inset 0 0 0 1px var(--accent,#FF5672)">
                  <span style="width:32px;height:32px;border-radius:50%;background:{v.s2.user.grad}"></span>
                  <span style="flex:1;display:flex;flex-direction:column;gap:4px"><span style="font:600 14px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink,#ECECF1)">{t(v.s2.user.name)}</span><span style="font:400 12px/1 'JetBrains Mono',monospace;color:var(--ink-4,#8A8A99)">{t(v.s2.user.handle)}</span></span>
                  <span class="dc-p8" style="width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;cursor:pointer" onclick={v.s2.clearUser} role="button" tabindex="0" aria-label="Clear" title="Clear"><span style="width:14px;height:14px;background:var(--ink-3,#9A9AA8);mask:{v.m.close}"></span></span>
                </div>
              {/if}
              {#if v.s2.noUser}
                <div style="display:flex;align-items:center;gap:10px;height:56px;padding:0 14px;border-radius:12px;background:var(--overlay-1);box-shadow:inset 0 0 0 1px var(--line-1)"><span style="width:15px;height:15px;background:var(--ink-4,#8A8A99);mask:{v.m.search}"></span><span style="flex:1;font:400 14px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink-5,#6E6E7C)">Search OpenChat users</span></div>
              {/if}
              <div style="display:flex;flex-wrap:wrap;gap:6px">
                {#each v.s2.quick ?? [] as p, i7}<span class="dc-p9" style="display:flex;align-items:center;gap:8px;height:34px;padding:0 12px 0 4px;border-radius:999px;background:{p.bg};box-shadow:{p.ring};cursor:pointer" onclick={p.pick} tabindex="0" role="button"><span style="width:26px;height:26px;border-radius:50%;background:{p.grad}"></span><span style="font:600 12.5px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink,#ECECF1)">{t(p.first)}</span></span>{/each}
              </div>
            {/if}
            {#if v.s2.isAddr}
              <span style="margin-top:22px;font:600 11.5px/1 'JetBrains Mono',monospace;letter-spacing:.08em;color:var(--ink-4,#8A8A99)">ADDRESS</span>
              <div style="display:flex;align-items:center;gap:10px;min-height:56px;padding:10px 10px 10px 14px;box-sizing:border-box;border-radius:12px;background:var(--overlay-1);box-shadow:inset 0 0 0 1px {v.s2.addrLine}">
                <input style="flex:1;min-width:0;border:0;outline:0;background:transparent;font:500 13.5px/1.5 'JetBrains Mono',monospace;color:var(--ink,#ECECF1)" value={v.s2.address} oninput={v.s2.onAddress} placeholder="Paste or type an address" aria-label="Destination address">
                {#if v.s2.hasDetect}<span style="flex:none;height:24px;padding:0 8px;display:flex;align-items:center;gap:5px;border-radius:7px;background:{v.s2.detectBg};font:600 11.5px/1 'Plus Jakarta Sans',sans-serif;color:{v.s2.detectInk};white-space:nowrap"><span style="width:11px;height:11px;background:{v.s2.detectInk};mask:{v.s2.detectMask}"></span>{t(v.s2.detectLabel)}</span>{/if}
              </div>
              <div style="display:flex;gap:6px">{#each v.s2.tools ?? [] as a, i8}<span class="dc-p10" style="display:flex;align-items:center;gap:7px;height:34px;padding:0 12px;border-radius:10px;background:var(--overlay-1);font:600 12.5px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink-2,#C9C9D4);cursor:pointer" onclick={a.go} tabindex="0" role="button"><span style="width:14px;height:14px;background:var(--ink-2,#C9C9D4);mask:{a.mask}"></span>{t(a.label)}</span>{/each}</div>
            {/if}
          </div>
          {#if v.s2.showNets}
            <div style="display:flex;flex-direction:column;gap:10px">
              <ListSectionLabel label="NETWORK"></ListSectionLabel>
              <div style="position:relative">
                <div class="dc-p11" style="display:flex;align-items:center;gap:12px;height:56px;padding:0 14px 0 16px;border-radius:12px;background:var(--overlay-1);box-shadow:inset 0 0 0 1px {v.s2.netLine};cursor:pointer;user-select:none" onclick={v.s2.toggleNet} tabindex="0" role="button" aria-expanded={v.s2.netOpen}>
                  <span style="flex:1;min-width:0;font:600 14px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink,#ECECF1)">{t(v.s2.netSel.label)}</span>
                  <span style="flex:none;font:500 12.5px/1 'JetBrains Mono',monospace;color:var(--ink-3,#9A9AA8)">{t(v.s2.netSel.time)} · {t(v.s2.netSel.fee)}</span>
                  <span style="flex:none;width:13px;height:13px;background:var(--ink-3,#9A9AA8);mask:{v.m.caret};transform:{v.s2.netCaret}"></span>
                </div>
                {#if v.s2.netOpen}
                  <div style="position:fixed;inset:0;z-index:9" onclick={v.s2.toggleNet}></div>
                  <div style="position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:10;display:flex;flex-direction:column;padding:6px;border-radius:12px;background:var(--surface-2,#1b1b22);box-shadow:inset 0 0 0 1px var(--line-2),0 18px 40px rgba(0,0,0,.5)">
                    {#each v.s2.nets ?? [] as n, i9}<div class="dc-p12" style="display:flex;align-items:center;gap:12px;min-height:56px;padding:0 12px;border-radius:9px;cursor:pointer" onclick={n.pick} tabindex="0" role="option" aria-selected={n.on}>
                      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px"><span style="font:600 14px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink,#ECECF1)">{t(n.label)}</span><span style="font:400 12px/1.3 'Plus Jakarta Sans',sans-serif;color:var(--ink-4,#8A8A99)">{t(n.short)}</span></span>
                      <span style="flex:none;width:80px;text-align:end;font:600 12.5px/1 'JetBrains Mono',monospace;color:var(--ink-2,#C9C9D4)">{t(n.time)}</span>
                      <span style="flex:none;width:110px;text-align:end;font:500 12.5px/1 'JetBrains Mono',monospace;color:var(--ink-3,#9A9AA8)">{t(n.fee)}</span>
                      <span style="flex:none;width:16px;height:16px;background:{n.tick};mask:{v.m.check}"></span>
                    </div>{/each}
                  </div>
                {/if}
              </div>
            </div>
          {/if}
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;align-items:center"><span style="flex:1;font:600 11.5px/1 'JetBrains Mono',monospace;letter-spacing:.08em;color:var(--ink-4,#8A8A99)">AMOUNT</span><span style="font:500 12px/1 'JetBrains Mono',monospace;color:var(--ink-4,#8A8A99)">Available {t(v.s2.available)}</span></div>
            <div style="display:flex;align-items:center;gap:14px;height:92px;padding:0 14px 0 20px;border-radius:14px;background:var(--overlay-1);box-shadow:inset 0 0 0 1px {v.s2.amtLine}">
              <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px">
                <div style="display:flex;align-items:baseline;gap:8px">{#if v.s2.inUsd}<span style="font:700 34px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink-3,#9A9AA8)">$</span>{/if}<input style="flex:1;min-width:0;border:0;outline:0;padding:0;background:transparent;font:700 34px/1 'Plus Jakarta Sans',sans-serif;letter-spacing:-.02em;color:var(--ink,#ECECF1);font-variant-numeric:tabular-nums" value={v.s2.amount} oninput={v.s2.onAmount} inputmode="decimal" placeholder="0" aria-label="Amount"></div>
                <span style="font:500 13px/1 'JetBrains Mono',monospace;color:{v.s2.amtNoteInk}">{t(v.s2.amtNote)}</span>
              </div>
              <span class="dc-p13" style="flex:none;display:flex;align-items:center;gap:7px;height:40px;padding:0 12px;border-radius:10px;background:var(--overlay-2);font:700 14px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink,#ECECF1);cursor:pointer;user-select:none" onclick={v.s2.toggleUnit} tabindex="0" aria-label="Switch between token and USD" role="button" title="Switch between token and USD">{t(v.s2.unitLabel)}<span style="width:13px;height:13px;background:var(--ink-3,#9A9AA8);mask:{v.m.swap}"></span></span>
            </div>
            <QuickAmountChips size="md" onSelect={v.s2.onChip}></QuickAmountChips>
          </div>
          {#if v.s2.msgCollapsed}<span class="dc-p14" style="align-self:flex-start;display:flex;align-items:center;gap:8px;height:36px;padding:0 12px 0 8px;margin-top:-8px;border-radius:10px;font:600 13.5px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink-2,#C9C9D4);cursor:pointer;user-select:none" onclick={v.s2.openMsg} tabindex="0" role="button"><span style="width:16px;height:16px;background:var(--ink-2,#C9C9D4);mask:{v.m.plus}"></span>Add a message</span>{/if}
          {#if v.s2.msgOpen}
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;align-items:center;gap:6px"><ListSectionLabel label="MESSAGE"></ListSectionLabel><span style="font:500 11.5px/1 'JetBrains Mono',monospace;color:var(--ink-5,#6E6E7C)">· OPTIONAL</span></div>
            <textarea style="resize:none;min-height:124px;padding:16px 18px;box-sizing:border-box;border:0;outline:0;border-radius:12px;background:var(--overlay-1);font:400 14px/1.5 'Plus Jakarta Sans',sans-serif;color:var(--ink,#ECECF1)" value={v.s2.message} oninput={v.s2.onMessage} placeholder={v.s2.msgPlaceholder} rows="5"></textarea>
          </div>
          {/if}
        </div>
        </div>
        <div style="flex:none;display:flex;flex-direction:column;border-top:1px solid var(--line-1);background:#121217">
          {#if v.s2.footOpen}
            <div style="display:flex;flex-direction:column;padding:6px 22px 0">
              {#each v.s2.rows ?? [] as r, i10}<DetailRow label={r.k} value={r.v} valueColor={r.ink} size="sm" rule="bottom"></DetailRow>{/each}
            </div>
          {/if}
          <div style="display:flex;align-items:center;gap:14px;min-height:80px;padding:0 22px">
            <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;cursor:pointer" onclick={v.s2.toggleFoot} tabindex="0" role="button"><span style="display:flex;align-items:center;gap:6px;font:700 15px/1.2 'JetBrains Mono',monospace;color:{v.s2.totalInk}">{t(v.s2.total)}<span style="width:12px;height:12px;background:var(--ink-3,#9A9AA8);mask:{v.m.caret};transform:{v.s2.footCaret}"></span></span><span style="font:400 12px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink-4,#8A8A99);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">To {t(v.s2.toMain)}</span></span>
            <span style="flex:none;display:flex;align-items:center;justify-content:center;min-width:160px;height:46px;padding:0 16px;border-radius:12px;background:{v.s2.ctaBg};font:700 14px/1 'Plus Jakarta Sans',sans-serif;color:{v.s2.ctaInk};cursor:{v.s2.ctaCursor};white-space:nowrap" onclick={v.s2.go} tabindex="0" role="button">{t(v.s2.ctaLabel)}</span>
          </div>
        </div>
      {/if}
      {#if v.s2.isPin}
        <DialogShell title="Enter your PIN" width={420} height="auto" flush={true} onClose={v.cancelPin}>
            <div style="display:flex;flex-direction:column;align-items:center;gap:22px;padding:28px 24px 24px">
              <span style="font:400 14px/1.5 'Plus Jakarta Sans',sans-serif;color:var(--ink-3,#9A9AA8);text-align:center;text-wrap:pretty">{t(v.s2.pinSub)}</span>
              <div style="display:flex;gap:10px">{#each v.s2.pinDots ?? [] as d, i11}<span style="width:44px;height:52px;border-radius:12px;background:var(--overlay-1,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px {d.ring};display:flex;align-items:center;justify-content:center"><span style="width:10px;height:10px;border-radius:50%;background:{d.fill}"></span></span>{/each}</div>
              <span style="align-self:stretch;display:flex;align-items:center;justify-content:center;height:46px;border-radius:12px;background:var(--accent,#FF5672);font:700 14px/1 'Plus Jakarta Sans',sans-serif;color:var(--on-accent,#2E0512);cursor:pointer;user-select:none" onclick={v.s2.fakePin} tabindex="0" role="button">{t(v.s2.pinCta)}</span>
            </div>
        </DialogShell>
      {/if}

      {#if v.s2.isDone}
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:32px;text-align:center">
          <span style="width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(46,230,168,.12)"><span style="width:28px;height:28px;background:var(--status-online);mask:{v.m.check}"></span></span>
          <span style="margin-top:6px;font:700 24px/1.25 'Plus Jakarta Sans',sans-serif;color:var(--ink,#ECECF1);max-width:480px;text-wrap:pretty">{t(v.s2.doneTitle)}</span>
          <span style="font:400 14px/1.5 'Plus Jakarta Sans',sans-serif;color:var(--ink-3,#9A9AA8)">{t(v.s2.doneSub)}</span>
          <span style="margin-top:10px;display:flex;align-items:center;justify-content:center;width:220px;height:46px;border-radius:12px;background:var(--overlay-2);font:600 14px/1 'Plus Jakarta Sans',sans-serif;color:var(--ink,#ECECF1);cursor:pointer" onclick={v.s2.reset} tabindex="0" role="button">{t(v.s2.backLabel)}</span>
        </div>
      {/if}
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2) !important}
  .dc-p1:hover{background:var(--overlay-2) !important}
  .dc-p2:hover{background:var(--overlay-2) !important}
  .dc-p3:hover{background:var(--overlay-2) !important}
  .dc-p4:hover{background:var(--overlay-2) !important}
  .dc-p5:hover{background:var(--btn-hover) !important}
  .dc-p6:hover{background:var(--overlay-1) !important}
  .dc-p7:hover{background:var(--overlay-1) !important}
  .dc-p8:hover{background:var(--overlay-2) !important}
  .dc-p9:hover{background:var(--overlay-2) !important}
  .dc-p10:hover{background:var(--overlay-2) !important}
  .dc-p11:hover{background:var(--overlay-2) !important}
  .dc-p12:hover{background:var(--overlay-2) !important}
  .dc-p13:hover{background:var(--btn-hover) !important}
  .dc-p14:hover{background:var(--overlay-1) !important}
</style>

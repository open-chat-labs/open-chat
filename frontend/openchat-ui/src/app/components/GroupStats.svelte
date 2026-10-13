<!-- Generated from lib/GroupStats.dc.html (source hash def7d7a1) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './GroupStats.logic.js';

  interface Props {
    mix?: {label:string,count:number,color?:string}[];
    weeks?: number[];
    people?: {name:string,count:number,gradient?:string}[];
    engagement?: {count:string,label:string}[];
    totalPrev?: number;
    otherPeople?: number;
    onlineMinutes?: number;
    onlineMinutesPrev?: number;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:100%;box-sizing:border-box;padding-inline:var(--space-10);display:flex;flex-direction:column;gap:var(--space-26)">

  <div style="display:flex;flex-direction:column;gap:var(--space-12);min-width:0">
    <div style="display:flex;align-items:flex-end;gap:var(--space-10);min-width:0">
      <span style="font:var(--weight-bold) 40px/1 var(--font-sans);letter-spacing:var(--tracking-tight);color:var(--ink,#ECECF1)">{t(v.totalLabel)}</span>
      <span style="padding-bottom:5px;font:var(--weight-medium) var(--text-sm)/1 var(--font-sans);color:var(--ink-3,#9A9AA8)">messages</span>
    </div>
    <div style="display:flex;align-items:center;gap:var(--space-8);min-width:0">
      <span style="display:flex;align-items:center;gap:5px;padding:4px var(--space-8);border-radius:var(--radius-pill);background:{v.deltaWash}">
        <span style="width:11px;height:11px;background:{v.deltaInk};mask:{v.deltaMask}"></span>
        <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:{v.deltaInk}">{t(v.deltaLabel)}</span>
      </span>
      <span style="font:var(--weight-regular) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-4,#7C7C8C)">vs previous 30 days</span>
    </div>
  </div>

  <div style="display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
    <div style="display:flex;align-items:flex-end;gap:3px;height:92px;min-width:0">
      {#each v.weeks ?? [] as w, i0}
        <div style="flex:1;min-width:0;height:{w.height};border-radius:3px;background:{w.fill}" title={w.title}></div>
      {/each}
    </div>
    <div style="display:flex;justify-content:space-between;min-width:0">
      <span style="font:var(--weight-medium) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-4,#7C7C8C)">12 WEEKS AGO</span>
      <span style="font:var(--weight-medium) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-3,#9A9AA8)">THIS WEEK</span>
    </div>
  </div>

  <div style="height:1px;background:var(--line-1,rgba(255,255,255,.07))"></div>

  <div style="display:flex;flex-direction:column;gap:var(--space-14);min-width:0">
    <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-3,#9A9AA8)">WHAT GETS SENT</span>
    <div style="display:flex;gap:2px;height:10px;min-width:0">
      {#each v.mix ?? [] as m, i1}
        <div style="width:{m.width};min-width:3px;border-radius:2px;background:{m.color}"></div>
      {/each}
    </div>
    <div style="display:flex;flex-direction:column;gap:var(--space-10);min-width:0">
      {#each v.mix ?? [] as m, i2}
        <div style="display:flex;align-items:center;gap:var(--space-10);min-width:0">
          <span style="flex:none;width:8px;height:8px;border-radius:var(--radius-pill);background:{m.color}"></span>
          <span style="flex:1;min-width:0;font:var(--weight-medium) var(--text-md)/1.3 var(--font-sans);color:var(--ink-2,#C9C9D4);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(m.label)}</span>
          <span style="flex:none;font:var(--weight-semibold) var(--text-md)/1.3 var(--font-sans);color:var(--ink,#ECECF1)">{t(m.count)}</span>
          <span style="flex:none;width:44px;text-align:end;font:var(--weight-medium) var(--text-sm)/1.3 var(--font-mono);color:var(--ink-4,#7C7C8C)">{t(m.pct)}</span>
        </div>
      {/each}
    </div>
  </div>

  <div style="height:1px;background:var(--line-1,rgba(255,255,255,.07))"></div>

  <div style="display:flex;flex-direction:column;gap:var(--space-14);min-width:0">
    <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-3,#9A9AA8)">WHO IS TALKING</span>
    <div style="display:flex;flex-direction:column;gap:var(--space-14);min-width:0">
      {#each v.people ?? [] as p, i3}
        <div style="display:flex;align-items:center;gap:var(--space-12);min-width:0">
          <span style="flex:none;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:var(--radius-circle,50%);background:{p.gradient};font:var(--weight-bold) var(--text-sm)/1 var(--font-sans);color:rgba(0,0,0,.6)">{t(p.initials)}</span>
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
            <div style="display:flex;align-items:baseline;gap:var(--space-8);min-width:0">
              <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-md)/1.2 var(--font-sans);color:var(--ink,#ECECF1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(p.name)}</span>
              <span style="flex:none;font:var(--weight-medium) var(--text-sm)/1 var(--font-mono);color:var(--ink-4,#7C7C8C)">{t(p.count)}</span>
            </div>
            <div style="height:4px;border-radius:var(--radius-pill);background:var(--overlay-1,rgba(255,255,255,.06))">
              <div style="width:{p.width};height:100%;border-radius:var(--radius-pill);background:var(--accent,#FF5672)"></div>
            </div>
          </div>
        </div>
      {/each}
    </div>
    <span style="font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.restLabel)}</span>
  </div>

  <div style="height:1px;background:var(--line-1,rgba(255,255,255,.07))"></div>

  <div style="display:flex;flex-direction:column;gap:var(--space-14);min-width:0">
    <span style="font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-3,#9A9AA8)">ENGAGEMENT</span>
    <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty"><span style="font-weight:var(--weight-semibold);color:{v.onlineInk}">{t(v.onlineNow)}</span> minutes of member activity this month, {t(v.onlineWord)} from <span style="font-weight:var(--weight-semibold);color:var(--ink-2,#C9C9D4)">{t(v.onlinePrev)}</span>.</span>
    <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:var(--space-16) var(--space-18);min-width:0;padding-top:var(--space-8)">
      {#each v.engagement ?? [] as e, i4}
        <div style="min-width:0;display:flex;flex-direction:column;gap:5px">
          <span style="font:var(--weight-bold) var(--text-xl)/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(e.count)}</span>
          <span style="font:var(--weight-regular) var(--text-sm)/1.2 var(--font-sans);color:var(--ink-4,#7C7C8C);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(e.label)}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

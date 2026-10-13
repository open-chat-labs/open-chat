<!-- Generated from lib/InfoPanel.dc.html (source hash e4f3dc4d) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './InfoPanel.logic.js';
  import Badge from '../../lib/components/Badge.svelte';
  import Button from '../../lib/components/Button.svelte';
  import DetailSection from '../../lib/components/DetailSection.svelte';
  import PanelCover from '../../lib/components/PanelCover.svelte';
  import TileButtons from '../../lib/components/TileButtons.svelte';
  import Toggle from '../../lib/components/Toggle.svelte';

  interface Props {
    kind?: string;
    title?: string;
    handle?: string;
    bylineName?: string;
    bylinePrefix?: string;
    verified?: boolean;
    online?: boolean;
    color?: string;
    cover?: string;
    tiles?: string[];
    details?: {label:string,value:string,variant?:string,dot?:boolean,highlight?:boolean,wide?:boolean}[];
    toggles?: {title:string,hint:string,on:boolean}[];
    showFooter?: boolean;
    footerLabel?: string;
    dangerLabel?: string;
    coverActions?: string[];
    coverHandlers?: Record<string,()=>void>;
    tileHandlers?: Record<string,()=>void>;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;background:var(--surface-1,#0e0e12);border-radius:var(--radius-2xl)">
  <div style="display:grid;grid-template-columns:minmax(0,1fr)"><PanelCover cover={v.cover} actions={v.coverActions} trailActions={v.coverTrailActions} handlers={v.coverHandlers}></PanelCover></div>

  <div style="padding:0 var(--space-14) var(--space-26);margin-top:-34px;display:flex;flex-direction:column;align-items:center;gap:var(--space-10)">
    <div style="position:relative;width:72px;height:72px;border-radius:{v.avatarRadius};background:{v.avatarGradient};box-shadow:0 0 0 4px var(--surface-1,#0e0e12)">
      {#if v.online}
        <span style="position:absolute;bottom:2px;inset-inline-end:2px;width:14px;height:14px;border-radius:var(--radius-pill);background:var(--status-online,#2EE6A8);border:3px solid var(--surface-1,#0e0e12)"></span>
      {/if}
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-8);max-width:100%">
      <div style="display:flex;align-items:center;gap:var(--space-6);max-width:100%">
        <span style="font:var(--weight-bold) var(--text-xl)/1.2 var(--font-sans);letter-spacing:var(--tracking-tight);color:var(--ink,#ECECF1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.title)}</span>
        {#if v.verified}
          <span style="flex:none;display:grid;grid-template-columns:max-content"><Badge variant="verified"></Badge></span>
        {/if}
      </div>
      {#if v.hasHandle}
        <span style="font:var(--weight-medium) var(--text-md)/1 var(--font-mono);color:var(--ink-3,#9A9AA8)">{t(v.handle)}</span>
      {/if}
      {#if v.hasByline}
        <span style="font:var(--weight-regular) var(--text-md)/1 var(--font-sans);color:var(--ink-3,#9A9AA8)">{t(v.bylinePrefix)} <a style="color:var(--accent,#FF5672)" href="#">{t(v.bylineName)}</a></span>
      {/if}
    </div>
    <div style="width:100%;margin-top:var(--space-26)">
      <div style="display:grid;grid-template-columns:minmax(0,1fr)"><TileButtons tiles={v.tiles} handlers={v.tileHandlers}></TileButtons></div>
    </div>
  </div>

  <div style="flex:1;min-width:0;min-height:0;overflow-y:auto;overflow-x:hidden;padding:0 var(--space-16) var(--space-16);display:flex;flex-direction:column;gap:var(--space-26)">
    <div style="min-width:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--space-6)">
      {#each v.details ?? [] as item, i0}
        <div style="grid-column:{item.span};min-width:0;display:grid;grid-template-columns:minmax(0,1fr)">
          <DetailSection label={item.label} value={item.value} variant={item.variant} dot={item.dot} highlight={item.highlight}></DetailSection>
        </div>
      {/each}
    </div>
    {#if v.hasToggles}
      <div style="min-width:0;display:flex;flex-direction:column;gap:var(--space-12);margin-top:-8px">
        <span style="padding-inline-start:var(--space-16);font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-3,#9A9AA8)">CHAT SETTINGS</span>
        <div style="min-width:0;display:flex;flex-direction:column;gap:var(--space-4)">
        {#each v.toggles ?? [] as row, i1}
          <div style="width:100%;min-width:0;box-sizing:border-box;display:flex;align-items:center;gap:var(--space-14);padding:var(--space-10) var(--space-16)">
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
              <span style="font:var(--weight-semibold) var(--text-base)/1 var(--font-sans);color:var(--ink,#E4E4EC)">{t(row.title)}</span>
              <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(row.hint)}</span>
            </div>
            <div style="flex:none;display:flex"><Toggle on={row.on} onChange={row.onChange}></Toggle></div>
          </div>
          {#if row.showDurations}
            <div style="--oc-trunk:var(--space-22);--oc-stub:var(--space-10);--oc-clear:var(--space-8);--oc-rise:var(--space-14);position:relative;display:flex;flex-direction:column;gap:var(--space-18);min-width:0;padding-top:var(--space-8)">
              <span style="position:absolute;inset-inline-start:var(--oc-trunk);top:calc(var(--oc-rise) * -1);width:var(--oc-stub);height:calc(var(--oc-rise) + var(--space-16));border-inline-start:1px solid var(--line-2,rgba(255,255,255,.14));border-block-end:1px solid var(--line-2,rgba(255,255,255,.14));border-end-start-radius:var(--radius-sm);pointer-events:none"></span>
              <div style="display:flex;flex-direction:column;gap:3px;padding-inline-start:calc(var(--oc-trunk) + var(--oc-stub) + var(--oc-clear));padding-inline-end:var(--space-16)">
                <span style="font:var(--weight-semibold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#E4E4EC)">Disappearing messages timeout</span>
                <span style="font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">How long a message survives before it is deleted for everyone.</span>
              </div>
              <div style="display:flex;flex-wrap:wrap;gap:var(--space-8) var(--space-6);padding-inline-start:calc(var(--oc-trunk) + var(--oc-stub) + var(--oc-clear));padding-inline-end:var(--space-16)">
                {#each row.durations ?? [] as d, i2}
                  <span style="padding:var(--space-8) var(--space-12);border-radius:var(--radius-sm);background:{d.wash};box-shadow:inset 0 0 0 1px {d.line};font:var(--weight-semibold) var(--text-sm)/1.3 var(--font-sans);color:{d.ink};cursor:pointer;user-select:none" onclick={d.onSelect} role="button" tabindex="0">{t(d.label)}</span>
                {/each}
              </div>
            </div>
          {/if}
        {/each}
        </div>
      </div>
    {/if}
  </div>

  {#if v.hasFooter}
    <div style="flex:none;padding:var(--space-12) var(--space-16) var(--space-16);display:flex;gap:var(--space-6)">
      {#if v.hasReport}
        <div style="flex:1;min-width:0;display:grid;grid-template-columns:minmax(0,1fr)"><Button fullWidth={true} variant="secondary" label={v.footerLabel}></Button></div>
      {/if}
      <div style="flex:1;min-width:0;display:grid;grid-template-columns:minmax(0,1fr)"><Button fullWidth={true} variant="danger" label={v.dangerLabel}></Button></div>
    </div>
  {/if}
</div>

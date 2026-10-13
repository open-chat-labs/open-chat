<!-- Generated from lib/ThreadList.dc.html (source hash 4e4977fb) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './ThreadList.logic.js';
  import IconButton from '../../lib/components/IconButton.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';

  interface Props {
    scopeLabel?: string;
    groups?: {name:string,grad:string,radius:string,threads:{author:string,grad:string,time:string,text:string,count:string,unread:number,followOnly:boolean,selected:boolean,onOpen:()=>void}[]}[];
    onBack?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden">
  <div style="flex:none;height:{v.headerH};margin:var(--space-10) var(--space-10) 0;box-sizing:border-box;display:flex;align-items:center;gap:var(--space-8);padding:0 var(--space-4) 0 0">
    <div style="flex:none;display:flex"><IconButton label="Back to chats" variant="ghost" icon="back" onClick={v.onBack}></IconButton></div>
    <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:var(--space-4)"><span style="font:var(--weight-bold) var(--text-lg)/1 var(--font-sans);color:var(--ink,#ECECF1)">Threads</span><span style="font:var(--weight-regular) var(--text-sm)/1 var(--font-sans);color:var(--ink-3,#9A9AA8);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.scopeLabel)}</span></span>
  </div>
  <div style="flex:none;padding:var(--space-10) var(--space-10) var(--space-4);display:grid;grid-template-columns:minmax(0,1fr)"><SegmentedTabs labels={v.filterTabs} counts={v.filterCounts} dotOnLast={false} selectedIndex={v.filterIndex} onSelect={v.onFilter}></SegmentedTabs></div>
  <div style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:var(--space-18);padding:var(--space-14) var(--space-10) var(--space-16)">
    {#each v.shown ?? [] as g, i0}
      <div style="display:flex;flex-direction:column;gap:var(--space-4)">
        <div style="display:flex;align-items:center;gap:var(--space-8);padding:0 var(--space-8) var(--space-4)">
          <span style="flex:none;width:18px;height:18px;border-radius:{g.radius};background:{g.grad}"></span>
          <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-xs)/1 var(--font-mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink-4,#8A8A99);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(g.name)}</span>
          <span style="flex:none;font:var(--weight-medium) var(--text-xs)/1 var(--font-mono);color:var(--ink-4,#8A8A99)">{t(g.count)}</span>
        </div>
        {#each g.threads ?? [] as th, i1}
          <div class="dc-p0" style="display:flex;gap:var(--space-10);padding:var(--space-10);border-radius:var(--radius-md);cursor:pointer;background:{th.bg}" onclick={th.onOpen} role="button" tabindex="0" aria-current={th.selected}>
            <span style="flex:none;width:28px;height:28px;border-radius:var(--radius-pill);background:{th.grad}"></span>
            <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
              <span style="display:flex;align-items:center;gap:var(--space-8)"><span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-md)/1.2 var(--font-sans);color:var(--ink,#ECECF1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(th.author)}</span><span style="flex:none;font:var(--weight-regular) var(--text-xs)/1 var(--font-sans);color:var(--ink-4,#8A8A99)">{t(th.time)}</span></span>
              <span style="font:var(--weight-regular) var(--text-sm)/1.45 var(--font-sans);color:var(--ink-2,#B9B9C6);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">{t(th.text)}</span>
              <span style="display:flex;align-items:center;gap:var(--space-8);font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--accent-bright,#FF8298)">{t(th.count)}{#if th.unread}<span style="display:flex;align-items:center;gap:5px;font-weight:var(--weight-medium);color:var(--ink-2,#C9C9D4)"><span style="width:6px;height:6px;border-radius:var(--radius-pill);background:var(--accent,#FF5672)"></span>{t(th.unreadLabel)}</span>{/if}{#if th.followOnly}<span style="font-weight:var(--weight-medium);color:var(--ink-4,#8A8A99)">· Following</span>{/if}</span>
            </span>
          </div>
        {/each}
      </div>
    {/each}
    {#if v.isEmpty}
      <span style="padding:var(--space-24) var(--space-12);font:var(--weight-regular) var(--text-md)/1.5 var(--font-sans);color:var(--ink-4,#8A8A99);text-align:center">{t(v.emptyLabel)}</span>
    {/if}
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
</style>

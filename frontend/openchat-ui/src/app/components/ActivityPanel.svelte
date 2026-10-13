<!-- Generated from lib/ActivityPanel.dc.html (source hash 937a1630) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './ActivityPanel.logic.js';
  import ActivityRow from '../../lib/components/ActivityRow.svelte';
  import EmptyState from '../../lib/components/EmptyState.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import Skeleton from '../../lib/components/Skeleton.svelte';

  interface Props {
    items?: {day:string,title:string,context:string,preview?:string,time:string,unread?:boolean,color?:string,kind?:string,reactions?:string[],type?:string,chat?:string}[] | null;
    onOpen?: (chat: string, item: object) => void;
    loading?: boolean;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:var(--space-10);padding:var(--space-10);overflow:hidden;background:var(--surface-1,#0e0e12)" data-screen-label="Activity">
  <div style="flex:none;display:flex;flex-direction:column;gap:var(--space-10)">
    <div style="display:flex;align-items:center;gap:var(--space-12);min-width:0;min-height:var(--control-md,34px);padding:var(--space-10) 0 var(--space-10) var(--space-10)">
      <span style="flex:1;min-width:0;font:var(--weight-bold) var(--text-xl)/1.2 var(--font-sans);letter-spacing:var(--tracking-tight);color:var(--ink,#ECECF1)">Activity</span>
      {#if v.hasUnread}
        <span class="dc-p0" style="flex:none;display:inline-flex;align-items:center;height:var(--control-md,34px);padding:0 var(--space-8);border-radius:var(--radius-sm);font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--accent,#FF5672);cursor:pointer;user-select:none" onclick={v.onMarkAll} role="button" tabindex="0">Mark all read</span>
      {/if}
    </div>
    <div style="display:grid;grid-template-columns:minmax(0,1fr)"><SegmentedTabs labels={v.tabLabels} counts={v.tabCounts} selectedIndex={v.tab} dotOnLast={false} onSelect={v.onTab}></SegmentedTabs></div>
  </div>

  <div style="flex:1;min-width:0;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:var(--space-4)">
    {#if v.loading}<Skeleton variant="activity" count={7}></Skeleton>{/if}
{#each v.loadedOr.feed ?? [] as row, i0}
      {#if row.isDay}
        <span style="padding:{row.topPad} var(--space-8) var(--space-6);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-3,#8A8A99)">{t(row.day)}</span>
      {/if}
      {#if row.isItem}
        <div style="display:grid;grid-template-columns:minmax(0,1fr)"><ActivityRow title={row.title} context={row.context} preview={row.preview} time={row.time} unread={row.unread} color={row.color} kind={row.kind} reactions={row.reactions} onClick={row.onPress}></ActivityRow></div>
      {/if}
    {/each}
    {#if v.isEmpty}
      <div style="flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr);align-content:center"><EmptyState preset="no-results" title={v.emptyTitle} body={v.emptyBody}></EmptyState></div>
    {/if}
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--accent-soft,rgba(255,86,114,.1)) !important}
</style>

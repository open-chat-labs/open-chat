<!-- Generated from lib/ChatListPanel.dc.html (source hash 1eb60abb) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './ChatListPanel.logic.js';
  import Badge from '../../lib/components/Badge.svelte';
  import ChatListHeader from './ChatListHeader.svelte';
  import ChatRow from '../../lib/components/ChatRow.svelte';
  import EmptyState from '../../lib/components/EmptyState.svelte';
  import Field from '../../lib/components/Field.svelte';
  import SegmentedTabs from '../../lib/components/SegmentedTabs.svelte';
  import Skeleton from '../../lib/components/Skeleton.svelte';

  interface Props {
    rows?: {title:string,preview:string,time:string,unreadCount?:number,color?:string,online?:boolean,verified?:boolean,selected?:boolean}[];
    showLabels?: boolean;
    headerKind?: string;
    headerTitle?: string;
    headerVisibility?: string;
    headerMembers?: number;
    headerColor?: string;
    onSelect?: (title: string) => void;
    searchPlaceholder?: string;
    showThreads?: boolean;
    threadCount?: number;
    threadsAction?: () => void;
    showTabs?: boolean;
    selectedFilter?: number;
    filterLabels?: string[];
    emptyPreset?: string;
    loading?: boolean;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width:100%;height:100%;box-sizing:border-box;display:flex;flex-direction:column;gap:var(--space-10);padding:var(--space-10);background:var(--surface-1,#0e0e12)">
  {#if v.showHeader}
    <div style="display:grid;grid-template-columns:minmax(0,1fr)"><ChatListHeader onCreateGroup={v.onCreateGroup} kind={v.headerKind} title={v.headerTitle} visibility={v.headerVisibility} memberCount={v.headerMembers} color={v.headerColor} onCreated={v.onGroupCreated} isDiamond={v.isDiamond} onMenu={v.onHeaderMenu} menuItems={v.headerMenuItems} openDetails={v.onHeaderDetails}></ChatListHeader></div>
  {/if}
  <div style="display:grid;grid-template-columns:minmax(0,1fr)"><Field placeholder={v.searchPlaceholder} value={v.query} onInput={v.onQuery} onClear={v.clearQuery}></Field></div>
  {#if v.showTabs}
    <div style="display:grid;grid-template-columns:minmax(0,1fr)"><SegmentedTabs labels={v.filterLabels} selectedIndex={v.filterIndex} dotIndexes={v.filterDots} onSelect={v.onFilter}></SegmentedTabs></div>
  {/if}
  {#if v.showThreads}
    <div class="dc-p0" style="display:flex;align-items:center;gap:var(--space-12);height:var(--control-xl,44px);box-sizing:border-box;padding:0 var(--space-12);border-radius:var(--radius-lg);cursor:pointer" onclick={v.threadsAction} role="button" tabindex="0">
      <span style="flex:none;width:42px;display:flex;align-items:center;justify-content:center">
        <span style="width:19px;height:19px;background:var(--ink-3,#8A8A99);mask:{v.threadsMask}"></span>
      </span>
      <span style="flex:1;min-width:0;font:var(--weight-semibold) var(--text-md)/1 var(--font-sans);color:var(--ink-3,#8A8A99)">Thread replies</span>
      {#if v.hasThreadCount}
        <span style="flex:none;display:grid;grid-template-columns:max-content"><Badge label={v.threadCount} variant="count"></Badge></span>
      {/if}
    </div>
  {/if}
  {#if v.hasRows}
    <div style="flex:1;min-height:0;display:flex;flex-direction:column;gap:var(--space-4);overflow-y:auto">
      {#if v.loading}<Skeleton variant="chat" count={7}></Skeleton>{/if}
{#each v.loadedOr.groups ?? [] as group, i0}
        <div style="display:flex;flex-direction:column;gap:var(--space-4);padding-top:{group.spacer}">
          {#if group.hasLabel}
            <div style="padding:0 var(--space-8) var(--space-6);font:var(--weight-semibold) var(--text-sm)/1 var(--font-mono);letter-spacing:var(--tracking-wide);color:var(--ink-3,#8A8A99)">{t(group.label)} <span style="color:var(--ink-4,#6E6E7C)">{t(group.count)}</span></div>
          {/if}
          {#each group.rows ?? [] as row, i1}
            <div style="display:grid;grid-template-columns:minmax(0,1fr)"><ChatRow liveCall={row.liveCall} muted={row.muted} fav={row.fav} title={row.title} kind={row.kind} preview={row.preview} time={row.time} unreadCount={row.unreadCount} color={row.color} online={row.online} verified={row.verified} pinned={row.pinned} selected={row.selected} onClick={row.onSelect} menuItems={row.menu}></ChatRow></div>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
  {#if v.isEmpty}
    <div style="flex:1;min-height:0;display:flex;padding-top:44px;width:100%;box-sizing:border-box">
      <div style="width:100%"><EmptyState preset={v.emptyPreset}></EmptyState></div>
    </div>
  {/if}
</div>

<style>
  .dc-p0:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
</style>

<!-- Generated from lib/ActivityRow.dc.html (source hash ada8248e) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './ActivityRow.logic.js';
  import Avatar from './Avatar.svelte';

  interface Props {
    title?: string;
    context?: string;
    preview?: string;
    time?: string;
    unread?: boolean;
    color?: string;
    kind?: string;
    reactions?: string[];
    onClick?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div class="dc-p0" style="width:100%;box-sizing:border-box;display:flex;gap:var(--space-10);padding:var(--space-10) var(--space-8);border-radius:var(--radius-md);background:{v.rowBg};cursor:pointer;" onclick={v.onPress} role="button" tabindex="0">
  <div style="flex:none;display:flex"><Avatar size={36} shape={v.avatarShape} color={v.color} online={false}></Avatar></div>
  <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
    <span style="font:var(--weight-semibold) var(--text-md)/1.3 var(--font-sans);color:var(--ink,#ECECF1);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">{t(v.title)}</span>
    <span style="font:var(--weight-medium) var(--text-sm)/1.3 var(--font-sans);color:var(--accent,#FF5672);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.context)}</span>
    {#if v.hasPreview}
      <span style="font:var(--weight-regular) var(--text-sm)/1.4 var(--font-sans);color:var(--ink-3,#8A8A99);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.preview)}</span>
    {/if}
    {#if v.hasReactions}
      <div style="display:flex;gap:var(--space-4);padding-block-start:var(--space-6)">
        {#each (v.reactions ?? []) as r, r_i}
          <span style="display:flex;align-items:center;justify-content:center;min-width:24px;height:24px;padding:0 var(--space-6);box-sizing:border-box;border-radius:var(--radius-pill);background:var(--overlay-2,rgba(255,255,255,.09));font:var(--weight-semibold) var(--text-sm)/1 var(--font-sans);color:var(--ink-2,#C9C9D4)">{t(r)}</span>
        {/each}
      </div>
    {/if}
  </div>
  <div style="flex:none;display:flex;flex-direction:column;align-items:flex-end;gap:var(--space-8)">
    <span style="font:var(--weight-regular) var(--text-xs)/1 var(--font-mono);color:var(--ink-4,#6E6E7C);white-space:nowrap">{t(v.time)}</span>
    {#if v.unread}
      <span style="width:8px;height:8px;border-radius:var(--radius-pill);background:var(--accent,#FF5672)" title="Unread"></span>
    {/if}
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-1,rgba(255,255,255,.06)) !important}
</style>

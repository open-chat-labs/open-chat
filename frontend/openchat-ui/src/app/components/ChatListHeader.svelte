<!-- Generated from lib/ChatListHeader.dc.html (source hash aa5b1850) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './ChatListHeader.logic.js';
  import Avatar from '../../lib/components/Avatar.svelte';
  import IconButton from '../../lib/components/IconButton.svelte';
  import Menu from '../../lib/components/Menu.svelte';

  interface Props {
    kind?: string;
    title?: string;
    visibility?: string;
    memberCount?: number;
    meta?: string;
    color?: string;
    menuItems?: {label:string,variant?:string,mask?:string}[];
    openDetails?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="width: 100%; box-sizing: border-box; display: flex; align-items: center; gap: var(--space-12); padding: var(--space-10) 0 var(--space-10) var(--space-10); background: var(--surface-1,#0e0e12)">
  {#if v.isPlain}
    <span style="flex:1;min-width:0;font:var(--weight-bold) var(--text-xl)/1.2 var(--font-sans);letter-spacing:var(--tracking-tight);color:var(--ink,#ECECF1)">{t(v.title)}</span>
  {/if}
  {#if v.isCommunity}
    <div class="dc-p0" style="flex:1;min-width:0;display:flex;align-items:center;gap:var(--space-10);padding:var(--space-6);margin:calc(var(--space-6) * -1);border-radius:var(--radius-md);cursor:pointer" onclick={v.openDetails} role="button" tabindex="0">
      <div style="flex:none;display:flex"><Avatar size={38} shape="squircle" color={v.color} online={false}></Avatar></div>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
        <span style="font:var(--weight-bold) var(--text-base)/1.2 var(--font-sans);color:var(--ink,#ECECF1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.title)}</span>
        <div style="display:flex;align-items:center;gap:var(--space-6);min-width:0">
          <span style="flex:none;width:13px;height:13px;background:{v.lockColor};mask:{v.lockMask}"></span>
          <span style="font:var(--weight-regular) var(--text-sm)/1.2 var(--font-sans);color:var(--ink-3,#8A8A99);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.meta)}</span>
        </div>
      </div>
    </div>
  {/if}
  <div style="flex:none;position:relative;display:flex" use:ref={v.menuRef}>
    <div style="flex:none;display:inline-flex" onclick={v.toggleMenu}>
      <IconButton variant="ghost" pressed={v.menuOpen} icon="more"></IconButton>
    </div>
    {#if v.menuOpen}
      <div style="position:absolute;top:calc(100% + 6px);inset-inline-end:0;z-index:var(--z-modal,60)">
        <Menu items={v.menuItems} minWidth={v.menuWidth}></Menu>
      </div>
    {/if}
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important}
</style>

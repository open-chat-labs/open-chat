<!-- Generated from lib/DailyPuzzleCard.dc.html (source hash 022361e6) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './DailyPuzzleCard.logic.js';

  interface Props {
    state?: 'new' | 'progress' | 'solved' | 'hidden' | 'off';
    sub?: string;
    countdown?: string;
    remind?: boolean;
    onAction?: (key: string) => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:flex;flex-direction:column">
{#if v.pzCard}
          <div style="position:relative;flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-12) var(--space-12) var(--space-12) var(--space-14);border-radius:var(--radius-lg);background:var(--overlay-1,rgba(255,255,255,.045));box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12))">
            <span style="position:relative;flex:none;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:var(--radius-md);background:{v.pzTileBg}"><span style="width:18px;height:18px;background:{v.pzTileInk};mask:{v.pzMask}"></span>{#if v.pzRemind}<span style="position:absolute;inset-inline-end:-5px;bottom:-5px;width:17px;height:17px;border-radius:50%;background:var(--accent,#FF5672);box-shadow:0 0 0 2px var(--surface-1,#0e0e12);display:flex;align-items:center;justify-content:center" title="Daily reminder on" aria-label="Daily reminder on"><span style="width:10px;height:10px;background:var(--on-accent,#2E0512);mask:var(--icon-bell) center/contain no-repeat"></span></span>{/if}</span>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
              <span style="font:var(--weight-semibold) var(--text-md)/1.25 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.pzTitle)}</span>
              <span style="font:var(--weight-regular) var(--text-sm)/1.35 var(--font-sans);color:var(--ink-4,#7C7C8C);text-wrap:pretty">{t(v.pzSub)}</span>
            </div>
            <span class="dc-p0" style="flex:none;display:flex;align-items:center;height:36px;padding:0 var(--space-14);border-radius:var(--radius-md);background:{v.pzBtnBg};color:{v.pzBtnInk};font:var(--weight-bold) var(--text-sm)/1 var(--font-sans);cursor:pointer" onclick={v.onPuzzle} role="button" tabindex="0">{t(v.pzBtn)}</span>
            <span class="dc-p1" style="flex:none;width:30px;height:30px;border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;cursor:pointer;background:{v.pzMenuBtnBg}" onclick={v.togglePzMenu} role="button" tabindex="0" title="Puzzle options" aria-label="Puzzle options" aria-expanded={v.pzMenuOpenStr}><span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:var(--icon-more) center/contain no-repeat"></span></span>
            {#if v.pzMenuOpen}
              <div style="position:absolute;z-index:3;inset-inline-end:8px;bottom:calc(100% - 6px);width:230px;padding:6px;border-radius:var(--radius-md);background:var(--surface-3,#24242e);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.12)),0 12px 30px rgba(0,0,0,.45);display:flex;flex-direction:column;gap:2px" role="menu">
                {#each v.pzMenu ?? [] as m, i0}<span class="dc-p2" style="display:flex;align-items:center;gap:10px;height:36px;padding:0 10px;border-radius:var(--radius-sm);font:var(--weight-medium) var(--text-sm)/1 var(--font-sans);color:var(--ink,#ECECF1);cursor:pointer" onclick={m.press} role="menuitem" tabindex="0"><span style="flex:none;width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{m.mask}"></span><span style="flex:1">{t(m.label)}</span>{#if m.on}<span style="width:14px;height:14px;background:var(--accent,#FF5672);mask:var(--icon-check) center/contain no-repeat"></span>{/if}</span>{/each}
              </div>
            {/if}
          </div>
        {/if}
        {#if v.pzHidden}
          <div style="flex:none;display:flex;align-items:center;gap:10px;min-height:40px;padding:0 var(--space-12);border-radius:var(--radius-md);box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07));font:var(--weight-medium) var(--text-sm)/1.3 var(--font-sans);color:var(--ink-3,#9A9AA8)" role="status"><span style="flex:none;width:14px;height:14px;background:currentColor;mask:var(--icon-eye-off) center/contain no-repeat"></span><span style="flex:1">Daily puzzle hidden. Bring it back in Profile → CHIT.</span><span style="font-weight:var(--weight-bold);color:var(--accent-bright,#FF8298);cursor:pointer;padding:8px 4px" onclick={v.unhidePuzzle} role="button" tabindex="0">Undo</span></div>
        {/if}
</div>

<style>
  .dc-p0:hover{filter:brightness(1.1) !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p2:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
</style>

<!-- Generated from lib/PuzzleDialog.dc.html (source hash f417539c) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './PuzzleDialog.logic.js';

  interface Props {
    tutorialSeen?: boolean;
    solved?: boolean;
    remind?: boolean;
    asked?: boolean;
    puzzleStreak?: number;
    balance?: number;
    countdown?: string;
    saved?: { br: Record<string, number>; elapsed: number; hints: number };
    solvedTime?: number;
    solvedHints?: number;
    onProgress?: (p: { br: Record<string, number>; elapsed: number; hints: number; done: number; total: number }) => void;
    onSolved?: (r: { elapsed: number; hints: number }) => void;
    onHint?: (cost: number) => void;
    onRemind?: (on: boolean) => void;
    onTutorialDone?: () => void;
    onShare?: () => void;
    onClose?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:fixed;inset:0;z-index:74;display:flex;align-items:center;justify-content:center;padding:var(--space-22,22px)" data-screen-label="Daily puzzle" role="dialog" aria-modal="true" aria-label="The Daily puzzle">
  <div style="position:absolute;inset:0;background:var(--oc-veil,rgba(3,3,6,.72));backdrop-filter:var(--oc-veil-blur,blur(4px));-webkit-backdrop-filter:var(--oc-veil-blur,blur(4px));animation:{v.veilAnim}" onclick={v.onClose} aria-hidden="true"></div>
  <div style="position:relative;display:flex;flex-direction:column;gap:var(--space-16,16px);width:100%;max-width:{v.cardMax};max-height:100%;overflow-y:auto;box-sizing:border-box;padding:var(--space-18,18px) var(--space-20,20px) var(--space-20,20px);border-radius:var(--radius-xl,24px);background:var(--surface-1,#101015);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),0 24px 60px rgba(0,0,0,.5);color:var(--ink,#ECECF1);animation:{v.cardAnim}">

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-10,10px)">
      <span style="flex:none;width:36px;height:36px;border-radius:var(--radius-md,12px);background:var(--accent-soft,rgba(255,86,114,.16));display:flex;align-items:center;justify-content:center"><span style="width:18px;height:18px;background:var(--accent-bright,#FF8298);mask:var(--icon-joystick) center/contain no-repeat"></span></span>
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px"><span style="font:var(--weight-bold,700) var(--text-lg,16px)/1.1 var(--font-sans);letter-spacing:-.01em">{t(v.headTitle)}</span><span style="font:var(--weight-medium,500) var(--text-sm,12.5px)/1 var(--font-sans);color:var(--ink-3,#A3A3B2)">{t(v.headSub)}</span></span>
      {#if v.isTutorial}
        <span class="dc-p0" style="flex:none;display:flex;align-items:center;height:32px;padding:0 var(--space-10,10px);border-radius:var(--radius-sm,8px);font:var(--weight-semibold,600) var(--text-sm,13px)/1 var(--font-sans);color:var(--ink-3,#A3A3B2);cursor:pointer" onclick={v.skipTutorial} role="button" tabindex="0">{t(v.skipLabel)}</span>
      {/if}
      {#if v.isPlay}
        <span class="dc-p1" style="flex:none;width:32px;height:32px;border-radius:var(--radius-sm,8px);display:flex;align-items:center;justify-content:center;cursor:pointer" onclick={v.openTutorial} role="button" tabindex="0" title="How to play" aria-label="How to play"><span style="width:16px;height:16px;background:var(--ink-3,#A3A3B2);mask:var(--icon-info) center/contain no-repeat"></span></span>
      {/if}
      <span class="dc-p2" style="flex:none;width:32px;height:32px;border-radius:var(--radius-sm,8px);display:flex;align-items:center;justify-content:center;cursor:pointer" onclick={v.onClose} role="button" tabindex="0" title="Close" aria-label="Close"><span style="width:15px;height:15px;background:var(--ink-3,#A3A3B2);mask:var(--icon-close) center/contain no-repeat"></span></span>
    </div>

    {#if v.isTutorial}
      <div style="display:flex;flex-direction:column;gap:var(--space-16,16px)">
        <div style="position:relative;width:100%;max-width:420px;align-self:center;aspect-ratio:1;container-type:inline-size;border-radius:var(--radius-lg,18px);background:var(--surface-2,#191921) radial-gradient(circle,var(--line-2,rgba(255,255,255,.12)) 1.2px,transparent 1.8px) 0 0/{v.tb.cell} {v.tb.cell};box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07));user-select:none">
          {#each v.tb.bridges ?? [] as b, i0}<span style="position:absolute;left:{b.l};top:{b.t};width:{b.w};height:{b.h};display:flex;flex-direction:{b.dir};align-items:center;justify-content:center;gap:4px;cursor:pointer" onclick={b.remove} title="Remove bridge">{#each b.lines ?? [] as ln, i1}<span style="flex:none;width:{ln.w};height:{ln.h};border-radius:2px;background:{b.ink}"></span>{/each}</span>{/each}
          {#each v.tb.islands ?? [] as n, i2}<button style="position:absolute;left:{n.l};top:{n.t};width:{n.d};aspect-ratio:1;border:0;padding:0;border-radius:50%;display:flex;align-items:center;justify-content:center;background:{n.bg};box-shadow:{n.ring};color:{n.ink};font:var(--weight-bold,700) {v.tb.fs}/1 var(--font-sans);cursor:pointer;transform:{n.scale};transition:background 160ms var(--ease-out),box-shadow 160ms var(--ease-out),transform 160ms var(--ease-out)" onclick={n.press} aria-label={n.aria}>{t(n.n)}</button>{/each}
          {#if v.tb.solved}<span style="position:absolute;left:50%;bottom:14px;transform:translateX(-50%);display:flex;align-items:center;gap:6px;height:32px;padding:0 14px;border-radius:var(--radius-pill,999px);background:var(--status-online,#2EE6A8);color:#062a1d;font:var(--weight-bold,700) var(--text-sm,13px)/1 var(--font-sans);white-space:nowrap"><span style="width:14px;height:14px;background:currentColor;mask:var(--icon-check) center/contain no-repeat"></span>Nice, that's it</span>{/if}
          {#if v.tb.hasErr}<span style="position:absolute;left:50%;bottom:14px;transform:translateX(-50%);height:32px;display:flex;align-items:center;padding:0 14px;border-radius:var(--radius-pill,999px);background:var(--status-danger,#FF4D4D);color:#fff;font:var(--weight-semibold,600) var(--text-sm,13px)/1 var(--font-sans);white-space:nowrap;animation:oc-pz-shake 240ms var(--ease-out)" role="status">{t(v.tb.err)}</span>{/if}
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;min-height:64px">
          <span style="font:var(--weight-bold,700) var(--text-md,14px)/1.2 var(--font-sans)">{t(v.stepTitle)}</span>
          <span style="font:var(--weight-regular,400) var(--text-sm,13px)/1.5 var(--font-sans);color:var(--ink-2,#C9C9D4);text-wrap:pretty">{t(v.stepBody)}</span>
        </div>
        <div style="display:flex;align-items:center;gap:var(--space-10,10px)">
          <span style="flex:1;display:flex;gap:6px" aria-hidden="true">{#each v.stepDots ?? [] as d, i3}<span style="width:{d.w};height:6px;border-radius:3px;background:{d.bg};transition:width 200ms var(--ease-out),background 200ms"></span>{/each}</span>
          {#if v.hasStepBack}<span class="dc-p3" style="display:flex;align-items:center;height:42px;padding:0 var(--space-14,14px);border-radius:var(--radius-md,12px);background:var(--overlay-2,rgba(255,255,255,.08));font:var(--weight-semibold,600) var(--text-sm,13px)/1 var(--font-sans);cursor:pointer" onclick={v.stepBack} role="button" tabindex="0">Back</span>{/if}
          <span class="dc-p4" style="display:flex;align-items:center;height:42px;padding:0 var(--space-18,18px);border-radius:var(--radius-md,12px);background:var(--accent,#FF5672);color:var(--on-accent,#2E0512);font:var(--weight-bold,700) var(--text-sm,13px)/1 var(--font-sans);cursor:pointer" onclick={v.stepNext} role="button" tabindex="0">{t(v.stepNextLabel)}</span>
        </div>
      </div>
    {/if}

    {#if v.isPlay}
      <div style="display:flex;flex-direction:column;gap:var(--space-14,14px)">
        <div style="display:flex;gap:8px">
          {#each v.stats ?? [] as s, i4}<span style="flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:7px;height:34px;border-radius:var(--radius-md,12px);background:var(--surface-2,#191921);font:var(--weight-semibold,600) var(--text-sm,13px)/1 var(--font-sans);color:{s.ink}" title={s.label}><span style="flex:none;width:14px;height:14px;background:currentColor;mask:{s.mask}"></span><span style="font-family:{s.font};white-space:nowrap">{t(s.value)}</span></span>{/each}
        </div>
        <div style="display:grid;grid-template-columns:{v.playCols};gap:var(--space-20,20px);align-items:stretch">
          <div style="position:relative;width:100%;aspect-ratio:1;container-type:inline-size;border-radius:var(--radius-lg,18px);background:var(--surface-2,#191921) radial-gradient(circle,var(--line-2,rgba(255,255,255,.12)) 1.2px,transparent 1.8px) 0 0/{v.pb.cell} {v.pb.cell};box-shadow:inset 0 0 0 1px var(--line-1,rgba(255,255,255,.07));user-select:none">
            {#each v.pb.bridges ?? [] as b, i5}<span style="position:absolute;left:{b.l};top:{b.t};width:{b.w};height:{b.h};display:flex;flex-direction:{b.dir};align-items:center;justify-content:center;gap:4px;cursor:pointer" onclick={b.remove} title="Remove bridge">{#each b.lines ?? [] as ln, i6}<span style="flex:none;width:{ln.w};height:{ln.h};border-radius:2px;background:{b.ink}"></span>{/each}</span>{/each}
            {#each v.pb.islands ?? [] as n, i7}<button style="position:absolute;left:{n.l};top:{n.t};width:{n.d};aspect-ratio:1;border:0;padding:0;border-radius:50%;display:flex;align-items:center;justify-content:center;background:{n.bg};box-shadow:{n.ring};color:{n.ink};font:var(--weight-bold,700) {v.pb.fs}/1 var(--font-sans);cursor:pointer;transform:{n.scale};transition:background 160ms var(--ease-out),box-shadow 160ms var(--ease-out),transform 160ms var(--ease-out)" onclick={n.press} aria-label={n.aria}>{t(n.n)}</button>{/each}
            {#if v.pb.hasErr}<span style="position:absolute;left:50%;bottom:14px;transform:translateX(-50%);height:32px;display:flex;align-items:center;padding:0 14px;border-radius:var(--radius-pill,999px);background:var(--status-danger,#FF4D4D);color:#fff;font:var(--weight-semibold,600) var(--text-sm,13px)/1 var(--font-sans);white-space:nowrap;animation:oc-pz-shake 240ms var(--ease-out)" role="status">{t(v.pb.err)}</span>{/if}
          </div>
          <div style="display:flex;flex-direction:column;gap:var(--space-14,14px);min-width:0">
            <div style="display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:var(--radius-md,14px);background:var(--surface-2,#191921)">
              <span style="display:flex;justify-content:space-between;font:var(--weight-semibold,600) var(--text-sm,12.5px)/1 var(--font-sans)"><span>Islands complete</span><span style="font-family:var(--font-mono);color:var(--ink-2,#C9C9D4)">{t(v.doneText)}</span></span>
              <span style="height:6px;border-radius:3px;background:var(--overlay-2,rgba(255,255,255,.08));overflow:hidden"><span style="display:block;height:100%;width:{v.donePct};border-radius:3px;background:var(--accent,#FF5672);transition:width 240ms var(--ease-out)"></span></span>
            </div>
            {#if v.wide}
              <div style="display:flex;flex-direction:column;gap:9px;font:var(--weight-regular,400) var(--text-sm,13px)/1.5 var(--font-sans);color:var(--ink-2,#C9C9D4)">
                <span style="font:var(--weight-semibold,600) var(--text-xs,12px)/1 var(--font-sans);color:var(--ink-3,#A3A3B2)">Rules</span>
                {#each v.rules ?? [] as r, i8}<span style="display:flex;gap:8px;text-wrap:pretty"><span style="flex:none;width:18px;height:18px;margin-top:1px;border-radius:50%;background:var(--overlay-2,rgba(255,255,255,.08));display:flex;align-items:center;justify-content:center;font:var(--weight-bold,700) 10.5px/1 var(--font-mono)">{t(r.n)}</span>{t(r.t)}</span>{/each}
              </div>
              <span style="flex:1"></span>
            {/if}
            <div style="display:flex;gap:8px">
              <span class="dc-p5" style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px;height:42px;border-radius:var(--radius-md,12px);background:var(--overlay-2,rgba(255,255,255,.08));font:var(--weight-semibold,600) var(--text-sm,13px)/1 var(--font-sans);cursor:pointer;opacity:{v.undoOpacity}" onclick={v.undo} role="button" tabindex="0" aria-disabled={v.undoDisabled}><span style="width:15px;height:15px;background:currentColor;mask:var(--icon-rotate-back) center/contain no-repeat"></span>Undo</span>
              <span class="dc-p6" style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px;height:42px;border-radius:var(--radius-md,12px);background:var(--overlay-2,rgba(255,255,255,.08));font:var(--weight-semibold,600) var(--text-sm,13px)/1 var(--font-sans);cursor:pointer;opacity:{v.undoOpacity}" onclick={v.reset} role="button" tabindex="0"><span style="width:15px;height:15px;background:currentColor;mask:var(--icon-refresh) center/contain no-repeat"></span>Reset</span>
            </div>
            <span class="dc-p7" style="display:flex;align-items:center;justify-content:center;gap:8px;height:44px;border-radius:var(--radius-md,12px);background:color-mix(in oklch,var(--status-chit,#FF9F45) 16%,var(--surface-2,#191921));box-shadow:inset 0 0 0 1px color-mix(in oklch,var(--status-chit,#FF9F45) 35%,transparent);font:var(--weight-semibold,600) var(--text-sm,13.5px)/1 var(--font-sans);cursor:pointer;opacity:{v.hintOpacity}" onclick={v.hint} role="button" tabindex="0" aria-disabled={v.hintDisabled}><span style="width:15px;height:15px;background:var(--status-chit,#FF9F45);mask:var(--icon-spark) center/contain no-repeat"></span>Use a hint<span style="font:var(--weight-medium,500) var(--text-xs,12px)/1 var(--font-mono);color:var(--ink-2,#C9C9D4)">{t(v.hintMeta)}</span></span>
          </div>
        </div>
      </div>
    {/if}

    {#if v.isSolved}
      <div style="display:flex;flex-direction:column;align-items:center;gap:var(--space-16,16px);text-align:center;padding-top:var(--space-6,6px)">
        <span style="width:64px;height:64px;border-radius:20px;background:var(--accent-soft,rgba(255,86,114,.18));display:flex;align-items:center;justify-content:center;animation:oc-pz-pop 420ms var(--ease-out) both"><span style="width:30px;height:30px;background:var(--accent-bright,#FF8298);mask:var(--icon-trophy) center/contain no-repeat"></span></span>
        <span style="display:flex;flex-direction:column;gap:6px"><span style="font:var(--weight-bold,700) 22px/1.1 var(--font-sans);letter-spacing:-.01em">{t(v.solvedTitle)}</span><span style="font:var(--weight-medium,500) var(--text-sm,13px)/1 var(--font-sans);color:var(--ink-3,#A3A3B2)">The Daily #20734 · Bridges · Easy</span></span>
        <div style="width:100%;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
          {#each v.result ?? [] as s, i9}<span style="display:flex;flex-direction:column;gap:6px;padding:12px 8px;border-radius:var(--radius-md,12px);background:var(--surface-2,#191921)"><span style="font:var(--weight-bold,700) 17px/1 var(--font-mono);color:{s.ink}">{t(s.value)}</span><span style="font:var(--weight-medium,500) var(--text-xs,11.5px)/1 var(--font-sans);color:var(--ink-3,#A3A3B2)">{t(s.label)}</span></span>{/each}
        </div>
        {#if v.askRemind}
          <div style="width:100%;box-sizing:border-box;display:flex;align-items:center;flex-wrap:wrap;gap:var(--space-12,12px);padding:12px;border-radius:var(--radius-lg,16px);background:var(--surface-2,#191921);box-shadow:inset 0 0 0 1px color-mix(in oklch,var(--accent,#FF5672) 35%,transparent);text-align:start">
            <span style="flex:none;width:36px;height:36px;border-radius:50%;background:var(--overlay-2,rgba(255,255,255,.08));display:flex;align-items:center;justify-content:center"><span style="width:17px;height:17px;background:var(--ink,#ECECF1);mask:var(--icon-bell) center/contain no-repeat"></span></span>
            <span style="flex:1;min-width:160px;display:flex;flex-direction:column;gap:4px"><span style="font:var(--weight-semibold,600) var(--text-md,13.5px)/1.2 var(--font-sans)">Remind me each day?</span><span style="font:var(--weight-medium,500) var(--text-xs,12px)/1.35 var(--font-sans);color:var(--ink-3,#A3A3B2)">A dot on CHIT when a new puzzle is out. Change it anytime.</span></span>
            <span style="flex:none;display:flex;gap:4px">
              <span class="dc-p8" style="display:flex;align-items:center;height:34px;padding:0 12px;border-radius:var(--radius-sm,10px);font:var(--weight-semibold,600) var(--text-sm,12.5px)/1 var(--font-sans);color:var(--ink-2,#C9C9D4);cursor:pointer" onclick={v.remindNo} role="button" tabindex="0">Not now</span>
              <span class="dc-p9" style="display:flex;align-items:center;height:34px;padding:0 14px;border-radius:var(--radius-sm,10px);background:var(--accent,#FF5672);color:var(--on-accent,#2E0512);font:var(--weight-bold,700) var(--text-sm,12.5px)/1 var(--font-sans);cursor:pointer" onclick={v.remindYes} role="button" tabindex="0">Yes</span>
            </span>
          </div>
        {/if}
        {#if v.remindNote}
          <span style="display:flex;align-items:center;gap:7px;font:var(--weight-medium,500) var(--text-sm,12.5px)/1.3 var(--font-sans);color:var(--ink-3,#A3A3B2)" role="status"><span style="width:14px;height:14px;background:{v.remindNoteInk};mask:{v.remindNoteMask}"></span>{t(v.remindNote)}</span>
        {/if}
        <div style="width:100%;display:flex;gap:8px">
          <span class="dc-p10" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;height:44px;border-radius:var(--radius-md,12px);background:var(--overlay-2,rgba(255,255,255,.08));font:var(--weight-semibold,600) var(--text-sm,13.5px)/1 var(--font-sans);cursor:pointer" onclick={v.share} role="button" tabindex="0"><span style="width:15px;height:15px;background:currentColor;mask:var(--icon-share) center/contain no-repeat"></span>Share to chat</span>
          <span class="dc-p11" style="flex:1;display:flex;align-items:center;justify-content:center;height:44px;border-radius:var(--radius-md,12px);background:var(--overlay-2,rgba(255,255,255,.08));font:var(--weight-semibold,600) var(--text-sm,13.5px)/1 var(--font-sans);cursor:pointer" onclick={v.onClose} role="button" tabindex="0">Done</span>
        </div>
        <span style="font:var(--weight-medium,500) var(--text-xs,12px)/1 var(--font-mono);color:var(--ink-4,#8A8A99)">{t(v.nextLabel)}</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-1,rgba(255,255,255,.05)) !important;color:var(--ink,#ECECF1) !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.08)) !important}
  .dc-p2:hover{background:var(--overlay-2,rgba(255,255,255,.08)) !important}
  .dc-p3:hover{background:var(--overlay-3,rgba(255,255,255,.13)) !important}
  .dc-p4:hover{filter:brightness(1.08) !important}
  .dc-p5:hover{background:var(--overlay-3,rgba(255,255,255,.13)) !important}
  .dc-p6:hover{background:var(--overlay-3,rgba(255,255,255,.13)) !important}
  .dc-p7:hover{filter:brightness(1.12) !important}
  .dc-p8:hover{background:var(--overlay-2,rgba(255,255,255,.08)) !important}
  .dc-p9:hover{filter:brightness(1.08) !important}
  .dc-p10:hover{background:var(--overlay-3,rgba(255,255,255,.13)) !important}
  .dc-p11:hover{background:var(--overlay-3,rgba(255,255,255,.13)) !important}
</style>

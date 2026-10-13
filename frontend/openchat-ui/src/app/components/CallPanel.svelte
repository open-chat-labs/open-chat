<!-- Generated from lib/CallPanel.dc.html (source hash 956d6791) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './CallPanel.logic.js';
  import RoundIconButton from '../../lib/components/RoundIconButton.svelte';
  import VideoTile from './VideoTile.svelte';

  interface Props {
    title?: string;
    media?: 'video' | 'voice';
    full?: boolean;
    muted?: boolean;
    people?: Array<{name:string;initial:string;grad:string;muted?:boolean}>;
    start?: number;
    avatarGrad?: string;
    onToggleMute?: () => void;
    onToggleFull?: (full: boolean) => void;
    panelOpen?: boolean;
    onTogglePanel?: () => void;
    onDetails?: () => void;
    onMinimise?: () => void;
    onLeave?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:relative;width:100%;height:100%;box-sizing:border-box;overflow:hidden;border-radius:{v.radius};background:#0b0b0f;cursor:{v.cursor};color:#fff" use:ref={v.rootRef} onmousemove={v.wake} data-screen-label={v.screenLabel}>
  <div style="position:absolute;inset:{v.stageInset};display:grid;grid-template-columns:{v.cols};grid-auto-rows:minmax(0,1fr);gap:8px">
    {#if v.sharing}
      <div style="position:relative;border-radius:10px;overflow:hidden;background:repeating-linear-gradient(135deg,#191921 0 14px,#15151b 14px 28px);box-shadow:inset 0 0 0 2px var(--accent,#FF5672);display:flex;align-items:center;justify-content:center">
        <span style="font:500 13px/1 var(--font-mono);color:var(--ink-4,#7C7C8C)">Your shared screen</span>
      </div>
    {/if}
    {#each v.tiles ?? [] as tk, i0}
      <div style="position:relative;min-width:0;min-height:0"><VideoTile nameLabel={tk.name} initial={tk.initial} grad={tk.grad} feed={tk.bg} ratio={tk.ratioN} muted={tk.mutedB} speaking={tk.speakingB} big={tk.bigB}></VideoTile></div>
    {/each}
  </div>

  {#if v.hasStrip}
    <div style="position:absolute;top:{v.stripTop};inset-inline-end:12px;bottom:{v.stripBottom};width:{v.stripW};display:flex;flex-direction:column;gap:8px;overflow:hidden">
      {#each v.strip ?? [] as tk, i1}
        <div style="position:relative;flex:none;aspect-ratio:4/3;border-radius:10px;overflow:hidden;background:{tk.bg};box-shadow:{tk.ring},0 8px 20px rgba(0,0,0,.4)">
          <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><span style="width:38px;height:38px;border-radius:50%;background:{tk.grad};display:flex;align-items:center;justify-content:center;font:700 14px/1 var(--font-sans);color:#0e0e12">{t(tk.initial)}</span></div>
          <span style="position:absolute;inset-inline-start:6px;bottom:6px;height:20px;padding:0 8px;display:flex;align-items:center;gap:5px;border-radius:10px;background:rgba(0,0,0,.55);font:600 11px/1 var(--font-sans)"><span style="width:10px;height:10px;background:{tk.micInk};mask:{tk.micMask}"></span>{t(tk.name)}</span>
        </div>
      {/each}
    </div>
  {/if}

  {#if v.hasPip}
    <div style="position:absolute;z-index:2;top:{v.pipT};bottom:{v.pipB};left:{v.pipL};right:{v.pipR};translate:{v.pipTr};width:{v.pipW};aspect-ratio:4/3;border-radius:12px;overflow:hidden;background:{v.self.bg};box-shadow:0 10px 28px rgba(0,0,0,.45),inset 0 0 0 1px rgba(255,255,255,.16);cursor:grab;touch-action:none;transition:none" use:ref={v.pipRef} onpointerdown={v.pipDown} onpointermove={v.pipMove} onpointerup={v.pipUp} title="Drag to move">
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center"><span style="width:40px;height:40px;border-radius:50%;background:{v.self.grad};display:flex;align-items:center;justify-content:center;font:700 15px/1 var(--font-sans);color:#0e0e12">{t(v.self.initial)}</span></div>
      <span style="position:absolute;inset-inline-start:6px;bottom:6px;height:20px;padding:0 8px;display:flex;align-items:center;gap:5px;border-radius:10px;background:rgba(0,0,0,.55);font:600 11px/1 var(--font-sans)"><span style="width:10px;height:10px;background:{v.self.micInk};mask:{v.self.micMask}"></span>You</span>
    </div>
  {/if}

  <div style="position:absolute;z-index:3;inset:0 0 auto;display:flex;align-items:center;gap:10px;padding:{v.barPad};background:linear-gradient(180deg,rgba(0,0,0,.6),transparent);opacity:{v.chromeOpacity};transition:opacity 300ms;pointer-events:{v.chromePointer}">
    <span style="flex:none;width:34px;height:34px;border-radius:50%;background:{v.avatarGrad}"></span>
    <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px">
      <span style="font:700 15px/1 var(--font-sans);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.title)}</span>
      <span style="display:flex;align-items:center;gap:6px;font:600 12px/1 var(--font-mono);color:rgba(255,255,255,.8)"><span style="width:7px;height:7px;border-radius:50%;background:var(--status-online,#2EE6A8)"></span>{t(v.elapsed)} · {t(v.countLabel)}</span>
    </span>
    {#if v.sharing}
      <span style="flex:none;display:flex;align-items:center;gap:8px;height:30px;padding:0 6px 0 12px;border-radius:15px;background:var(--accent,#FF5672);color:var(--on-accent,#2E0512);font:700 12.5px/1 var(--font-sans);cursor:pointer" onclick={v.toggleShare} role="button" tabindex="0"><span style="width:13px;height:13px;background:currentColor;mask:var(--icon-screen-share) center/contain no-repeat"></span>You're sharing<span style="height:22px;padding:0 9px;display:flex;align-items:center;border-radius:11px;background:rgba(46,5,18,.18)">Stop</span></span>
    {/if}
    {#if v.hasPanel}<span class="dc-p0" style="flex:none;width:34px;height:34px;border-radius:50%;background:{v.panelBg};display:flex;align-items:center;justify-content:center;cursor:pointer" onclick={v.onTogglePanel} role="button" tabindex="0" aria-label={v.panelLabel} aria-pressed={v.panelOpenStr} title={v.panelLabel}><span style="width:15px;height:15px;background:#fff;mask:var(--icon-panel) center/contain no-repeat"></span></span>{/if}
    <span class="dc-p1" style="flex:none;width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;cursor:pointer" onclick={v.onMinimise} role="button" tabindex="0" aria-label="Minimise to see messages" title="Minimise to see messages"><span style="width:15px;height:15px;background:#fff;mask:var(--icon-chat) center/contain no-repeat"></span></span>
    <span class="dc-p2" style="flex:none;width:34px;height:34px;border-radius:50%;background:rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;cursor:pointer" onclick={v.onToggleFull} role="button" tabindex="0" aria-label={v.fullLabel} title={v.fullLabel}><span style="width:15px;height:15px;background:#fff;mask:{v.fullMask}"></span></span>
  </div>

  <div style="position:absolute;z-index:3;inset-inline:0;bottom:{v.pillBottom};display:flex;justify-content:center;opacity:{v.chromeOpacity};transition:opacity 300ms;pointer-events:{v.chromePointer}">
    <div style="display:flex;align-items:center;gap:8px;padding:8px;border-radius:999px;background:rgba(14,14,18,.8);backdrop-filter:blur(12px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)" role="toolbar" aria-label="Call controls">
      {#each v.controls ?? [] as b, i2}<RoundIconButton icon={b.icon} label={b.label} variant={b.variant} pressed={b.pressedBool} size={v.btnSizeKey} onPress={b.press}></RoundIconButton>{/each}
    </div>
  </div>
</div>

<style>
  .dc-p0:hover{background:rgba(0,0,0,.6) !important}
  .dc-p1:hover{background:rgba(0,0,0,.6) !important}
  .dc-p2:hover{background:rgba(0,0,0,.6) !important}
</style>

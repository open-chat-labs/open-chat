<!-- Generated from lib/AchievementToast.dc.html (source hash f37efbac) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './AchievementToast.logic.js';
  import Confetti from '../../lib/components/Confetti.svelte';

  interface Props {
    kicker?: string;
    title?: string;
    reward?: number;
    icon?: string;
    onClick?: () => void;
    onDone?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:absolute;left:50%;bottom:0;height:64px;width:64px;margin-left:-32px;border-radius:999px;overflow:hidden;opacity:0;box-shadow:0 12px 32px rgba(0,0,0,.45);cursor:pointer;z-index:20" use:ref={v.pillRef} role="status" aria-live="polite" aria-label={v.aria} onclick={v.onClick} onmouseenter={v.pause} onmouseleave={v.resume}>
  <span style="position:absolute;left:50%;top:50%;width:640px;height:640px;margin:-320px 0 0 -320px;background:conic-gradient(from 0deg,transparent 0deg,transparent 250deg,var(--accent,#FF5672) 300deg,#fff 330deg,var(--accent-bright,#FF8298) 345deg,transparent 360deg);opacity:0" use:ref={v.sweepRef}></span>
  <span style="position:absolute;inset:2px;border-radius:999px;background:var(--surface-2,#191921);box-shadow:inset 0 0 0 1px color-mix(in oklch,var(--accent,#FF5672) 35%,transparent)"></span>
  <span style="position:absolute;inset:0;border-radius:999px;box-shadow:inset 0 0 24px color-mix(in oklch,var(--accent,#FF5672) 45%,transparent);opacity:0" use:ref={v.glowRef}></span>
  <div style="position:relative;display:inline-flex;align-items:center;height:100%;padding-right:20px;white-space:nowrap" use:ref={v.rowRef} aria-hidden="true">
    <div style="position:relative;flex:none;width:64px;height:64px;display:flex;align-items:center;justify-content:center" use:ref={v.medalRef}><div style="position:absolute;left:0;top:0;width:0;height:0"><Confetti fire={v.medalBurst} count={40} spread={140} power={0.4}></Confetti></div>
      <span style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:radial-gradient(circle at 35% 30%,var(--accent-bright,#FF8298),var(--accent,#FF5672) 55%,color-mix(in oklch,var(--accent,#FF5672) 60%,black));box-shadow:inset 0 0 0 2px rgba(255,255,255,.25)"><span style="width:22px;height:22px;background:#fff;-webkit-mask:{v.iconMask};mask:{v.iconMask}"></span></span>
      <span style="position:absolute;inset:8px;border-radius:50%;box-shadow:0 0 0 2px var(--accent-bright,#FF8298);opacity:0" use:ref={v.ringRef}></span>
    </div>
    <div style="flex:none;height:40px;overflow:hidden;padding:0 8px 0 4px;opacity:0" use:ref={v.textRef}>
      <div style="display:flex;flex-direction:column" use:ref={v.rollRef}>
        <span style="height:40px;display:flex;align-items:center;font:var(--weight-bold,700) 15px/1 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.kicker)}</span>
        <span style="height:40px;display:flex;flex-direction:column;justify-content:center;gap:5px"><span style="font:600 10.5px/1 var(--font-mono);letter-spacing:.1em;color:var(--accent-bright,#FF8298);text-transform:uppercase">{t(v.kicker)}</span><span style="font:var(--weight-bold,700) 15px/1.1 var(--font-sans);color:var(--ink,#ECECF1)">{t(v.title)}</span></span>
      </div>
    </div>
    {#if v.hasReward}
      <span style="flex:none;display:flex;align-items:center;gap:5px;height:32px;padding:0 11px;border-radius:999px;background:color-mix(in oklch,var(--accent,#FF5672) 18%,transparent);font:700 13px/1 var(--font-mono);color:var(--accent-bright,#FF8298);opacity:0" use:ref={v.chipRef}><div style="position:absolute;left:0;top:0;width:0;height:0"><Confetti fire={v.chipBurst} count={34} spread={120} power={0.36}></Confetti></div><span style="width:13px;height:13px;background:currentColor;-webkit-mask:var(--icon-chit) center/contain no-repeat;mask:var(--icon-chit) center/contain no-repeat"></span><span use:ref={v.numRef}>+0</span></span>
    {/if}
  </div>
</div>

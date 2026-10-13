<!-- Hand-edited: status dot is markup; call timer ticks in the logic class (prototype used a React hook). Generated from lib/MiniCall.dc.html (source hash e6c8db6f) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './MiniCall.logic.js';
  import AvatarStack from '../../lib/components/AvatarStack.svelte';
  import RoundIconButton from '../../lib/components/RoundIconButton.svelte';
  import SnapFloat from '../../lib/components/SnapFloat.svelte';

  interface Props {
    title?: string;
    media?: 'video' | 'voice';
    start?: number;
    people?: Array<{ name?: string; initial?: string; grad?: string }>;
    faces?: string[];
    avatarGrad?: string;
    muted?: boolean;
    position?: string;
    safeTop?: number;
    safeBottom?: number;
    onSnap?: (position: string) => void;
    onOpen?: () => void;
    onToggleMute?: () => void;
    onLeave?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:absolute;inset:0;pointer-events:none"><SnapFloat width={280} position={v.position} safeTop={v.safeTop} safeBottom={v.safeBottom} label="Ongoing call" onSnap={v.snap}><div style="pointer-events:auto;box-sizing:border-box;padding:12px;border-radius:20px;background:var(--surface-2,#191921);box-shadow:0 16px 40px rgba(0,0,0,.5),inset 0 0 0 1px color-mix(in oklch,var(--status-online,#2EE6A8) 40%,transparent);display:flex;flex-direction:column;gap:12px" data-screen-label="Mini call">
        {#if v.isVideo}<div style="position:relative;margin:-4px -4px 0;aspect-ratio:4/3;border-radius:12px;overflow:hidden;background:linear-gradient(165deg,#4a3b45,#1d1a22);cursor:pointer;display:flex;align-items:center;justify-content:center" onclick={v.open} role="button" tabindex="0" aria-label="Back to call" onkeydown={v.openKey}><span style="width:56px;height:56px;border-radius:50%;background:{v.leadGrad};box-shadow:0 0 0 3px var(--accent,#FF5672);display:flex;align-items:center;justify-content:center;font:700 20px/1 var(--font-sans);color:#0e0e12">{t(v.leadInitial)}</span><span style="position:absolute;inset-inline-end:8px;bottom:8px;width:64px;aspect-ratio:4/3;border-radius:6px;background:linear-gradient(165deg,#3d434c,#22262d);box-shadow:0 0 0 1px rgba(255,255,255,.16)"></span></div>{/if}
        <div style="display:flex;align-items:center;gap:10px"><span style="flex:none;width:28px;height:28px;border-radius:50%;background:color-mix(in oklch,var(--status-online,#2EE6A8) 22%,transparent);display:flex;align-items:center;justify-content:center;animation:ocCallPulse 2.4s ease-out infinite"><span style="width:13px;height:13px;background:var(--status-online,#2EE6A8);mask:var(--icon-phone) center/contain no-repeat"></span></span><span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><span style="font:600 13px/1.1 var(--font-sans);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{t(v.title)}</span><span style="font:500 11.5px/1 var(--font-mono);color:var(--status-online,#2EE6A8)">{t(v.kind)} · {t(v.timer)}</span></span></div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="flex:1;min-width:0;display:flex;align-items:center"><AvatarStack people={v.faces} size={26} max={4}></AvatarStack></span>
          <RoundIconButton icon={v.muteIcon} label={v.muteTip} variant={v.muteVariant} pressed={v.mutedB} onPress={v.toggleMute}></RoundIconButton>
          <RoundIconButton icon="maximize" label="Back to call" onPress={v.open}></RoundIconButton>
          <RoundIconButton icon="phone-off" label="Leave call" variant="danger" onPress={v.leave}></RoundIconButton>
        </div>
      </div></SnapFloat></div>

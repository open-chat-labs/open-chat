<!-- Generated from lib/Badge.dc.html (source hash ac70dfd9) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './Badge.logic.js';

  interface Props {
    label?: string;
    variant?: string;
    short?: boolean;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="display:inline-flex;flex:none;width:{v.rootW};height:{v.rootH}" use:ref={v.rootRef}>
  {#if v.isCount}
    <span style="display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;padding:0 var(--space-4);box-sizing:border-box;border-radius:var(--radius-pill);background:var(--accent,#FF5672);color:var(--on-accent,#2E0512);font:var(--weight-bold) var(--text-xs)/1 var(--font-sans)">{t(v.label)}</span>
  {/if}
  {#if v.isTag}
    <span style="display:inline-flex;align-items:center;justify-content:center;height:22px;padding:0 var(--space-8);border-radius:var(--radius-pill);background:var(--accent-soft,rgba(255,86,114,.14));color:var(--accent-bright,#FF8298);font:var(--weight-medium) var(--text-sm)/1 var(--font-mono);letter-spacing:.02em">{t(v.label)}</span>
  {/if}
  {#if v.isNeutral}
    <span style="display:inline-flex;align-items:center;justify-content:center;height:22px;padding:0 var(--space-8);border-radius:var(--radius-pill);background:var(--overlay-1,rgba(255,255,255,.06));color:var(--ink-2,#B9B9C6);font:var(--weight-medium) var(--text-sm)/1 var(--font-mono);letter-spacing:.02em">{t(v.label)}</span>
  {/if}
  {#if v.isChit}
    <span style="display:inline-flex;align-items:center;gap:var(--space-6);height:22px;padding:0 var(--space-8);border-radius:var(--radius-pill);background:var(--status-chit-soft,rgba(255,159,69,.14));font:var(--weight-medium) var(--text-sm)/1 var(--font-mono);letter-spacing:.02em;color:var(--status-chit,#FF9F45)">
      <span>{t(v.label)}</span>
      {#if v.hasChitLabel}
        <span style="opacity:.72">CHIT</span>
      {/if}
    </span>
  {/if}
  {#if v.isVerified}
    <span style="flex:none;width:17px;height:17px;background:var(--status-verified,#3D9BFF);mask:var(--icon-verified) center/contain no-repeat"></span>
  {/if}
  {#if v.isDot}
    <span style="width:8px;height:8px;border-radius:var(--radius-pill);background:var(--accent,#FF5672);box-shadow:0 0 0 2.5px var(--card-ring-1,#0e0e12)"></span>
  {/if}
</div>

<!-- Generated from lib/LeaderboardDialog.dc.html (source hash b977d80f) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './LeaderboardDialog.logic.js';

  interface Props {
    handle?: string;
    you?: {rank:number,score:number} | null;
    onBack?: () => void;
    onClose?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<div style="position:fixed;inset:0;z-index:73;display:flex;align-items:center;justify-content:center;padding:var(--space-22)" data-screen-label="Leaderboard" role="dialog" aria-modal="true">
  <div style="position:absolute;inset:0;background:var(--oc-veil,rgba(3,3,6,.72));backdrop-filter:var(--oc-veil-blur,blur(4px));-webkit-backdrop-filter:var(--oc-veil-blur,blur(4px));animation:{v.veilAnim}" onclick={v.onClose} aria-hidden="true"></div>

  <div style="position:relative;display:flex;flex-direction:column;width:100%;max-width:620px;height:600px;max-height:100%;box-sizing:border-box;border-radius:var(--radius-xl);background:var(--surface-1,#0e0e12);box-shadow:inset 0 0 0 1px var(--line-2,rgba(255,255,255,.1)),var(--shadow-modal,0 30px 70px rgba(0,0,0,.45));overflow:hidden;animation:{v.cardAnim}">

    <div style="flex:none;display:flex;align-items:center;gap:var(--space-12);padding:var(--space-24) var(--space-32) var(--space-14)">
      <span class="dc-p0" style="flex:none;display:flex;align-items:center;justify-content:center;width:32px;height:32px;margin-inline-start:-10px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onBack} role="button" tabindex="0" aria-label="Back to CHIT" title="Back to CHIT">
        <span style="width:16px;height:16px;background:var(--ink-2,#C9C9D4);mask:{v.backMask}"></span>
      </span>
      <span style="flex:1;min-width:0;text-align:center;font:700 22px/1 'JetBrains Mono',monospace;letter-spacing:.14em;color:var(--status-chit,#FF9F45)">HIGH SCORES</span>
      <span class="dc-p1" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" title="Play (coming soon)">
        <span style="width:17px;height:17px;background:var(--status-chit,#FF9F45);mask:{v.joystickMask}"></span>
      </span>
      <span class="dc-p2" style="flex:none;display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:var(--radius-sm);cursor:pointer" onclick={v.onClose} role="button" tabindex="0">
        <span style="width:15px;height:15px;background:var(--ink-3,#9A9AA8);mask:{v.closeMask}"></span>
      </span>
    </div>

    <div style="flex:none;display:flex;justify-content:center;gap:var(--space-26);padding:var(--space-6) var(--space-32) var(--space-18)">
      {#each v.periods ?? [] as p, i0}
        <span class="dc-p3" style="font:500 12.5px/1 'JetBrains Mono',monospace;letter-spacing:.1em;color:{p.ink};padding-block-end:5px;border-block-end:2px solid {p.rule};cursor:pointer;user-select:none" onclick={p.onSelect} role="button" tabindex="0">{t(p.label)}</span>
      {/each}
    </div>

    <div style="flex:none;padding:0 var(--space-32) var(--space-12)">
      <div style="display:flex;align-items:baseline;gap:14px;padding-block-end:var(--space-10);border-block-end:2px solid var(--accent,#FF5672)">
        <span style="flex:none;width:34px;font:500 11px/1 'JetBrains Mono',monospace;letter-spacing:.1em;color:var(--status-online,#2EE6A8)">#</span>
        <span style="flex:1;font:500 11px/1 'JetBrains Mono',monospace;letter-spacing:.1em;color:var(--status-online,#2EE6A8)">USERNAME</span>
        <span style="flex:none;font:500 11px/1 'JetBrains Mono',monospace;letter-spacing:.1em;color:var(--status-online,#2EE6A8)">CHIT</span>
      </div>
    </div>

    <div style="flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;padding:0 var(--space-32)">
      {#each v.rows ?? [] as r, i1}
        <div style="display:flex;align-items:baseline;gap:14px;min-height:30px;padding:4px 0">
          <span style="flex:none;width:34px;font:700 15px/1 'JetBrains Mono',monospace;color:{r.ink}">{t(r.rank)}</span>
          <span style="flex:1;min-width:0;font:700 15px/1 'JetBrains Mono',monospace;letter-spacing:.04em;color:{r.ink};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(r.handle)}</span>
          <span style="flex:none;font:700 15px/1 'JetBrains Mono',monospace;color:{r.ink}">{t(r.score)}</span>
        </div>
      {/each}
    </div>

    <div style="flex:none;display:flex;align-items:baseline;gap:14px;padding:var(--space-16) var(--space-32) var(--space-24);margin-block-start:var(--space-10);border-block-start:1px solid var(--line-1,rgba(255,255,255,.07))">
      <span style="flex:none;width:34px;font:700 15px/1 'JetBrains Mono',monospace;color:var(--accent,#FF5672)">{t(v.youRank)}</span>
      <span style="flex:1;min-width:0;font:700 15px/1 'JetBrains Mono',monospace;letter-spacing:.04em;color:var(--accent,#FF5672);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{t(v.youHandle)}</span>
      <span style="flex:none;font:700 15px/1 'JetBrains Mono',monospace;color:var(--accent,#FF5672)">{t(v.youScore)}</span>
    </div>
  </div>
</div>

<style>
  .dc-p0:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p1:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p2:hover{background:var(--overlay-2,rgba(255,255,255,.09)) !important}
  .dc-p3:hover{color:var(--ink,#ECECF1) !important}
</style>

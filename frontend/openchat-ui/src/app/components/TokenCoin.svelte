<!-- Hand-edited: coin layers/faces are markup (prototype built them with createElement). Generated from lib/TokenCoin.dc.html (source hash 8398db54) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../../lib/dc/runtime.svelte';
  import Logic from './TokenCoin.logic.js';

  interface Props {
    symbol?: string;
    mark?: string;
    gradient?: string;
    edge?: string;
    edge2?: string;
    size?: number;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<span style="display:inline-flex;align-items:center;justify-content:center" role="img" aria-label={v.aria}><span aria-hidden="true" style="display:block;perspective:{v.size * 6}px">
    <span data-oc-motion="" style="position:relative;display:block;width:{v.size}px;height:{v.size}px;transform-style:preserve-3d;animation:ocCoinSpin 4s linear infinite">
      {#each v.layers as l}<span style="position:absolute;inset:0;border-radius:50%;transform:translateZ({l.z}px);background:{l.bg}"></span>{/each}
      {#each v.faces as f}<span style="position:absolute;inset:0;border-radius:50%;transform:{f.tr};background:radial-gradient(circle at 35% 30%,rgba(255,255,255,.45),transparent 45%),{v.gradient};box-shadow:inset 0 0 0 {v.rim}px rgba(255,255,255,.28);display:flex;align-items:center;justify-content:center;font:800 {v.markPx}px/1 var(--font-sans);color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.35);backface-visibility:hidden">{v.mark}</span>{/each}
    </span>
    <span style="display:block;width:{v.size * 0.7}px;height:{v.size * 0.1}px;margin:{v.size * 0.12}px auto 0;border-radius:50%;background:radial-gradient(closest-side,rgba(0,0,0,.45),transparent)"></span>
  </span></span>

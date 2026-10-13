<!-- Generated from lib/TokenAvatar.dc.html (source hash 362ee2f9) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './TokenAvatar.logic.js';

  interface Props {
    symbol?: string;
    mark?: string;
    gradient?: string;
    size?: number;
    badge?: string;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<span style="position:relative;flex:none;width:{v.px};height:{v.px};border-radius:var(--radius-pill);display:inline-flex;align-items:center;justify-content:center;background:{v.gradient};font:700 {v.fontPx}/1 var(--font-sans);color:#0b0b10" title={v.symbol}>{t(v.mark)}{#if v.hasBadge}<span style="position:absolute;bottom:-3px;right:-3px;width:{v.badgePx};height:{v.badgePx};border-radius:var(--radius-pill);display:flex;align-items:center;justify-content:center;background:var(--surface-3,#1b1b22);box-shadow:0 0 0 2px var(--surface-1,#0e0e12)"><span style="width:{v.badgeIcon};height:{v.badgeIcon};background:var(--ink-2,#C9C9D4);mask:{v.badgeMask}"></span></span>{/if}</span>

<!-- Generated from lib/ShareBar.dc.html (source hash d827e12e) on 2026-10-07. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './ShareBar.logic.js';

  interface Props {
    share?: number;
    gradient?: string;
    thickness?: number;
    veiled?: boolean;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<span style="display:block;width:100%;height:{v.h};border-radius:{v.h};background:var(--overlay-1,rgba(255,255,255,.06))" role="meter" aria-valuenow={v.aria} aria-valuemin="0" aria-valuemax="100"><span style="display:block;height:{v.h};border-radius:{v.h};width:{v.width};transition:width 420ms cubic-bezier(.2,.8,.2,1);background:{v.gradient}"></span></span>

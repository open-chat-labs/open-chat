<!-- Generated from lib/Countdown.dc.html (source hash 4ac813fd) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './Countdown.logic.js';

  interface Props {
    to?: number | string;
    format?: 'auto' | 'clock' | 'words';
    prefix?: string;
    suffix?: string;
    ended?: string;
    onEnd?: () => void;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<time style="font:inherit;color:inherit;font-variant-numeric:tabular-nums;white-space:nowrap" datetime={v.iso} aria-live="off" title={v.full}>{t(v.text)}</time>

<!-- Generated from lib/Confetti.dc.html (source hash 29b4b5be) on 2026-10-13. Edit freely; see EXPORT.md for how updates are tracked. -->
<script lang="ts">
  import { useLogic, t, ref } from '../dc/runtime.svelte';
  import Logic from './Confetti.logic.js';

  interface Props {
    count?: number;
    spread?: number;
    power?: number;
    fire?: number;
    [key: string]: unknown;
  }
  let props: Props = $props();
  const logic = useLogic(Logic, props);
  const v = $derived(logic.v);
</script>

<span style="position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none" use:ref={v.ref} aria-hidden="true"></span>

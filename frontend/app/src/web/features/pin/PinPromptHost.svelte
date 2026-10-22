<!-- One waiting PIN request (pinNumberResolverStore), answered once (PinAnswer). AppScreen keys it
     by the request, so each request starts fresh. -->
<script lang="ts">
    import type { PinNumberResolver } from "@shared";
    import { untrack } from "svelte";
    import PinDialog from "./PinDialog.svelte";
    import { PinAnswer } from "./pinPrompt";

    let { request }: { request: PinNumberResolver } = $props();

    const answer = new PinAnswer(untrack(() => request));
</script>

<PinDialog onEnter={(pin) => answer.enter(pin)} onClose={() => answer.close()} />

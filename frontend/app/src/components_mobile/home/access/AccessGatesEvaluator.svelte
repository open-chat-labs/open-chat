<script lang="ts">
    import { GateEvaluation } from "@src/logic/access/gateEvaluation.svelte";
    import { OpenChat, type EnhancedAccessGate, type GateCheckSucceeded } from "@client";
    import { getContext } from "svelte";
    import AccessGateEvaluator from "./AccessGateEvaluator.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        gates: EnhancedAccessGate[];
        onSuccess: (success: GateCheckSucceeded) => void;
        onClose: () => void;
    }

    let { gates, onSuccess, onClose }: Props = $props();

    // svelte-ignore state_referenced_locally
    const evaluation = new GateEvaluation(client, gates);

    function nextGate() {
        const gateCheck = evaluation.next();
        if (gateCheck !== undefined) {
            onSuccess(gateCheck);
        }
    }
</script>

{#if evaluation.gate}
    <AccessGateEvaluator
        gate={evaluation.gate}
        {evaluation}
        onComplete={nextGate}
        {onClose} />
{/if}

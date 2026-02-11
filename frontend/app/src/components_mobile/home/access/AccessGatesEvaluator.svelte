<script lang="ts">
    import { accessApprovalState } from "@src/utils/preview.svelte";
    import { OpenChat, type EnhancedAccessGate, type GateCheckSucceeded } from "openchat-client";
    import { getContext } from "svelte";
    import AccessGateEvaluator from "./AccessGateEvaluator.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        gates: EnhancedAccessGate[];
        onSuccess: (success: GateCheckSucceeded) => void;
        onClose: () => void;
    }

    let { gates, onSuccess, onClose }: Props = $props();

    // find the first gate that the user does not meet
    let currentGateIndex = $state(gates.findIndex((g) => !client.doesUserMeetAccessGate(g)));
    let currentGate = $derived(gates[currentGateIndex]);
    let cancelled = $state(false);

    function internalClose() {
        cancelled = true;
        accessApprovalState.reset();
        onClose();
    }

    $effect(() => {
        if (currentGate === undefined && !cancelled) {
            onSuccess({
                credentials: accessApprovalState.credentials,
                paymentApprovals: accessApprovalState.paymentApprovals,
            });
        }
    });

    function nextGate() {
        currentGateIndex += 1;
    }
</script>

{#if currentGate}
    <AccessGateEvaluator gate={currentGate} onComplete={nextGate} onClose={internalClose} />
{/if}

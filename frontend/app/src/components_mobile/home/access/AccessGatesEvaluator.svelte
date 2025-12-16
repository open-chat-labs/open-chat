<script lang="ts">
    import {
        OpenChat,
        type EnhancedAccessGate,
        type GateCheckSucceeded,
        type PaymentGateApprovals,
    } from "openchat-client";
    import { getContext } from "svelte";
    import AccessGateEvaluator from "./AccessGateEvaluator.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        gates: EnhancedAccessGate[];
        onSuccess: (success: GateCheckSucceeded) => void;
        onClose: () => void;
    }

    let { gates, onSuccess, onClose }: Props = $props();

    $inspect(gates);

    // find the first gate that the user does not meet
    let currentGateIndex = $state(gates.findIndex((g) => !client.doesUserMeetAccessGate(g)));
    let currentGate = $derived(gates[currentGateIndex]);
    let credentials: string[] = [];
    let paymentApprovals: PaymentGateApprovals = new Map();

    $effect(() => {
        if (currentGate === undefined) {
            onSuccess({ credentials, paymentApprovals });
        }
    });

    function nextGate() {
        currentGateIndex += 1;
    }
</script>

{#if currentGate}
    <AccessGateEvaluator
        gate={currentGate}
        onComplete={nextGate}
        {paymentApprovals}
        {credentials}
        {onClose} />
{/if}

<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { Poller } from "openchat-client";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import ProgressSteps from "../../ProgressSteps.svelte";

    export let swapId: bigint;
    export let tokenIn: string;
    export let tokenOut: string;
    export let amountIn: string;
    export let decimalsOut: number;
    export let dex: string;

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();
    const POLL_INTERVAL = 1000;
    const labelPrefix = "tokenSwap.progress.";

    let step = 0;
    let amountOut = "";
    let steps = ["get", "deposit", "notify", "swap", "withdraw"];
    let progressSteps: ProgressSteps;

    $: stepLabels = steps.map((step) => labelPrefix + step);

    let finalLabel = labelPrefix + "done";

    $: labelValues = {
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        dex,
    };

    onMount(() => {
        const poller = new Poller(querySwapProgress, POLL_INTERVAL, POLL_INTERVAL, true);

        return () => poller.stop();
    });

    async function querySwapProgress() {
        let response = await client.tokenSwapStatus(swapId);

        if (response.kind === "success") {
            if (response.withdrawnFromDex?.kind === "ok" && step <= 4) {
                const success =
                    response.amountSwapped?.kind === "ok" &&
                    response.amountSwapped.value.kind === "ok";

                if (!success) {
                    finalLabel = labelPrefix + "failed";
                }

                updateProgress(5, true, success);
                dispatch("finished", success ? "success" : "rateChanged");
            } else if (response.amountSwapped?.kind === "ok" && step <= 3) {
                if (response.amountSwapped.value.kind === "ok") {
                    amountOut = client.formatTokens(
                        response.amountSwapped.value.value,
                        decimalsOut,
                    );
                    updateProgress(4, true);
                } else {
                    steps[4] = "refund";
                    updateProgress(4, false);
                }
            } else if (response.notifyDex?.kind == "ok" && step <= 2) {
                updateProgress(3, true);
            } else if (response.transfer?.kind == "ok" && step <= 1) {
                updateProgress(2, true);
            } else if (response.transfer?.kind == "error" && step <= 1) {
                finalLabel = labelPrefix + "insufficientFunds";
                updateProgress(2, false, false);
                dispatch("finished", "insufficientFunds");
            } else if (response.depositAccount?.kind == "ok" && step === 0) {
                updateProgress(1, true);
            } else if (response.depositAccount?.kind == "error" && step === 0) {
                finalLabel = labelPrefix + "error";
                updateProgress(1, false, false);
                dispatch("finished", "error");
            }
        }
    }

    function updateProgress(nextStep: number, previousSuccess: boolean, outcome?: boolean) {
        if (nextStep <= step) {
            return;
        }

        const numNewSteps = nextStep - step;

        for (let i = 0; i < numNewSteps; i++) {
            const last = i == numNewSteps - 1;
            progressSteps.next(!last || previousSuccess, last ? outcome : undefined);
        }
    }
</script>

<ProgressSteps bind:this={progressSteps} {stepLabels} {labelValues} {finalLabel} bind:step />

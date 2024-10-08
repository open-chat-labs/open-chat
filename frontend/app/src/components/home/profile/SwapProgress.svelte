<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { Poller } from "openchat-client";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import ProgressSteps, { type Result, type Step } from "../../ProgressSteps.svelte";

    export let swapId: bigint;
    export let tokenIn: string;
    export let tokenOut: string;
    export let ledgerIn: string;
    export let ledgerOut: string;
    export let amountIn: string;
    export let decimalsOut: number;
    export let dex: string;

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();
    const POLL_INTERVAL = 1000;
    const labelPrefix = "tokenSwap.progress.";

    let percent: number | undefined = 0;
    let amountOut = "";
    let steps: Step[] = [{ label: "get", status: "doing" }];
    let result: Result = undefined;
    let poller: Poller | undefined = undefined;

    $: fullSteps = steps.map((step) => ({ label: labelPrefix + step.label, status: step.status }));

    $: fullResult =
        result !== undefined
            ? { label: labelPrefix + result.label, status: result.status }
            : undefined;

    $: labelValues = {
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        dex,
    };

    onMount(() => {
        poller = new Poller(querySwapProgress, POLL_INTERVAL, POLL_INTERVAL, true);

        return () => poller?.stop();
    });

    function notifyFinished(outcome: "success" | "rateChanged" | "insufficientFunds" | "error") {
        dispatch("finished", { outcome, ledgerIn, ledgerOut });
        poller?.stop();
    }

    function updateSteps(newSteps: Step[]) {
        if (newSteps.length >= steps.length) {
            steps = newSteps;
        }
    }

    async function querySwapProgress() {
        let response = await client.tokenSwapStatus(swapId);

        if (response.kind === "success") {
            if (response.amountSwapped?.kind === "ok" && response.amountSwapped?.value.kind === "ok") {
                amountOut = client.formatTokens(
                    response.amountSwapped.value.value,
                    decimalsOut,
                );
            }

            if (response.withdrawnFromDex?.kind === "ok") {
                const success =
                    response.amountSwapped?.kind === "ok" &&
                    response.amountSwapped.value.kind === "ok";

                updateSteps([
                    { label: "get", status: "done" },
                    { label: "deposit", status: "done" },
                    { label: "notify", status: "done" },
                    { label: "swap", status: "done" },
                    { label: success ? "withdraw" : "refund", status: "done" },
                ]);
                result = { label: success ? "done" : "failed", status: "done" };
                notifyFinished(success ? "success" : "rateChanged");
            } else if (response.amountSwapped?.kind === "ok") {
                if (response.amountSwapped.value.kind === "ok") {
                    updateSteps([
                        { label: "get", status: "done" },
                        { label: "deposit", status: "done" },
                        { label: "notify", status: "done" },
                        { label: "swap", status: "done" },
                        { label: "withdraw", status: "doing" },
                    ]);
                    percent = 80;
                } else {
                    updateSteps([
                        { label: "get", status: "done" },
                        { label: "deposit", status: "done" },
                        { label: "notify", status: "done" },
                        { label: "swap", status: "failed" },
                        { label: "refund", status: "doing" },
                    ]);
                    percent = undefined;
                }
            } else if (response.notifyDex?.kind == "ok") {
                updateSteps([
                    { label: "get", status: "done" },
                    { label: "deposit", status: "done" },
                    { label: "notify", status: "done" },
                    { label: "swap", status: "doing" },
                ]);
                percent = 60;
            } else if (response.transfer?.kind == "ok") {
                updateSteps([
                    { label: "get", status: "done" },
                    { label: "deposit", status: "done" },
                    { label: "notify", status: "doing" },
                ]);
                percent = 40;
            } else if (response.transfer?.kind == "error") {
                updateSteps([
                    { label: "get", status: "done" },
                    { label: "deposit", status: "failed" },
                ]);
                result = { label: "insufficientFunds", status: "failed" };
                notifyFinished("insufficientFunds");
            } else if (response.depositAccount?.kind == "ok") {
                updateSteps([
                    { label: "get", status: "done" },
                    { label: "deposit", status: "doing" },
                ]);
                percent = 20;
            } else if (response.depositAccount?.kind == "error") {
                updateSteps([{ label: "get", status: "failed" }]);
                result = { label: "error", status: "failed" };
                notifyFinished("error");
            }
        }
    }
</script>

<ProgressSteps steps={fullSteps} {labelValues} result={fullResult} {percent} />

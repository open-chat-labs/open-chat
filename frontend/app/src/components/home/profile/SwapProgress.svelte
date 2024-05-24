<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { Poller } from "openchat-client";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import ProgressSteps, { type Result, type Step } from "../../ProgressSteps.svelte";

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

    let percent: number | undefined = 0;
    let amountOut = "";
    let steps: Step[] = [{ label: "get", status: "doing" }];
    let result: Result = undefined;

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
        const poller = new Poller(querySwapProgress, POLL_INTERVAL, POLL_INTERVAL, true);

        return () => poller.stop();
    });

    async function querySwapProgress() {
        let response = await client.tokenSwapStatus(swapId);

        if (response.kind === "success") {
            if (response.withdrawnFromDex?.kind === "ok") {
                const success =
                    response.amountSwapped?.kind === "ok" &&
                    response.amountSwapped.value.kind === "ok";

                steps = [
                    { label: "get", status: "done" },
                    { label: "deposit", status: "done" },
                    { label: "notify", status: "done" },
                    { label: "swap", status: "done" },
                    { label: success ? "withdraw" : "refund", status: "done" },
                ];
                result = { label: success ? "done" : "failed", status: "done" };
                dispatch("finished", success ? "success" : "rateChanged");
            } else if (response.amountSwapped?.kind === "ok") {
                if (response.amountSwapped.value.kind === "ok") {
                    amountOut = client.formatTokens(
                        response.amountSwapped.value.value,
                        decimalsOut,
                    );
                    steps = [
                        { label: "get", status: "done" },
                        { label: "deposit", status: "done" },
                        { label: "notify", status: "done" },
                        { label: "swap", status: "done" },
                        { label: "withdraw", status: "doing" },
                    ];
                    percent = 80;
                } else {
                    steps = [
                        { label: "get", status: "done" },
                        { label: "deposit", status: "done" },
                        { label: "notify", status: "done" },
                        { label: "swap", status: "failed" },
                        { label: "refund", status: "doing" },
                    ];
                    percent = undefined;
                }
            } else if (response.notifyDex?.kind == "ok") {
                steps = [
                    { label: "get", status: "done" },
                    { label: "deposit", status: "done" },
                    { label: "notify", status: "done" },
                    { label: "swap", status: "doing" },
                ];
                percent = 60;
            } else if (response.transfer?.kind == "ok") {
                steps = [
                    { label: "get", status: "done" },
                    { label: "deposit", status: "done" },
                    { label: "notify", status: "doing" },
                ];
                percent = 40;
            } else if (response.transfer?.kind == "error") {
                steps = [
                    { label: "get", status: "done" },
                    { label: "deposit", status: "failed" },
                ];
                result = { label: "insufficientFunds", status: "failed" };
                dispatch("finished", "insufficientFunds");
            } else if (response.depositAccount?.kind == "ok") {
                steps = [
                    { label: "get", status: "done" },
                    { label: "deposit", status: "doing" },
                ];
                percent = 20;
            } else if (response.depositAccount?.kind == "error") {
                steps = [{ label: "get", status: "failed" }];
                result = { label: "error", status: "failed" };
                dispatch("finished", "error");
            }
        }
    }
</script>

<ProgressSteps steps={fullSteps} {labelValues} result={fullResult} {percent} />

<script lang="ts" module>
    export type SwapOutcome = "success" | "rateChanged" | "insufficientFunds" | "error";
</script>

<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { Poller } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import ProgressSteps, { type Result, type Step } from "../../ProgressSteps.svelte";

    interface Props {
        swapId: bigint;
        tokenIn: string;
        tokenOut: string;
        ledgerIn: string;
        ledgerOut: string;
        amountIn: string;
        decimalsOut: number;
        dex: string;
        onFinished: (outcome: SwapOutcome, ledgerIn: string, ledgerOut: string) => void;
    }

    let {
        swapId,
        tokenIn,
        tokenOut,
        ledgerIn,
        ledgerOut,
        amountIn,
        decimalsOut,
        dex,
        onFinished,
    }: Props = $props();

    ledgerOut;

    const client = getContext<OpenChat>("client");
    const POLL_INTERVAL = 1000;
    const labelPrefix = "tokenSwap.progress.";

    let percent: number | undefined = $state(0);
    let amountOut = $state("");
    let steps = $state<Step[]>([{ label: "get", status: "doing" }]);
    let result = $state<Result>(undefined);
    let poller: Poller | undefined = undefined;

    let fullSteps = $derived(
        steps.map((step) => ({ label: labelPrefix + step.label, status: step.status })),
    );

    let fullResult = $derived(
        result !== undefined
            ? { label: labelPrefix + result.label, status: result.status }
            : undefined,
    );

    let labelValues = $derived({
        tokenIn,
        tokenOut,
        amountIn,
        amountOut,
        dex,
    });

    onMount(() => {
        poller = new Poller(querySwapProgress, POLL_INTERVAL, POLL_INTERVAL, true);

        return () => poller?.stop();
    });

    function notifyFinished(outcome: "success" | "rateChanged" | "insufficientFunds" | "error") {
        onFinished(outcome, ledgerIn, ledgerIn);
        poller?.stop();
    }

    function updateSteps(newSteps: Step[]) {
        if (newSteps.length >= steps.length) {
            steps = newSteps;
        }
    }

    function updatePercent(newPercent: number) {
        if (newPercent >= (percent ?? 0)) {
            percent = newPercent;
        }
    }

    async function querySwapProgress() {
        let response = await client.tokenSwapStatus(swapId);

        if (response.kind === "success") {
            if (
                response.amountSwapped?.kind === "ok" &&
                response.amountSwapped?.value.kind === "ok"
            ) {
                amountOut = client.formatTokens(response.amountSwapped.value.value, decimalsOut);
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
                    updatePercent(80);
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
                updatePercent(60);
            } else if (response.transfer?.kind == "ok") {
                updateSteps([
                    { label: "get", status: "done" },
                    { label: "deposit", status: "done" },
                    { label: "notify", status: "doing" },
                ]);
                updatePercent(40);
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
                updatePercent(20);
            } else if (response.depositAccount?.kind == "error") {
                updateSteps([{ label: "get", status: "failed" }]);
                result = { label: "error", status: "failed" };
                notifyFinished("error");
            }
        }
    }
</script>

<ProgressSteps steps={fullSteps} {labelValues} result={fullResult} {percent} />

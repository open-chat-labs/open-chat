<script lang="ts">
    import type { OpenChat, SwapFromWalletStep, SwapTokensResponse } from "@client";
    import { getContext } from "svelte";
    import {
        swapFromWalletOutcome,
        walletSwapStepsUpTo,
        type SwapOutcome,
        type WalletSwapStep,
    } from "../../../utils/tokenSwap";
    import ProgressSteps, { type Result, type Step } from "../../ProgressSteps.svelte";

    interface Props {
        tokenIn: string;
        tokenOut: string;
        ledgerIn: string;
        ledgerOut: string;
        amountIn: string;
        decimalsOut: number;
        dex: string;
        // What swapping returned, once it has
        swapResponse: SwapTokensResponse | undefined;
        // The step the swap, which the user makes straight from their wallet, has reached, once it
        // is past initialising. Its steps are reported as they start.
        swapStep: SwapFromWalletStep | undefined;
        onFinished: (outcome: SwapOutcome, ledgerIn: string, ledgerOut: string) => void;
    }

    let {
        tokenIn,
        tokenOut,
        ledgerIn,
        ledgerOut,
        amountIn,
        decimalsOut,
        dex,
        swapResponse,
        swapStep,
        onFinished,
    }: Props = $props();

    const client = getContext<OpenChat>("client");
    const labelPrefix = "tokenSwap.progress.";
    const WALLET_SWAP_PERCENT: Record<WalletSwapStep, number> = {
        init: 10,
        approve: 30,
        swap: 60,
        withdraw: 85,
    };

    let percent: number | undefined = $state(WALLET_SWAP_PERCENT.init);
    let amountOut = $state("");
    let steps = $state<Step[]>(walletSwapSteps("init", "doing"));
    let result = $state<Result>(undefined);

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

    $effect(() => {
        if (swapStep !== undefined && result === undefined) {
            if (swapStep.step === "withdraw") {
                amountOut = client.formatTokens(swapStep.amountOut, decimalsOut);
            }
            steps = walletSwapSteps(swapStep.step, "doing");
            percent = WALLET_SWAP_PERCENT[swapStep.step];
        }
    });

    $effect(() => {
        if (swapResponse !== undefined && result === undefined) {
            showSwapFromWalletOutcome(swapResponse);
        }
    });

    // The steps of the swap so far, the last of which has `status`
    function walletSwapSteps(current: WalletSwapStep, status: Step["status"]): Step[] {
        const labels = walletSwapStepsUpTo(current);
        return labels.map((label, i) => ({
            label,
            status: i < labels.length - 1 ? "done" : status,
        }));
    }

    function showSwapFromWalletOutcome(response: SwapTokensResponse) {
        const outcome = swapFromWalletOutcome(response);
        if (response.kind === "success") {
            amountOut = client.formatTokens(response.amountOut, decimalsOut);
        }
        steps = walletSwapSteps(
            swapStep?.step ?? "init",
            outcome === "success" ? "done" : "failed",
        );
        if (outcome === "success" || outcome === "rateChanged") {
            result = { label: outcome === "success" ? "done" : "failed", status: "done" };
        } else {
            result = { label: outcome, status: "failed" };
        }
        percent = outcome === "success" ? 100 : undefined;
        onFinished(outcome, ledgerIn, ledgerOut);
    }
</script>

<ProgressSteps steps={fullSteps} {labelValues} result={fullResult} {percent} />

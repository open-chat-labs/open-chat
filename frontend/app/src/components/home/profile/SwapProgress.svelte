<script lang="ts">
    import type { OpenChat, SwapFromWalletStep, SwapTokensResponse } from "@client";
    import { Poller } from "@client";
    import { getContext, onMount } from "svelte";
    import {
        swapFromWalletOutcome,
        walletSwapStepsUpTo,
        type SwapOutcome,
        type WalletSwapStep,
    } from "../../../utils/tokenSwap";
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
        // What swapping returned, once it has
        swapResponse: SwapTokensResponse | undefined;
        // Whether the user is swapping straight from their wallet, as a user who holds their own
        // funds does, in which case its steps are reported as they start rather than polled for
        fromWallet: boolean;
        // The step a swap made from the wallet has reached, once it is past initialising
        swapStep: SwapFromWalletStep | undefined;
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
        swapResponse,
        fromWallet,
        swapStep,
        onFinished,
    }: Props = $props();

    const client = getContext<OpenChat>("client");
    const POLL_INTERVAL = 1000;
    const labelPrefix = "tokenSwap.progress.";
    const WALLET_SWAP_PERCENT: Record<WalletSwapStep, number> = {
        init: 10,
        approve: 30,
        swap: 60,
        withdraw: 85,
    };

    let percent: number | undefined = $state(0);
    let amountOut = $state("");
    // A swap is made from the wallet or not for as long as this shows it
    // svelte-ignore state_referenced_locally
    let steps = $state<Step[]>(
        fromWallet ? walletSwapSteps("init", "doing") : [{ label: "get", status: "doing" }],
    );
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
        if (fromWallet) return;

        poller = new Poller(querySwapProgress, POLL_INTERVAL, POLL_INTERVAL, true);

        return () => poller?.stop();
    });

    $effect(() => {
        if (fromWallet && swapStep !== undefined && result === undefined) {
            steps = walletSwapSteps(swapStep, "doing");
            percent = WALLET_SWAP_PERCENT[swapStep];
        }
    });

    $effect(() => {
        if (fromWallet && swapResponse !== undefined && result === undefined) {
            showSwapFromWalletOutcome(swapResponse);
        }
    });

    // The steps of a swap made from the wallet so far, the last of which has `status`
    function walletSwapSteps(current: WalletSwapStep, status: Step["status"]): Step[] {
        const labels = walletSwapStepsUpTo(current);
        return labels.map((label, i) => ({
            label,
            status: i < labels.length - 1 ? "done" : status,
        }));
    }

    function notifyFinished(outcome: SwapOutcome) {
        onFinished(outcome, ledgerIn, ledgerOut);
        poller?.stop();
    }

    function showSwapFromWalletOutcome(response: SwapTokensResponse) {
        const outcome = swapFromWalletOutcome(response);
        if (response.kind === "success") {
            amountOut = client.formatTokens(response.amountOut, decimalsOut);
        }
        steps = walletSwapSteps(swapStep ?? "init", outcome === "success" ? "done" : "failed");
        if (outcome === "success" || outcome === "rateChanged") {
            result = { label: outcome === "success" ? "done" : "failed", status: "done" };
        } else {
            result = { label: outcome, status: "failed" };
        }
        percent = outcome === "success" ? 100 : undefined;
        notifyFinished(outcome);
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
        // Read before asking, since a swap which isn't found by a query made before swapping
        // returned may yet be recorded
        const refused = swapResponse !== undefined && swapResponse.kind !== "success";
        const response = await client.tokenSwapStatus(swapId);

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
        } else if (refused) {
            // Swapping returned an error and the swap was never recorded, so it was refused before
            // it started (eg. the PIN was wrong) and there is no progress to wait for
            updateSteps([{ label: "get", status: "failed" }]);
            result = { label: "error", status: "failed" };
            notifyFinished("error");
        }
    }
</script>

<ProgressSteps steps={fullSteps} {labelValues} result={fullResult} {percent} />

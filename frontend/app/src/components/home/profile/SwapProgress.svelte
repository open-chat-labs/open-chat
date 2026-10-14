<script lang="ts">
    import type { InterpolationValues, SwapFromWalletStep, SwapOutcome } from "@client";
    import { formatTokens } from "@client";
    import { walletSwapStepsUpTo, type WalletSwapStep } from "../../../utils/tokenSwap";
    import ProgressSteps, { type Result, type Step } from "../../ProgressSteps.svelte";

    interface Props {
        // The quote's values, which fill in the step labels
        values: InterpolationValues;
        decimalsOut: number;
        // The step the swap, which the user makes straight from their wallet, has reached, once it
        // is past initialising. Its steps are reported as they start.
        step: SwapFromWalletStep | undefined;
        // How the swap went, once it has
        outcome: Exclude<SwapOutcome, { kind: "cancelled" }> | undefined;
    }

    let { values, decimalsOut, step, outcome }: Props = $props();

    const labelPrefix = "tokenSwap.progress.";
    const WALLET_SWAP_PERCENT: Record<WalletSwapStep, number> = {
        init: 10,
        approve: 30,
        swap: 60,
        withdraw: 85,
    };

    let amountOut = $derived(
        outcome?.kind === "swapped"
            ? formatTokens(outcome.amountOut, decimalsOut)
            : step?.step === "withdraw"
              ? formatTokens(step.amountOut, decimalsOut)
              : "",
    );

    let labelValues = $derived({ ...values, amountOut });

    let steps = $derived(
        walletSwapSteps(
            step?.step ?? "init",
            outcome === undefined ? "doing" : outcome.kind === "swapped" ? "done" : "failed",
        ),
    );

    // A changed rate is shown as done, since the user can quote again
    let result = $derived<Result>(
        outcome === undefined
            ? undefined
            : outcome.kind === "swapped"
              ? { label: `${labelPrefix}done`, status: "done" }
              : {
                    label: outcome.message.key,
                    status: outcome.kind === "rate_changed" ? "done" : "failed",
                },
    );

    let percent = $derived(
        outcome === undefined
            ? WALLET_SWAP_PERCENT[step?.step ?? "init"]
            : outcome.kind === "swapped"
              ? 100
              : undefined,
    );

    // The steps of the swap so far, the last of which has `status`
    function walletSwapSteps(current: WalletSwapStep, status: Step["status"]): Step[] {
        const labels = walletSwapStepsUpTo(current);
        return labels.map((label, i) => ({
            label: labelPrefix + label,
            status: i < labels.length - 1 ? "done" : status,
        }));
    }
</script>

<ProgressSteps {steps} {labelValues} {result} {percent} />

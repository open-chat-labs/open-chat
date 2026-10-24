<!-- Buying streak insurance (?chit=insurance, 8d, #10130), StreakInsuranceDialog in the CHIT
     dialog's place, over the same backdrop, Back returning to it, as the old
     streak insurance dialog: paid in CHAT (the price burned, the approval's fee on top), asking for
     the PIN first if the user has one (the client does, through the PIN prompt). What's sent is
     worked out from the cover bought, never the dialog's figure. -->
<script lang="ts">
    import {
        chitStateStore,
        cryptoBalanceStore,
        currentStreak,
        enhancedCryptoLookup,
        LEDGER_CANISTER_CHAT,
        STREAK_INSURANCE_MAX_DAYS,
        streakInsuranceStore,
        type OpenChat,
    } from "@client";
    import StreakInsuranceDialog from "@openchat/ui/src/features/components/StreakInsuranceDialog.svelte";
    import { now500 } from "@src/stores/time";
    import { getContext, onMount } from "svelte";
    import type { DialogProps, LinkedDialog } from "../app/dialogs";
    import { canGoBack, goBack } from "../app/linkedDialogs.svelte";
    import {
        streakInsuranceBalance,
        streakInsuranceDialogPrices,
        streakInsurancePurchase,
    } from "./chit.adapter";

    let { onClose }: DialogProps<Extract<LinkedDialog, { kind: "streak_insurance" }>> = $props();

    const client = getContext<OpenChat>("client");

    const balance = $derived(
        streakInsuranceBalance(
            $cryptoBalanceStore.get(LEDGER_CANISTER_CHAT) ?? 0n,
            $enhancedCryptoLookup.get(LEDGER_CANISTER_CHAT)?.transferFee,
        ),
    );

    // the balance as it is now, as the old dialog had it: a wallet not loaded yet, or CHAT moved
    // since, would offer what can't be paid, or refuse what can
    onMount(() => {
        client.refreshAccountBalance(LEDGER_CANISTER_CHAT);
    });

    // the dialog closes once this settles, and shows its error if it throws. The PIN prompt given
    // up is nothing bought, by choice: the dialog stays open, with no error (false). The prompt is
    // the only thing in payForStreakInsurance that throws (it rejects with "cancelled"); a payment
    // that fails comes back as a failure
    async function buy({ days: requested }: { days: number }): Promise<boolean> {
        const { days, price } = streakInsurancePurchase($streakInsuranceStore, requested);
        if (days === 0) throw new Error("no room for more cover");
        let resp;
        try {
            resp = await client.payForStreakInsurance(days, price);
        } catch (err) {
            if (err === "cancelled") return false;
            throw err;
        }
        if (resp.kind !== "success") throw new Error(`streak insurance not bought: ${resp.kind}`);
        return true;
    }
</script>

<StreakInsuranceDialog
    streak={currentStreak($chitStateStore, $now500)}
    insured={$streakInsuranceStore.daysInsured}
    used={$streakInsuranceStore.daysMissed}
    {balance}
    prices={streakInsuranceDialogPrices($streakInsuranceStore)}
    cap={STREAK_INSURANCE_MAX_DAYS}
    onBuy={buy}
    onBack={canGoBack() ? goBack : undefined}
    {onClose} />

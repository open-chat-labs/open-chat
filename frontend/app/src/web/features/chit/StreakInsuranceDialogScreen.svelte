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
        streakInsuranceStore,
        type OpenChat,
    } from "@client";
    import StreakInsuranceDialog from "@openchat/ui/src/features/components/StreakInsuranceDialog.svelte";
    import { now500 } from "@src/stores/time";
    import { getContext } from "svelte";
    import type { DialogProps, LinkedDialog } from "../app/dialogs";
    import { backToLinked } from "../app/linkedDialogs";
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
            $enhancedCryptoLookup.get(LEDGER_CANISTER_CHAT)?.transferFee ?? 0n,
        ),
    );

    // the dialog closes once this settles, and shows its error if it throws
    async function buy({ days: requested }: { days: number }): Promise<void> {
        const { days, price } = streakInsurancePurchase($streakInsuranceStore, requested);
        if (days === 0) throw new Error("no room for more cover");
        const resp = await client.payForStreakInsurance(days, price);
        if (resp.kind !== "success") throw new Error(`streak insurance not bought: ${resp.kind}`);
    }
</script>

<StreakInsuranceDialog
    streak={currentStreak($chitStateStore, $now500)}
    insured={$streakInsuranceStore.daysInsured}
    used={$streakInsuranceStore.daysMissed}
    {balance}
    prices={streakInsuranceDialogPrices($streakInsuranceStore)}
    onBuy={buy}
    onBack={() => backToLinked({ kind: "chit" })}
    {onClose} />

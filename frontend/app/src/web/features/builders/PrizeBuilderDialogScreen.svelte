<!-- The composer's "+" → Prize (5d): PrizeBuilderDialog, whose prize is attached to the chat's
     draft (the mobile app's way) and funded when the message is sent, with the PIN asked for then.
     Not in a DM (the chat's permissions leave it out). The token starts at the one last sent, else
     ICP, among those the wallet holds; the split, duration and restrictions start from the last
     prize's (PrizeForm, logic/prize, shared with both old builders). What it costs is
     `prizeCosts`' (the fund's transfer and its approval, a transfer fee per winner and OpenChat's
     5%), shown through the dialog's `pricing`; the fund is split by `newPrizeContent`. Opened
     again from the composer's chip, it edits the staged prize. Pays from the OpenChat wallet only
     (GAPS: no external wallet picker). -->
<script lang="ts">
    import {
        allUsersStore,
        cryptoBalanceStore,
        cryptoLookup,
        exchangeRatesLookupStore,
        i18nKey,
        lastCryptoSent,
        LEDGER_CANISTER_ICP,
        MAX_PRIZE_EXCLUDED_USERS,
        type OpenChat,
        walletTokensSorted,
    } from "@client";
    import PrizeBuilderDialog, {
        type PrizeToken,
    } from "@openchat/ui/src/features/components/PrizeBuilderDialog.svelte";
    import type { Prize, PrizeGateKind } from "@openchat/ui/src/lib/types";
    import { PrizeForm } from "@src/logic/prize/prizeForm.svelte";
    import { toastStore } from "@src/stores/toast";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import {
        composerPrize,
        prizeChoices,
        prizeDefaults,
        prizePricing,
        prizeTokens,
    } from "./builders.adapter";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "prize_builder" }>> =
        $props();

    // a prize can't require signing in again any more (#10425): the dialog's "Authenticated" isn't
    // offered
    const RESTRICTIONS: PrizeGateKind[] = ["diamond", "lifetime", "chit", "streak", "age"];

    const client = getContext<OpenChat>("client");
    const form = new PrizeForm();
    // the users remembered as excluded from the last prize (or the staged one's) are loaded to show
    // who they are
    client.getMissingUsers([
        ...form.excludedUsers,
        ...(untrack(() => dialog.editing)?.excludedUsers ?? []),
    ]);
    const exclusions = {
        search: (query: string) =>
            client
                .searchUsers(query, 20)
                .then((users) => users.map((u) => ({ id: u.userId, name: u.username }))),
        nameOf: (id: string) => $allUsersStore.get(id)?.username ?? id,
        max: MAX_PRIZE_EXCLUDED_USERS,
    };
    const editing = untrack(() => dialog.editing);
    const editedLedger =
        editing?.transfer.kind === "pending" ? editing.transfer.ledger : undefined;
    const first = editedLedger ?? lastCryptoSent.value ?? LEDGER_CANISTER_ICP;

    // the tokens held (an edited prize's too, to keep it)
    const tokens = $derived(
        prizeTokens(
            $walletTokensSorted.filter((t) => t.balance > 0n || t.ledger === editedLedger),
            $exchangeRatesLookupStore,
            first,
        ),
    );

    const ledgerOf = (symbol: string) => tokens.find((t) => t.token.symbol === symbol)?.ledger;

    const initial = $derived.by((): Prize | null => {
        const token = editedLedger === undefined ? undefined : $cryptoLookup.get(editedLedger);
        if (editing === undefined || token === undefined) return null;
        const t = (key: string, values?: Record<string, string | number>) => $_(key, { values });
        // a prize of one winner doesn't show its split: the one remembered
        return composerPrize(editing, token, t, form.distribution) ?? null;
    });

    // what the prize costs, in the token picked
    function pricing(token: PrizeToken, amount: number, winners: number) {
        const ledger = ledgerOf(token.symbol);
        const details = ledger === undefined ? undefined : $cryptoLookup.get(ledger);
        if (details === undefined) return { fees: 0, min: 0 };
        return prizePricing(details, amount, winners);
    }

    function attach(prize: Prize) {
        const ledger = ledgerOf(prize.token.symbol);
        const token = ledger === undefined ? undefined : $cryptoLookup.get(ledger);
        if (ledger !== undefined && token !== undefined) {
            form.choose(prizeChoices(prize));
            const outcome = form.attachTyped(
                dialog.context,
                token,
                $cryptoBalanceStore.get(ledger) ?? 0n,
                prize.draft.amt,
            );
            if (outcome === "attached") {
                onClose();
                return;
            }
        }
        toastStore.showFailureToast(i18nKey("builders.paymentRefused"));
    }
</script>

{#if tokens.length > 0}
    <PrizeBuilderDialog
        tokens={tokens.map((t) => t.token)}
        {initial}
        defaults={prizeDefaults(form)}
        restrictions={RESTRICTIONS}
        {exclusions}
        {pricing}
        onAttach={attach}
        {onClose} />
{:else}
    <!-- TODO(design): nothing held to fund a prize with; the dialog needs at least one token -->
    <PrizeBuilderDialog
        tokens={[{ symbol: "", mark: "", gradient: "", bal: 0, fee: 0, minPer: 0, dp: 2 }]}
        restrictions={RESTRICTIONS}
        {onClose} />
{/if}

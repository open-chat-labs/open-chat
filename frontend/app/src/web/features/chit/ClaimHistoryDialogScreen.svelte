<!-- The CHIT claim calendar (?chit=calendar; 8e, #10130), ClaimHistoryDialog: every daily claim, month by month,
     opened from the CHIT dialog ("View claim calendar") or the profile's CHIT section ("Claim history"), whose back
     arrow returns to the one that opened it. Claiming here is the CHIT dialog's claim, with its Local / UTC
     preference (the old UI's `utcMode`), and the streak insurance under it opens in its place. -->
<script lang="ts">
    import {
        chitStateStore,
        currentUserStore,
        dailyChitClaimable,
        latestSuccessfulUpdatesLoop,
        streakInsuranceStore,
        type OpenChat,
    } from "@client";
    import ClaimHistoryDialog from "@openchat/ui/src/features/components/ClaimHistoryDialog.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { disableChit, utcMode } from "@src/stores/settings";
    import { now500 } from "@src/stores/time";
    import { getContext, onMount } from "svelte";
    import type { DialogProps, LinkedDialog } from "../app/dialogs";
    import { behindDialog, canGoBack, goBack, openFromDialog } from "../app/linkedDialogs.svelte";
    import { calendarDay } from "@src/logic/chit/claimDays";
    import { ClaimHistory } from "@src/logic/chit/claimHistory.svelte";
    import { chitDialogProps } from "./chit.adapter";

    let { onClose }: DialogProps<Extract<LinkedDialog, { kind: "claim_history" }>> = $props();

    const client = getContext<OpenChat>("client");

    // the streak, today's claim and the insurance, as the CHIT dialog shows them
    const chit = $derived(
        chitDialogProps(
            {
                chit: $chitStateStore,
                lastSync: $latestSuccessfulUpdatesLoop,
                disabled: $disableChit,
                now: $now500,
            },
            $streakInsuranceStore,
        ),
    );

    const joined = Number($currentUserStore.dateCreated);

    // today's claim, offered only while the last sync is recent, as the profile's calendar offered
    // it: with a stale one, today may have been claimed elsewhere already
    const claimable = $derived(
        !$disableChit &&
            dailyChitClaimable(
                $chitStateStore.nextDailyChitClaim,
                $now500,
                $latestSuccessfulUpdatesLoop,
            ),
    );

    // every claim since the account was made, loaded as it opens; claiming here is the CHIT
    // dialog's claim (the streak, balance and rail follow from the client), which shows on today at
    // once and reloads the history whatever the answer
    const history = new ClaimHistory(client, joined);
    onMount(() => history.load());

    // opened from another dialog: its back arrow returns to it, named for it
    const back = $derived(canGoBack() ? goBack : undefined);
    const backLabel = $derived(
        behindDialog()?.kind === "profile"
            ? "ui.claimHistoryDialog.backToProfile"
            : "ui.claimHistoryDialog.backToChit",
    );
</script>

{#if chit !== undefined}
    <ClaimHistoryDialog
        streak={chit.streak}
        claimHistory={history.days}
        today={calendarDay($now500)}
        joined={calendarDay(joined)}
        {claimable}
        insured={chit.insured}
        used={chit.used}
        utc={$utcMode}
        {backLabel}
        onUtcChange={(utc) => utcMode.set(utc)}
        onClaim={() => history.claim()}
        onInsurance={() => openFromDialog({ kind: "streak_insurance" })}
        onBack={back}
        {onClose} />
{:else}
    <!-- till the first sync: the user's CHIT isn't known yet -->
    <DialogShell title="ui.claimHistoryDialog.title" onBack={back} {onClose}>
        <div class="loading"><Spinner /></div>
    </DialogShell>
{/if}

<style>
    .loading {
        display: grid;
        place-items: center;
        min-height: 200px;
    }
</style>

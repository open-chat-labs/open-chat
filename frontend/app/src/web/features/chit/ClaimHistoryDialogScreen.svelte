<!-- The CHIT claim calendar (?chit=calendar; 8e, #10130), ClaimHistoryDialog: every daily claim, month by month,
     opened from the CHIT dialog ("View claim calendar") or the profile's CHIT section ("Claim history"), whose back
     arrow returns to the one that opened it. Claiming here is the CHIT dialog's claim, with its Local / UTC
     preference (the old UI's `utcMode`), and the streak insurance under it opens in its place. -->
<script lang="ts">
    import {
        chitStateStore,
        currentUserStore,
        latestSuccessfulUpdatesLoop,
        mergeChitEvents,
        ONE_DAY,
        streakInsuranceStore,
        type ChitEvent,
        type OpenChat,
    } from "@client";
    import ClaimHistoryDialog from "@openchat/ui/src/features/components/ClaimHistoryDialog.svelte";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import type { ClaimDay } from "@openchat/ui/src/features/components/ClaimCalendar.svelte";
    import { disableChit, utcMode } from "@src/stores/settings";
    import { now500 } from "@src/stores/time";
    import { getContext, onMount } from "svelte";
    import type { DialogProps, LinkedDialog } from "../app/dialogs";
    import { behindDialog, canGoBack, goBack, openFromDialog } from "../app/linkedDialogs.svelte";
    import { calendarDay, claimDays } from "../profile/profile.adapter";
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

    const joined = $derived(Number($currentUserStore.dateCreated));

    // every claim since the account was made: the calendar pages through the months itself, and a
    // claim's streak day follows from the ones before it. Loaded as it opens, and again after a claim
    // here from two days before the newest event it has: an insured day is marked after midnight, and
    // a claim reinstated, at the end of its (past) day, so either can come in older than what's
    // loaded. A load that fails leaves the calendar as it was
    const RELOAD_MARGIN_DAYS = 2;
    let chitEvents: ChitEvent[] = [];
    let claimHistory = $state<ClaimDay[]>([]);
    let run = 0;

    async function loadClaimHistory() {
        const mine = ++run;
        const newest = chitEvents.at(-1)?.timestamp;
        try {
            const events = await client.chitHistory(
                newest === undefined
                    ? BigInt(joined)
                    : newest - BigInt(RELOAD_MARGIN_DAYS * ONE_DAY),
            );
            if (mine !== run) return;
            chitEvents = mergeChitEvents(chitEvents, events);
            claimHistory = claimDays(chitEvents);
        } catch (err) {
            console.warn("Unable to load the CHIT claim history", err);
        }
    }
    onMount(loadClaimHistory);

    // the CHIT dialog's claim: the streak, balance and rail follow from the client; an already
    // claimed day just moves the countdown on
    async function claim(): Promise<void> {
        const resp = await client.claimDailyChit();
        if (resp.kind === "success") await loadClaimHistory();
    }

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
        {claimHistory}
        today={calendarDay($now500)}
        joined={calendarDay(joined)}
        claimable={chit.claimable}
        insured={chit.insured}
        used={chit.used}
        utc={$utcMode}
        {backLabel}
        onUtcChange={(utc) => utcMode.set(utc)}
        onClaim={claim}
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

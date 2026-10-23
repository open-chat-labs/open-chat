<!-- The daily CHIT (?chit), ChitDialog over the page (8d, #10130): the streak, today's claim, the
     balance, streak insurance, and the way to the CHIT settings (the profile's CHIT section) and
     the leaderboard (?hof). Claiming is as the old CHIT modal's: an already claimed day just
     moves the countdown on (the client does it). The puzzle, achievements and buying insurance
     come with the rest of 8d. -->
<script lang="ts">
    import {
        chitStateStore,
        latestSuccessfulUpdatesLoop,
        streakInsuranceStore,
        type OpenChat,
    } from "@client";
    import ChitDialog, {
        type ChitAction,
    } from "@openchat/ui/src/features/components/ChitDialog.svelte";
    import { disableChit } from "@src/stores/settings";
    import { now500 } from "@src/stores/time";
    import { getContext } from "svelte";
    import type { DialogProps, LinkedDialog } from "../app/dialogs";
    import { openLinked } from "../app/linkedDialogs";
    import { chitDialogProps } from "./chit.adapter";

    let { onClose }: DialogProps<Extract<LinkedDialog, { kind: "chit" }>> = $props();

    const client = getContext<OpenChat>("client");

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

    // the dialog shows the claim once this settles, and an error if it throws
    async function claim(): Promise<void> {
        await client.claimDailyChit();
    }

    function act(action: ChitAction) {
        switch (action) {
            case "settings":
                openLinked({ kind: "profile", section: "chit" });
                return;
            case "leaderboard":
                openLinked({ kind: "leaderboard" });
                return;
            // TODO(8d): achievements (earn), buying streak insurance and the daily puzzle; GAPS.md
        }
    }
</script>

<ChitDialog
    streak={chit.streak}
    balance={chit.balance}
    earned={chit.earned}
    daily={chit.daily}
    claimable={chit.claimable}
    milestones={chit.milestones}
    countdown={chit.countdown}
    insured={chit.insured}
    used={chit.used}
    puzzleState="off"
    onClaim={claim}
    onAction={act}
    {onClose} />

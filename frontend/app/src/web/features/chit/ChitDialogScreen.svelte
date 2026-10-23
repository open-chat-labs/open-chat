<!-- The daily CHIT (?chit), ChitDialog over the page (8d, #10130): the streak, today's claim, the
     balance, streak insurance, and the ways to the CHIT settings (the profile's CHIT section),
     the leaderboard (?hof) and the ways to earn (AchievementsDialog, over this one). Claiming is
     as the old CHIT modal's: an already claimed day just moves the countdown on (the client does
     it). The puzzle and buying insurance come with the rest of 8d. -->
<script lang="ts">
    import {
        achievementList,
        achievements,
        achievementsStore,
        chitStateStore,
        latestSuccessfulUpdatesLoop,
        streakInsuranceStore,
        type ExternalAchievement,
        type OpenChat,
    } from "@client";
    import ChitDialog, {
        type ChitAction,
    } from "@openchat/ui/src/features/components/ChitDialog.svelte";
    import { disableChit } from "@src/stores/settings";
    import { now500 } from "@src/stores/time";
    import DialogShell from "@openchat/ui/src/lib/components/DialogShell.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { getContext, onMount } from "svelte";
    import type { DialogProps, LinkedDialog } from "../app/dialogs";
    import { openLinked } from "../app/linkedDialogs";
    import { achievementsCount, chitDialogProps } from "./chit.adapter";

    let { onClose, dialogs }: DialogProps<Extract<LinkedDialog, { kind: "chit" }>> = $props();

    const client = getContext<OpenChat>("client");

    // the "Ways to earn" count: the partners' achievements are loaded as it opens
    let external = $state<ExternalAchievement[]>([]);
    onMount(async () => {
        external = await client.getExternalAchievements();
    });
    const earn = $derived(
        achievementsCount(achievementList(achievements, $achievementsStore, external, $now500)),
    );

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

    // the dialog shows the claim once this settles, and an error if it throws; claimed already
    // (on another device, or before the dialog knew) is nothing claimed: no claim plays, and the
    // client moves the countdown on
    async function claim(): Promise<boolean> {
        const resp = await client.claimDailyChit();
        return resp.kind === "success";
    }

    function act(action: ChitAction) {
        switch (action) {
            case "settings":
                openLinked({ kind: "profile", section: "chit" });
                return;
            case "leaderboard":
                openLinked({ kind: "leaderboard" });
                return;
            case "earn":
                dialogs.open({ kind: "achievements" });
                return;
            // TODO(8d): buying streak insurance and the daily puzzle; GAPS.md
        }
    }
</script>

{#if chit !== undefined}
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
        achievements={earn}
        puzzleState="off"
        onClaim={claim}
        onAction={act}
        {onClose} />
{:else}
    <!-- till the first sync: the user's CHIT isn't known yet -->
    <DialogShell title="ui.chitDialog.title" {onClose}>
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

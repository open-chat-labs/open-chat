<!-- The daily CHIT (?chit), ChitDialog over the page (8d, #10130): the streak, today's claim, the
     balance, and the ways to the CHIT settings (the profile's CHIT section), the leaderboard
     (?hof), the ways to earn (?chit=earn) and buying streak insurance (?chit=insurance), each
     opened in its place over the same backdrop. Claiming is as the old CHIT modal's: an already
     claimed day just moves the countdown on (the client does it). The puzzle comes with the rest
     of 8d. -->
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
    import { loadExternalAchievements, type Loaded } from "./externalAchievements";

    let { onClose }: DialogProps<Extract<LinkedDialog, { kind: "chit" }>> = $props();

    const client = getContext<OpenChat>("client");

    // the "Ways to earn" count: the partners' achievements are loaded as it opens
    // (and passed on to the ways to earn, which needn't load them again); which are still open is
    // worked out when they're loaded
    let external = $state<Loaded<ExternalAchievement[]>>();
    onMount(async () => {
        external = await loadExternalAchievements(client);
    });
    const earn = $derived(
        achievementsCount(
            achievementList(
                achievements,
                $achievementsStore,
                external?.value ?? [],
                external?.at ?? Date.now(),
            ),
        ),
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
                openLinked({ kind: "achievements" });
                return;
            case "insurance":
                openLinked({ kind: "streak_insurance" });
                return;
            // TODO(8d): the daily puzzle; GAPS.md
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

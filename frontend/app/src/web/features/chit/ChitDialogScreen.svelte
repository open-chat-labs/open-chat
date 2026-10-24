<!-- The daily CHIT (?chit), ChitDialog over the page (8d, #10130): the streak, today's claim, the
     balance, and the ways to the CHIT settings (the profile's CHIT section), the leaderboard
     (?hof), the ways to earn (?chit=earn) and buying streak insurance (?chit=insurance), each
     opened in its place over the same backdrop, as is today's puzzle (?chit=puzzle). Claiming is
     as the old CHIT modal's: an already claimed day just moves the countdown on (the client does
     it); a claim made bursts confetti (ChitDialog's own). -->
<script lang="ts">
    import {
        achievementList,
        achievements,
        achievementsStore,
        chitStateStore,
        dailyPuzzleStore,
        latestSuccessfulUpdatesLoop,
        streakInsuranceStore,
        type ExternalAchievement,
        type OpenChat,
        type ResourceKey,
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
    import { canGoBack, goBack, openFromDialog } from "../app/linkedDialogs.svelte";
    import { achievementsCount, chitDialogProps } from "./chit.adapter";
    import { puzzleCardProps } from "./puzzle.adapter";
    import { playableDailyPuzzleRows } from "@src/core/dailyPuzzle/playable";
    import { interpolate } from "@src/i18n/i18n";
    import { _ } from "svelte-i18n";
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

    // today's puzzle card: the first not solved, or the last solved once all are (which opens the
    // leaderboard), or that there's none today
    const puzzle = $derived(
        puzzleCardProps(playableDailyPuzzleRows($dailyPuzzleStore), $now500, (key: ResourceKey) =>
            interpolate($_, key),
        ),
    );

    // opened from another dialog (the profile's CHIT section): its back arrow returns to it
    const back = $derived(canGoBack() ? goBack : undefined);

    function act(action: ChitAction) {
        switch (action) {
            case "settings":
                openFromDialog({ kind: "profile", section: "chit" });
                return;
            case "leaderboard":
                openFromDialog({ kind: "leaderboard" });
                return;
            case "earn":
                openFromDialog({ kind: "achievements" });
                return;
            case "insurance":
                openFromDialog({ kind: "streak_insurance" });
                return;
            case "puzzle":
                if (puzzle.opens !== undefined) openFromDialog(puzzle.opens);
                return;
            case "puzzleHow":
                openFromDialog({ kind: "puzzle", gameId: puzzle.gameId, how: true });
                return;
            // a reminder and hiding the puzzle: not offered (puzzleMenu), the app has neither
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
        puzzleState={puzzle.puzzleState}
        puzzleSub={puzzle.puzzleSub}
        puzzleTitle={puzzle.puzzleTitle}
        puzzleCountdown={puzzle.puzzleCountdown}
        puzzleMenu={["puzzleHow"]}
        onClaim={claim}
        onAction={act}
        onBack={back}
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

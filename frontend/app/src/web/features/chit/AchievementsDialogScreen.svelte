<!-- The ways to earn CHIT (?chit=earn, 8d, #10130): AchievementsDialog in the CHIT dialog's place,
     over the same backdrop, Back returning to it; or opened from an achievement's toast, that
     achievement picked out (?chit=earn:<id>). Every achievement the old "Learn to earn" lists,
     with what it pays (achievementList in @client). -->
<script lang="ts">
    import {
        achievementList,
        achievements,
        achievementsStore,
        type ExternalAchievement,
        type OpenChat,
    } from "@client";
    import AchievementsDialog from "@openchat/ui/src/features/components/AchievementsDialog.svelte";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LinkedDialog } from "../app/dialogs";
    import { backToLinked } from "../app/linkedDialogs";
    import { achievementItems } from "./chit.adapter";
    import { loadExternalAchievements, type Loaded } from "./externalAchievements";

    let { dialog, onClose }: DialogProps<Extract<LinkedDialog, { kind: "achievements" }>> =
        $props();

    const client = getContext<OpenChat>("client");

    // the partners' achievements, the CHIT dialog's load if it has just made one. Which are still
    // open (not expired) is worked out when they're loaded, not as the clock ticks. A partner's
    // achievement picked out waits for them, so the dialog can scroll to it as it opens
    let external = $state<Loaded<ExternalAchievement[]>>();
    onMount(async () => {
        external = await loadExternalAchievements(client);
    });

    const highlightsPartner = $derived(
        dialog.highlight !== undefined &&
            !(achievements as readonly string[]).includes(dialog.highlight),
    );

    const items = $derived(
        achievementItems(
            achievementList(
                achievements,
                $achievementsStore,
                external?.value ?? [],
                external?.at ?? Date.now(),
            ),
            (id) => $_(`learnToEarn.${id}`),
        ),
    );
</script>

{#if external !== undefined || !highlightsPartner}
    <AchievementsDialog
        achievements={items}
        highlight={dialog.highlight}
        onBack={() => backToLinked({ kind: "chit" })}
        {onClose} />
{/if}

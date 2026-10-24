<!-- The ways to earn CHIT (8d, #10130), AchievementsDialog over whatever opened it (the CHIT
     dialog, an achievement's toast): every achievement the old "Learn to earn" lists, with what
     it pays (achievementList in @client), the one just earned picked out. -->
<script lang="ts">
    import {
        achievementList,
        achievements,
        achievementsStore,
        type ExternalAchievement,
        type OpenChat,
    } from "@client";
    import AchievementsDialog from "@openchat/ui/src/features/components/AchievementsDialog.svelte";
    import { getContext, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, Loaded, LocalDialog } from "../app/dialogs";
    import { achievementItems } from "./chit.adapter";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "achievements" }>> = $props();

    const client = getContext<OpenChat>("client");

    // the partners' achievements: the opener's, or loaded as it opens. Which are still open (not
    // expired) is worked out when they're loaded, not as the clock ticks. A partner's achievement
    // picked out waits for them, so the dialog can scroll to it as it opens
    let external = $state<Loaded<ExternalAchievement[]> | undefined>(
        untrack(() => dialog.external),
    );
    onMount(async () => {
        if (external === undefined) {
            external = { value: await client.getExternalAchievements(), at: Date.now() };
        }
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
    <AchievementsDialog achievements={items} highlight={dialog.highlight} {onClose} />
{/if}

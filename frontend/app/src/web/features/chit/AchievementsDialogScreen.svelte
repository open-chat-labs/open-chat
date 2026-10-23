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
    import { now500 } from "@src/stores/time";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogProps, LocalDialog } from "../app/dialogs";
    import { achievementItems } from "./chit.adapter";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "achievements" }>> = $props();

    const client = getContext<OpenChat>("client");

    // the partners' achievements, loaded as it opens (the list shows without them till then)
    let external = $state<ExternalAchievement[]>([]);
    onMount(async () => {
        external = await client.getExternalAchievements();
    });

    const items = $derived(
        achievementItems(
            achievementList(achievements, $achievementsStore, external, $now500),
            (id) => $_(`learnToEarn.${id}`),
        ),
    );
</script>

<AchievementsDialog achievements={items} highlight={dialog.highlight} {onClose} />

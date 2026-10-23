<!-- An achievement just earned (the client's chitEarned), as the old UI's earned popup shows it:
     only with the popup on (chitPopup) and CHIT on, then marked seen so it doesn't come again.
     A click opens the ways to earn, the achievement picked out. The longest streak gets the flame. -->
<script lang="ts">
    import { chitEarnedSummary, subscribe, type ChitEvent, type OpenChat } from "@client";
    import AchievementToast from "@openchat/ui/src/features/components/AchievementToast.svelte";
    import { chitPopup, disableChit } from "@src/stores/settings";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import type { DialogStack } from "../../shell/dialogStack.svelte";
    import type { LocalDialog } from "../app/dialogs";

    interface Props {
        dialogs: DialogStack<LocalDialog>;
    }

    let { dialogs }: Props = $props();

    const client = getContext<OpenChat>("client");

    type Shown = { key: number; title: string; reward: number; icon: string; highlight?: string };
    let shown = $state<Shown>();
    let shownCount = 0;

    function earned(events: ChitEvent[]) {
        if (!chitPopup.value || disableChit.value) return;
        const { amount, achievements, maxStreak } = chitEarnedSummary(events);
        const first = achievements[0];
        if (first === undefined) return;
        shown = {
            key: ++shownCount,
            // text, not the app's key: the toast translates only its own
            title: first.kind === "internal" ? $_(`learnToEarn.${first.id}`) : first.name,
            reward: amount,
            icon: maxStreak ? "flame" : "trophy",
            highlight: first.kind === "internal" ? first.id : first.name,
        };
        // so it isn't announced again
        client.markAchievementsSeen();
    }

    $effect(() => subscribe("chitEarned", earned));
</script>

{#if shown !== undefined}
    <!-- the toast's anchor: centred, just above the bottom of the window -->
    <div class="anchor">
        {#key shown.key}
            <AchievementToast
                title={shown.title}
                reward={shown.reward}
                icon={shown.icon}
                onClick={() => {
                    const highlight = shown?.highlight;
                    shown = undefined;
                    dialogs.open({ kind: "achievements", highlight });
                }}
                onDone={() => (shown = undefined)} />
        {/key}
    </div>
{/if}

<style>
    .anchor {
        position: fixed;
        left: 50%;
        bottom: calc(var(--space-32) * 2);
        width: 0;
        height: 0;
        z-index: 80;
    }
</style>

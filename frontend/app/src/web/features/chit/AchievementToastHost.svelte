<!-- Achievements just earned (the client's chitEarned), as the old UI's earned popup shows them:
     only with the popup on (chitPopup) and CHIT on, marked seen as they come so they aren't
     announced again. One toast for each, in turn, with the CHIT it paid (the longest streak with
     the flame); a click opens the ways to earn, that achievement picked out. -->
<script lang="ts">
    import { chitEarnedSummary, subscribe, type ChitEvent, type OpenChat } from "@client";
    import AchievementToast from "@openchat/ui/src/features/components/AchievementToast.svelte";
    import { chitPopup, disableChit } from "@src/stores/settings";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { openLinked } from "../app/linkedDialogs.svelte";

    const client = getContext<OpenChat>("client");

    type Toast = { key: number; title: string; reward: number; icon: string; highlight: string };
    // the ones still to show, the first showing
    let queue = $state<Toast[]>([]);
    let made = 0;

    function earned(events: ChitEvent[]) {
        if (!chitPopup.value || disableChit.value) return;
        // so they aren't announced again, achievements or not
        client.markAchievementsSeen();
        const toasts = chitEarnedSummary(events).achievements.map(
            (a): Toast => ({
                key: ++made,
                // text, not the app's key: the toast translates only its own
                title: a.kind === "internal" ? $_(`learnToEarn.${a.id}`) : a.name,
                reward: a.amount,
                icon: a.kind === "internal" && a.id === "streak_365" ? "flame" : "trophy",
                highlight: a.kind === "internal" ? a.id : a.name,
            }),
        );
        queue = [...queue, ...toasts];
    }

    function open(toast: Toast) {
        // the ways to earn show them all
        queue = [];
        openLinked({ kind: "achievements", highlight: toast.highlight });
    }

    $effect(() => subscribe("chitEarned", earned));
</script>

{#if queue[0] !== undefined}
    {@const toast = queue[0]}
    <!-- the toast's anchor: centred, just above the bottom of the window -->
    <div class="anchor">
        {#key toast.key}
            <AchievementToast
                title={toast.title}
                reward={toast.reward}
                icon={toast.icon}
                onClick={() => open(toast)}
                onDone={() => (queue = queue.slice(1))} />
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

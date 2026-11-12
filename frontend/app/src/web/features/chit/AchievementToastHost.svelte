<!-- Achievements just earned (the client's chitEarned), as the old UI's earned popup shows them:
     only with the popup on (chitPopup) and CHIT on, marked seen as they come so they aren't
     announced again. One toast for each, in turn, with the CHIT it paid (the longest streak with
     the flame); a click opens the ways to earn, that achievement picked out. It plays just above
     the composer, centred in the middle panel, above the panel's bottom where there's no
     composer, and above the app's toasts while one shows, on their centre line (web/00 and
     web/13, updated 2026-11-12: shell/bottomPlacement). -->
<script lang="ts">
    import { chitEarnedSummary, subscribe, type ChitEvent, type OpenChat } from "@client";
    import AchievementToast from "@openchat/ui/src/features/components/AchievementToast.svelte";
    import { chitPopup, disableChit } from "@src/stores/settings";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { openLinked } from "../app/linkedDialogs.svelte";
    import {
        bottomAnchor,
        boxOf,
        composerPopups,
        watchBoxes,
        windowSize,
    } from "../../shell/bottomAnchors.svelte";
    import { achievementSpot, type AchievementSpot } from "../../shell/bottomPlacement";

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

    // where it plays, measured only while one shows: again as the middle panel, its composer or
    // the toasts change size (a composer growing, a right column docking, a second toast), the
    // composer opens a popup (it plays above it), the window changes size or the shell scrolls in
    // it, and as any of them comes or goes
    const showing = $derived(queue.length > 0);
    let spot = $state<AchievementSpot | undefined>();
    $effect(() => {
        if (!showing) {
            // the next one starts where it is then, not from where this one was
            spot = undefined;
            return;
        }
        const middle = bottomAnchor("middle");
        const composer = bottomAnchor("composer");
        const toasts = bottomAnchor("toasts");
        let last: AchievementSpot | undefined;
        return watchBoxes([middle, composer, toasts], composer, () => {
            // the toasts' height, not their place: they're placed by the same rule (toastSpot), so
            // this doesn't wait on them having moved
            const next = achievementSpot(
                windowSize(),
                boxOf(middle),
                boxOf(composer),
                composerPopups(composer),
                boxOf(toasts)?.height,
            );
            if (last?.x !== next.x || last?.y !== next.y) spot = last = next;
        });
    });
</script>

{#if queue[0] !== undefined && spot !== undefined}
    {@const toast = queue[0]}
    <!-- the toast's anchor: its bottom edge, centred (the toast grows up from it) -->
    <div class="anchor" style:left="{spot.x}px" style:top="{spot.y}px">
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

<style lang="scss">
    .anchor {
        position: fixed;
        width: 0;
        height: 0;
        z-index: 80;
        /* a toast coming or going under it, it rises or settles back smoothly (none with reduced
           motion, the tokens' rule); its confetti is the library's, which never takes a click */
        transition:
            top var(--duration-slow) var(--ease-out),
            left var(--duration-slow) var(--ease-out);
    }
</style>

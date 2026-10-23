<script lang="ts">
    import { disableChit } from "@src/stores/settings";
    import { userBadges, type DiamondMembershipStatus } from "@client";
    import Diamond from "../../icons/Diamond.svelte";
    import ChitEarnedBadge from "./ChitEarnedBadge.svelte";
    import Streak from "./Streak.svelte";

    interface Props {
        diamondStatus?: DiamondMembershipStatus["kind"] | undefined;
        streak?: number;
        uniquePerson?: boolean;
        chitEarned?: number;
    }

    // uniquePerson prop retained on Props for callers, but unused - the verified badge is suspended.
    let { diamondStatus = undefined, streak = 0, chitEarned = 0 }: Props = $props();

    let badges = $derived(userBadges({ diamondStatus, streak, chitEarned }, $disableChit));
</script>

<Diamond status={badges.diamond} />
<!-- Verified user (DecideAI) badge is suspended - not rendered. -->
{#if badges.chit !== undefined}
    <Streak days={badges.chit.streak} />
    <ChitEarnedBadge earned={badges.chit.earned} />
{/if}

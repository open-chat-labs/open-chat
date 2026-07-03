<script lang="ts">
    import { disableChit } from "@src/stores/settings";
    import type { DiamondMembershipStatus } from "openchat-client";
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
</script>

<Diamond status={diamondStatus} />
<!-- Verified user (DecideAI) badge is suspended - not rendered. -->
{#if !$disableChit}
    <Streak days={streak} />
    <ChitEarnedBadge earned={chitEarned} />
{/if}

<script lang="ts">
    import { disableChit } from "@src/stores/settings";
    import { Container } from "component-lib";
    import type { DiamondMembershipStatus } from "openchat-client";
    import Diamond from "../../icons/Diamond.svelte";
    import Verified from "../../icons/Verified.svelte";
    import ChitEarnedBadge from "./ChitEarnedBadge.svelte";
    import Streak from "./Streak.svelte";

    interface Props {
        diamondStatus?: DiamondMembershipStatus["kind"] | undefined;
        streak?: number;
        uniquePerson?: boolean;
        chitEarned?: number;
    }

    let {
        diamondStatus = undefined,
        streak = 0,
        uniquePerson = false,
        chitEarned = 0,
    }: Props = $props();
</script>

<Container width={"hug"} crossAxisAlignment={"center"} gap={"xs"}>
    <Diamond status={diamondStatus} />
    <Verified size={"small"} verified={uniquePerson} />
    {#if !$disableChit}
        <Streak days={streak} />
        <ChitEarnedBadge earned={chitEarned} />
    {/if}
</Container>

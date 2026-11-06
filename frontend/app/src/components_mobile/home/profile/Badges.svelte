<script lang="ts">
    import { disableChit } from "@src/stores/settings";
    import { Container } from "component-lib";
    import { userBadges, type DiamondMembershipStatus } from "@client";
    import Diamond from "../../icons/Diamond.svelte";
    import ChitEarnedBadge from "./ChitEarnedBadge.svelte";
    import Streak from "./Streak.svelte";
    import type { BadgeSize } from "./BadgeContainer.svelte";

    interface Props {
        diamondStatus?: DiamondMembershipStatus["kind"] | undefined;
        streak?: number;
        uniquePerson?: boolean;
        chitEarned?: number;
        size?: BadgeSize;
        borderColor?: string;
        forceStreakBadge?: boolean;
    }

    // uniquePerson prop retained on Props for callers, but unused - the verified badge is suspended.
    let {
        diamondStatus = undefined,
        streak = 0,
        chitEarned = 0,
        size = "default",
        borderColor,
        forceStreakBadge = false,
    }: Props = $props();

    let badges = $derived(
        userBadges({ diamondStatus, streak, chitEarned }, $disableChit && !forceStreakBadge),
    );
</script>

<Container
    supplementalClass={`badges ${size === "large" ? "large" : ""}`}
    crossAxisAlignment={"center"}
    gap={"xs"}
    width={"hug"}
    padding={["xxs", "zero"]}>
    <Diamond {size} {borderColor} status={badges.diamond} />
    <!-- Verified user (DecideAI) badge is suspended - not rendered. -->
    {#if badges.chit !== undefined}
        <Streak {size} {borderColor} days={badges.chit.streak} />
        <ChitEarnedBadge {size} {borderColor} earned={badges.chit.earned} />
    {/if}
</Container>

<style lang="scss">
    :global {
        .badges {
            overflow: visible;

            > *:not(:first-child) {
                z-index: 1;
                margin-left: -0.5rem;
            }

            &.large > *:not(:first-child) {
                margin-left: -0.65rem;
            }
        }
    }
</style>

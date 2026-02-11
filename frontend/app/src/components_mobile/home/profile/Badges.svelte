<script lang="ts">
    import { disableChit } from "@src/stores/settings";
    import { Container } from "component-lib";
    import type { DiamondMembershipStatus } from "openchat-client";
    import Diamond from "../../icons/Diamond.svelte";
    import Verified from "../../icons/Verified.svelte";
    import ChitEarnedBadge from "./ChitEarnedBadge.svelte";
    import Streak from "./Streak.svelte";
    import { type BadgeSize } from "./BadgeContainer.svelte";

    interface Props {
        diamondStatus?: DiamondMembershipStatus["kind"] | undefined;
        streak?: number;
        uniquePerson?: boolean;
        chitEarned?: number;
        size?: BadgeSize;
    }

    let {
        diamondStatus = undefined,
        streak = 0,
        uniquePerson = false,
        chitEarned = 0,
        size = "default",
    }: Props = $props();
</script>

<Container
    supplementalClass={`badges ${size === "large" ? "large" : ""}`}
    crossAxisAlignment={"center"}
    gap={"xs"}
    padding={["xxs", "zero"]}>
    <Diamond {size} status={diamondStatus} />
    <Verified {size} verified={uniquePerson} />
    {#if !$disableChit}
        <Streak {size} days={streak} />
        <ChitEarnedBadge {size} earned={chitEarned} />
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

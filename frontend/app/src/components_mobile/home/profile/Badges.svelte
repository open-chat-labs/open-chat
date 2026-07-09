<script lang="ts">
    import { disableChit } from "@src/stores/settings";
    import { ColourVars, Container } from "component-lib";
    import type { DiamondMembershipStatus } from "openchat-client";
    import Diamond from "../../icons/Diamond.svelte";
    import Verified from "../../icons/Verified.svelte";
    import ChitEarnedBadge from "./ChitEarnedBadge.svelte";
    import Streak from "./Streak.svelte";
    import BadgeContainer, { type BadgeSize } from "./BadgeContainer.svelte";
    import Fingerprint from "svelte-material-icons/Fingerprint.svelte";

    interface Props {
        diamondStatus?: DiamondMembershipStatus["kind"] | undefined;
        streak?: number;
        uniquePerson?: boolean;
        chitEarned?: number;
        withFingerprint?: boolean;
        size?: BadgeSize;
        borderColor?: string;
        forceStreakBadge?: boolean;
    }

    let {
        diamondStatus = undefined,
        streak = 0,
        uniquePerson = false,
        chitEarned = 0,
        withFingerprint = false,
        size = "default",
        borderColor,
        forceStreakBadge = false,
    }: Props = $props();
</script>

{#snippet fingerprint()}
    <BadgeContainer {borderColor} {size} backgroundColor={ColourVars.background2}>
        <Fingerprint size={size === "large" ? "1.25rem" : "0.85rem"} />
    </BadgeContainer>
{/snippet}

<Container
    supplementalClass={`badges ${size === "large" ? "large" : ""}`}
    crossAxisAlignment={"center"}
    gap={"xs"}
    width={"hug"}
    padding={["xxs", "zero"]}>
    {#if withFingerprint}
        {@render fingerprint()}
    {/if}
    <Diamond {size} {borderColor} status={diamondStatus} />
    <Verified {size} {borderColor} verified={uniquePerson} />
    {#if !$disableChit || forceStreakBadge}
        <Streak {size} {borderColor} days={streak} />
        <ChitEarnedBadge {size} {borderColor} earned={chitEarned} />
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

<script lang="ts">
    import {
        BodySmall,
        Caption,
        ColourVars,
        CommonButton,
        Container,
        H2,
        Subtitle,
    } from "component-lib";
    import { i18nKey } from "openchat-client";
    import PartyPopper from "svelte-material-icons/PartyPopper.svelte";
    import ShieldStarOutline from "svelte-material-icons/ShieldStarOutline.svelte";
    import Progress from "../../Progress.svelte";
    import Translatable from "../../Translatable.svelte";
    import Streak from "./Streak.svelte";

    interface Props {
        streak?: number;
        earned?: number;
        balance?: number;
    }

    let { streak = 0, earned = 0, balance = 0 }: Props = $props();

    function calculateBadgesVisible(streak: number): number[] {
        if (streak < 30) {
            return [3, 7, 14, 30];
        } else if (streak < 100) {
            return [14, 30, 100];
        } else {
            return [30, 100, 365];
        }
    }

    function calculatePercentage(currentStreak: number, maxBadge: number): number {
        const percent = (currentStreak / maxBadge) * 100;
        return percent > 100 ? 100 : percent;
    }

    let badgesVisible = $derived(calculateBadgesVisible(streak));
    let maxBadgeVisible = $derived(badgesVisible[badgesVisible.length - 1]);
    let percent = $derived(calculatePercentage(streak, maxBadgeVisible));
</script>

<Container padding={["xl", "lg"]} direction={"vertical"} allowOverflow>
    <Container gap={"sm"} crossAxisAlignment={"center"}>
        <Container
            supplementalClass={"streak_bubble"}
            borderRadius={"circle"}
            width={{ kind: "hug" }}
            padding={["sm", "xl"]}
            crossAxisAlignment={"center"}
            background={ColourVars.primary}
            direction={"vertical"}>
            <H2 colour={"textOnPrimary"} fontWeight={"bold"}>{streak}</H2>
            <Caption>
                <Translatable resourceKey={i18nKey("streak")}></Translatable>
            </Caption>
        </Container>
        <Container crossAxisAlignment={"center"} gap={"xs"}>
            <Subtitle width={{ kind: "hug" }} fontWeight={"bold"} colour={"primary"}
                >{`${balance.toLocaleString()} CHIT`}</Subtitle>
            <BodySmall width={{ kind: "hug" }} fontWeight={"bold"} colour={"textSecondary"}
                >{`/ ${earned.toLocaleString()} earned`}</BodySmall>
        </Container>
    </Container>
    <div class="progress">
        <Progress size={"6px"} {percent}></Progress>
    </div>
    <div class="marker" style="left: {percent}%">
        <div class="line"></div>
    </div>
    <div class="badges">
        {#each badgesVisible as badge}
            <div class="badge" style="left: {(badge * 100) / maxBadgeVisible}%">
                <Streak disabled={streak < badge} days={badge} />
            </div>
        {/each}
    </div>

    <Container mainAxisAlignment={"end"} gap={"sm"} crossAxisAlignment={"end"}>
        <CommonButton onClick={() => console.log("insurance")} size={"small_text"}>
            {#snippet icon(color)}
                <ShieldStarOutline {color}></ShieldStarOutline>
            {/snippet}
            <Translatable resourceKey={i18nKey("Streak insurance")}></Translatable>
        </CommonButton>
        <CommonButton onClick={() => console.log("claim")} size={"medium"} mode={"active"}>
            {#snippet icon(color)}
                <PartyPopper {color}></PartyPopper>
            {/snippet}
            <Translatable resourceKey={i18nKey("Claim CHIT")}></Translatable>
        </CommonButton>
    </Container>
</Container>

<div class="progress"></div>

<style lang="scss">
    :global(.container.streak_bubble h2) {
        line-height: 1rem;
    }

    .progress {
        width: 100%;
        margin-top: -6px;
        padding-inline-start: 26px;
    }

    .badges {
        position: relative;
        margin-bottom: 3rem;
        width: 100%;

        .badge {
            top: 8px;
            position: absolute;
            transform-origin: 50% 50%;
            transform: translateX(var(--offset)) scale(var(--scale));
            transition:
                filter 300ms ease-in-out,
                transform 300ms ease-in-out;

            &:hover {
                transform: translateX(var(--offset)) scale(3);
            }
        }
    }
</style>

<script lang="ts">
    import { now500 } from "@src/stores/time";
    import { toastStore } from "@src/stores/toast";
    import {
        BodySmall,
        Caption,
        ColourVars,
        CommonButton,
        Container,
        H2,
        Subtitle,
    } from "component-lib";
    import { chitStateStore, i18nKey, OpenChat } from "openchat-client";
    import { getContext } from "svelte";
    import PartyPopper from "svelte-material-icons/PartyPopper.svelte";
    import ShieldStarOutline from "svelte-material-icons/ShieldStarOutline.svelte";
    import Progress from "../../Progress.svelte";
    import Translatable from "../../Translatable.svelte";
    import StreakInsuranceBuy from "../insurance/StreakInsuranceBuy.svelte";
    import Streak from "./Streak.svelte";

    const client = getContext<OpenChat>("client");

    type Mode = "edit" | "view";

    interface Props {
        mode?: Mode;
        streak?: number;
        earned?: number;
        balance?: number;
        insuranceLink?: boolean;
    }

    let {
        mode = "edit",
        streak = 0,
        earned = 0,
        balance = 0,
        insuranceLink = true,
    }: Props = $props();

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
    let claimChitAvailable = $derived($chitStateStore.nextDailyChitClaim < $now500);
    let remaining = $derived(
        client.formatTimeRemaining($now500, Number($chitStateStore.nextDailyChitClaim), true),
    );
    let showInsurance = $state(false);
    let busy = $state(false);

    function claim() {
        busy = true;
        client
            .claimDailyChit()
            .then((resp) => {
                if (resp.kind !== "success") {
                    toastStore.showFailureToast(i18nKey("dailyChit.failedToClaim"), resp);
                }
            })
            .catch((err) => {
                toastStore.showFailureToast(
                    i18nKey("dailyChit.failedToClaim"),
                    JSON.stringify(err),
                );
            })
            .finally(() => {
                busy = false;
            });
    }
</script>

{#if showInsurance}
    <StreakInsuranceBuy onClose={() => (showInsurance = false)} />
{/if}

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

{#if mode === "edit"}
    <Container mainAxisAlignment={"end"} gap={"sm"} crossAxisAlignment={"end"}>
        {#if insuranceLink}
            <CommonButton onClick={() => (showInsurance = true)} size={"small_text"}>
                {#snippet icon(color)}
                    <ShieldStarOutline {color}></ShieldStarOutline>
                {/snippet}
                <Translatable resourceKey={i18nKey("Streak insurance")}></Translatable>
            </CommonButton>
        {/if}
        <CommonButton
            disabled={!claimChitAvailable}
            loading={busy}
            onClick={claim}
            size={"medium"}
            mode={"active"}>
            {#snippet icon(color)}
                <PartyPopper {color}></PartyPopper>
            {/snippet}
            {#if claimChitAvailable}
                <Translatable resourceKey={i18nKey("Claim CHIT")}></Translatable>
            {:else}
                <Translatable resourceKey={i18nKey("dailyChit.comeback", { time: remaining })} />
            {/if}
        </CommonButton>
    </Container>
{/if}

<style lang="scss">
    :global(.container.streak_bubble h2) {
        line-height: 1rem;
    }

    :global(.container.streak_bubble) {
        z-index: 1;
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
        z-index: 2;

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

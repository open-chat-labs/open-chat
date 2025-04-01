<script lang="ts">
    import Button from "@src/components/Button.svelte";
    import InfoIcon from "@src/components/InfoIcon.svelte";
    import Legend from "@src/components/Legend.svelte";
    import Translatable from "@src/components/Translatable.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import { streakInsuranceStore } from "openchat-client";
    import StreakInsuranceBuy from "./StreakInsuranceBuy.svelte";

    const remaining = $derived(
        $streakInsuranceStore.daysInsured - $streakInsuranceStore.daysMissed,
    );
    let buy = $state(false);
</script>

{#if buy}
    <StreakInsuranceBuy onClose={() => (buy = false)} />
{/if}

{#if remaining > 0}
    <div class="title">
        <Translatable
            resourceKey={i18nKey(
                "You have {remaining} remaining day(s) of streak insurance. Click Top Up to buy more.",
                { remaining },
            )} />
    </div>
{:else}
    <div class="title">
        <Legend large label={i18nKey("Your streak is at risk!")}></Legend>
        <InfoIcon align={"middle"}>
            <Translatable
                resourceKey={i18nKey(
                    "You can insure your streak by choosing a number of days to protect. The price in CHAT doubles for each day you choose to insure so you still need to be careful!",
                )} />
        </InfoIcon>
    </div>
    <div class="info">
        <Translatable
            resourceKey={i18nKey(
                "To protect your streak you can pay a fee to give yourself a safety net in case you accidentally miss the odd day for any reason.",
            )} />
    </div>
{/if}

{#if $streakInsuranceStore.daysMissed > 0}
    <div class="info">
        <Translatable
            resourceKey={i18nKey(
                "Your streak insurance has protected you from {missed} missed day(s) so far!",
                { missed: $streakInsuranceStore.daysMissed },
            )}>
        </Translatable>
    </div>
{/if}

<Button onClick={() => (buy = true)}>
    <Translatable resourceKey={i18nKey("Top up")}></Translatable>
</Button>

<style lang="scss">
    .info {
        @include font(book, normal, fs-80);
        color: var(--txt-light);
        margin-bottom: $sp4;
    }

    .title {
        display: flex;
        gap: $sp1;
        align-items: center;
        margin-bottom: $sp3;
    }
</style>

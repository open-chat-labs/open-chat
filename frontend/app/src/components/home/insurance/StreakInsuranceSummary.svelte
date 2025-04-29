<script lang="ts">
    import Button from "@src/components/Button.svelte";
    import InfoIcon from "@src/components/InfoIcon.svelte";
    import Legend from "@src/components/Legend.svelte";
    import Translatable from "@src/components/Translatable.svelte";
    import { i18nKey } from "@src/i18n/i18n";
    import { app } from "openchat-client";
    import StreakInsuranceBuy from "./StreakInsuranceBuy.svelte";

    const remaining = $derived(app.streakInsurance.daysInsured - app.streakInsurance.daysMissed);
    let buy = $state(false);
</script>

{#if buy}
    <StreakInsuranceBuy onClose={() => (buy = false)} />
{/if}

{#if remaining > 0}
    <div class="title">
        <Translatable resourceKey={i18nKey("streakInsurance.remainingAdvice", { remaining })} />
    </div>
{:else}
    <div class="title">
        <Legend large label={i18nKey("streakInsurance.atRisk")}></Legend>
        <InfoIcon align={"middle"}>
            <Translatable resourceKey={i18nKey("streakInsurance.infoPopup")} />
        </InfoIcon>
    </div>
    <div class="info">
        <Translatable resourceKey={i18nKey("streakInsurance.info")} />
    </div>
{/if}

{#if app.streakInsurance.daysMissed > 0}
    <div class="info">
        <Translatable
            resourceKey={i18nKey("streakInsurance.protected", {
                missed: app.streakInsurance.daysMissed,
            })}>
        </Translatable>
    </div>
{/if}

<Button onClick={() => (buy = true)}>
    <Translatable resourceKey={i18nKey("streakInsurance.topUpButton")}></Translatable>
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

<script lang="ts">
    import {
        ColourVars,
        Container,
        SectionHeader,
        Sheet,
        type SwipeDirection,
    } from "component-lib";
    import { canExtendDiamondStore, isDiamondStore, publish } from "openchat-client";
    import { onMount } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import Features from "./Features.svelte";
    import Payment from "./Payment.svelte";

    let showPayment = $state(false);

    onMount(() => {
        if ($canExtendDiamondStore) {
            showPayment = true;
        }
    });

    function onCancel() {
        publish("closeModalPage");
    }

    let titleKey = $derived.by(() => {
        if ($canExtendDiamondStore) {
            return i18nKey("upgrade.extend");
        } else if ($isDiamondStore) {
            return i18nKey("upgrade.benefits");
        } else {
            return i18nKey("upgrade.featuresTitle");
        }
    });

    let onSwipe = $derived((dir: SwipeDirection) => {
        if (dir === "right") {
            onCancel();
        }
    });
</script>

<Container {onSwipe} background={ColourVars.background0} height={"fill"} direction={"vertical"}>
    <SectionHeader onBack={onCancel}>
        {#snippet title()}
            <Translatable resourceKey={titleKey} />
        {/snippet}
    </SectionHeader>
    <Container height={"fill"} direction={"vertical"}>
        <Features
            canExtend={$canExtendDiamondStore}
            isDiamond={$isDiamondStore}
            {onCancel}
            onUpgrade={() => (showPayment = true)} />
    </Container>
</Container>

{#if showPayment}
    <Sheet onDismiss={() => (showPayment = false)}>
        <Payment onSuccess={() => publish("closeModalStack")} />
    </Sheet>
{/if}

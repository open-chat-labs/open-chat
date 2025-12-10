<script lang="ts">
    import {
        ColourVars,
        Container,
        SectionHeader,
        transition,
        type SwipeDirection,
    } from "component-lib";
    import {
        LEDGER_CANISTER_CHAT,
        LEDGER_CANISTER_ICP,
        canExtendDiamondStore,
        cryptoBalanceStore,
        cryptoLookup,
        isDiamondStore,
        publish,
    } from "openchat-client";
    import { onMount } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import CryptoSelector from "../CryptoSelector.svelte";
    import Features from "./Features.svelte";
    import Payment from "./Payment.svelte";

    let ledger: string = $state(
        import.meta.env.OC_NODE_ENV === "production" ? LEDGER_CANISTER_CHAT : LEDGER_CANISTER_ICP,
    );

    let step: "features" | "payment" = $state("features");
    let error: string | undefined = $state();
    let confirming = $state(false);
    let confirmed = $state(false);
    let refreshingBalance = $state(false);

    let tokenDetails = $derived({
        token: $cryptoLookup.get(ledger),
        balance: $cryptoBalanceStore.get(ledger) ?? BigInt(0),
    });

    function onBalanceRefreshed() {
        error = undefined;
    }

    function onBalanceRefreshError(err: string) {
        error = err;
    }

    function setStep(s: "features" | "payment") {
        transition(["fade"], () => {
            step = s;
        });
    }

    onMount(() => {
        if ($canExtendDiamondStore) {
            setStep("payment");
        }
    });

    function onCancel() {
        if (step === "payment") {
            setStep("features");
        } else {
            publish("closeModalPage");
        }
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
            {#if step === "features"}
                <Translatable resourceKey={titleKey} />
            {:else}
                {@const token = tokenDetails.token}
                {#if token}
                    <CryptoSelector
                        bind:ledger
                        filter={(t) => ["chat", "icp"].includes(t.symbol.toLowerCase())} />
                {/if}
            {/if}
        {/snippet}
        {#if step === "payment"}
            <div class="balance">
                <BalanceWithRefresh
                    {ledger}
                    value={tokenDetails.balance}
                    bind:refreshing={refreshingBalance}
                    onRefreshed={onBalanceRefreshed}
                    onError={onBalanceRefreshError} />
            </div>
        {/if}
    </SectionHeader>
    <Container height={"fill"} direction={"vertical"}>
        {#if step === "features"}
            <Features
                canExtend={$canExtendDiamondStore}
                isDiamond={$isDiamondStore}
                {onCancel}
                onUpgrade={() => setStep("payment")} />
        {/if}
        {#if step === "payment"}
            <Payment
                bind:confirmed
                bind:confirming
                bind:refreshingBalance
                {ledger}
                {error}
                accountBalance={Number(tokenDetails.balance)} />
        {/if}
    </Container>
</Container>

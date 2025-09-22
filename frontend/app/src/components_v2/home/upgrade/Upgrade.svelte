<script lang="ts">
    import {
        LEDGER_CANISTER_CHAT,
        LEDGER_CANISTER_ICP,
        canExtendDiamondStore,
        cryptoBalanceStore,
        cryptoLookup,
        isDiamondStore,
    } from "openchat-client";
    import { onMount } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Diamond from "../../icons/Diamond.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
    import Translatable from "../../Translatable.svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import CryptoSelector from "../CryptoSelector.svelte";
    import Features from "./Features.svelte";
    import Payment from "./Payment.svelte";

    interface Props {
        onCancel: () => void;
    }

    let { onCancel }: Props = $props();

    let ledger: string = $state(
        import.meta.env.OC_NODE_ENV === "production" ? LEDGER_CANISTER_CHAT : LEDGER_CANISTER_ICP,
    );

    let step: "features" | "payment" = $state("features");
    let error: string | undefined = $state();
    let confirming = $state(false);
    let confirmed = $state(false);
    let refreshingBalance = $state(false);

    let tokenDetails = $derived({
        symbol: $cryptoLookup.get(ledger),
        balance: $cryptoBalanceStore.get(ledger) ?? BigInt(0),
    });

    function onBalanceRefreshed() {
        error = undefined;
    }

    function onBalanceRefreshError(err: string) {
        error = err;
    }

    onMount(() => {
        if ($canExtendDiamondStore) {
            step = "payment";
        }
    });
</script>

<Overlay>
    <ModalContent overflows={step === "features"} hideFooter fill>
        {#snippet header()}
            <div class="header">
                {#if !confirming && !confirmed}
                    <div class="title">
                        <Diamond size={"1em"} show={"blue"} />
                        {#if step === "features"}
                            {#if $canExtendDiamondStore}
                                <Translatable resourceKey={i18nKey("upgrade.extend")} />
                            {:else if $isDiamondStore}
                                <Translatable resourceKey={i18nKey("upgrade.benefits")} />
                            {:else}
                                <Translatable resourceKey={i18nKey("upgrade.featuresTitle")} />
                            {/if}
                        {:else if step === "payment"}
                            <div>
                                <CryptoSelector
                                    bind:ledger
                                    filter={(t) =>
                                        ["chat", "icp"].includes(t.symbol.toLowerCase())} />
                            </div>
                        {/if}
                    </div>
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
                {/if}
            </div>
        {/snippet}
        {#snippet body()}
            <div class="body">
                {#if step === "features"}
                    <Features
                        canExtend={$canExtendDiamondStore}
                        isDiamond={$isDiamondStore}
                        {onCancel}
                        onUpgrade={() => (step = "payment")} />
                {/if}
                {#if step === "payment"}
                    <Payment
                        bind:confirmed
                        bind:confirming
                        bind:refreshingBalance
                        {ledger}
                        {error}
                        accountBalance={Number(tokenDetails.balance)}
                        {onCancel}
                        onFeatures={() => (step = "features")} />
                {/if}
            </div>
        {/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }

    .body {
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    .title {
        display: flex;
        align-items: center;
        gap: $sp3;
    }
</style>

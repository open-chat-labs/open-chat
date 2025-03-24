<script lang="ts">
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Features from "./Features.svelte";
    import Payment from "./Payment.svelte";
    import {
        LEDGER_CANISTER_CHAT,
        LEDGER_CANISTER_ICP,
        isDiamond,
        canExtendDiamond,
        cryptoBalance,
        cryptoLookup,
    } from "openchat-client";
    import { onMount } from "svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import Diamond from "../../icons/Diamond.svelte";
    import CryptoSelector from "../CryptoSelector.svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    let ledger: string = $state(
        import.meta.env.OC_NODE_ENV === "production" ? LEDGER_CANISTER_CHAT : LEDGER_CANISTER_ICP,
    );

    let step: "features" | "payment" = $state("features");
    let error: string | undefined = $state();
    let confirming = $state(false);
    let confirmed = $state(false);
    let refreshingBalance = $state(false);

    let tokenDetails = $derived({
        symbol: $cryptoLookup[ledger],
        balance: $cryptoBalance[ledger] ?? BigInt(0),
    });

    function onBalanceRefreshed() {
        error = undefined;
    }

    function onBalanceRefreshError(ev: CustomEvent<string>) {
        error = ev.detail;
    }

    onMount(() => {
        if ($canExtendDiamond) {
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
                            {#if $canExtendDiamond}
                                <Translatable resourceKey={i18nKey("upgrade.extend")} />
                            {:else if $isDiamond}
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
                                on:refreshed={onBalanceRefreshed}
                                on:error={onBalanceRefreshError} />
                        </div>
                    {/if}
                {/if}
            </div>
        {/snippet}
        {#snippet body()}
            <div class="body">
                {#if step === "features"}
                    <Features
                        canExtend={$canExtendDiamond}
                        isDiamond={$isDiamond}
                        on:cancel
                        on:upgrade={() => (step = "payment")} />
                {/if}
                {#if step === "payment"}
                    <Payment
                        bind:confirmed
                        bind:confirming
                        bind:refreshingBalance
                        {ledger}
                        {error}
                        accountBalance={Number(tokenDetails.balance)}
                        on:cancel
                        on:features={() => (step = "features")} />
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

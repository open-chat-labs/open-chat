<script lang="ts">
    import {
        LEDGER_CANISTER_CHAT,
        LEDGER_CANISTER_ICP,
        type Level,
        cryptoBalanceStore,
        cryptoLookup,
    } from "openchat-client";
    import { i18nKey } from "../../../i18n/i18n";
    import Diamond from "../../icons/Diamond.svelte";
    import Translatable from "../../Translatable.svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import CryptoSelector from "../CryptoSelector.svelte";
    import Payment from "../upgrade/Payment.svelte";

    interface Props {
        lifetime: boolean;
        level: Level;
        onCancel: () => void;
        onCredentialReceived: (cred: string) => void;
    }

    let { lifetime, level, onCancel, onCredentialReceived }: Props = $props();

    let refreshingBalance = $state(false);
    let error: string | undefined = $state();
    let confirming = $state(false);
    let confirmed = $state(false);

    let ledger: string = $state(
        import.meta.env.OC_NODE_ENV === "production" ? LEDGER_CANISTER_CHAT : LEDGER_CANISTER_ICP,
    );

    function onBalanceRefreshed() {
        error = undefined;
    }

    function onBalanceRefreshError(err: string) {
        error = err;
    }
    let tokenDetails = $derived({
        symbol: $cryptoLookup.get(ledger),
        balance: $cryptoBalanceStore.get(ledger) ?? 0n,
    });
</script>

<div class="header">
    <div class="title-and-icon">
        <Diamond size={"1em"} show={lifetime ? "gold" : "blue"} />
        <div>
            <CryptoSelector
                bind:ledger
                filter={(t) => ["chat", "icp"].includes(t.symbol.toLowerCase())} />
        </div>
    </div>
    <div class="balance">
        <BalanceWithRefresh
            {ledger}
            value={tokenDetails.balance}
            bind:refreshing={refreshingBalance}
            onRefreshed={onBalanceRefreshed}
            onError={onBalanceRefreshError} />
    </div>
</div>
<div>
    {#if !confirming}
        <p class="para">
            {#if lifetime}
                <Translatable
                    resourceKey={i18nKey(
                        "access.lifetimeDiamondGateInfo2",
                        undefined,
                        level,
                        true,
                    )} />
            {:else}
                <Translatable
                    resourceKey={i18nKey("access.diamondGateInfo2", undefined, level, true)} />
            {/if}
        </p>
    {/if}

    <Payment
        bind:confirmed
        bind:confirming
        bind:refreshingBalance
        {ledger}
        {error}
        allowBack={false}
        {lifetime}
        showExpiry={false}
        padded={false}
        accountBalance={Number(tokenDetails.balance)}
        onSuccess={onCredentialReceived}
        {onCancel} />
</div>

<style lang="scss">
    .header {
        @include font(bold, normal, fs-130, 29);
        margin-bottom: $sp4;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: $sp2;
    }

    .title-and-icon {
        display: flex;
        align-items: center;
        gap: $sp3;
    }

    .para {
        margin-bottom: $sp4;
    }

    .error {
        margin-top: $sp4;
    }
</style>

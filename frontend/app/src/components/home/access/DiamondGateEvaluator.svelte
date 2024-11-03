<script lang="ts">
    import {
        LEDGER_CANISTER_CHAT,
        LEDGER_CANISTER_ICP,
        type Level,
        cryptoBalance,
        cryptoLookup,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Diamond from "../../icons/Diamond.svelte";
    import CryptoSelector from "../CryptoSelector.svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import Payment from "../upgrade/Payment.svelte";
    import { createEventDispatcher } from "svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    const dispatch = createEventDispatcher();

    export let lifetime: boolean;
    export let level: Level;

    let refreshingBalance = false;
    let error: string | undefined;
    let confirming = false;
    let confirmed = false;

    $: tokenDetails = {
        symbol: $cryptoLookup[ledger],
        balance: $cryptoBalance[ledger] ?? BigInt(0),
    };

    let ledger: string =
        process.env.NODE_ENV === "production" ? LEDGER_CANISTER_CHAT : LEDGER_CANISTER_ICP;

    function onBalanceRefreshed() {
        error = undefined;
    }

    function onBalanceRefreshError(ev: CustomEvent<string>) {
        error = ev.detail;
    }
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
            on:refreshed={onBalanceRefreshed}
            on:error={onBalanceRefreshError} />
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
        on:success={(ev) => dispatch("credentialReceived", ev.detail)}
        on:cancel />
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

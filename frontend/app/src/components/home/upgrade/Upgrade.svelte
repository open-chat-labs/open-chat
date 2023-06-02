<script lang="ts">
    import { _ } from "svelte-i18n";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Features from "./Features.svelte";
    import Payment from "./Payment.svelte";
    import { Cryptocurrency, cryptoLookup, OpenChat } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";

    const client = getContext<OpenChat>("client");
    const token: Cryptocurrency = "icp";

    let step: "features" | "payment" = "features";
    let error: string | undefined;
    let confirming = false;
    let confirmed = false;
    let refreshingBalance = false;

    $: isDiamond = client.isDiamond;
    $: canExtendDiamond = client.canExtendDiamond;
    $: cryptoBalance = client.cryptoBalance;
    $: tokenDetails = {
        key: token,
        symbol: cryptoLookup[token].symbol,
        balance: $cryptoBalance[token],
        disabled: cryptoLookup[token].disabled,
    };

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
    <ModalContent overflows hideFooter fill>
        <div class="header" slot="header">
            {#if !confirming && !confirmed}
                <div class="title">
                    {#if step === "features"}
                        {#if $canExtendDiamond}
                            {$_("upgrade.extend")}
                        {:else if $isDiamond}
                            {$_("upgrade.benefits")}
                        {:else}
                            {$_("upgrade.featuresTitle")}
                        {/if}
                    {:else if step === "payment"}
                        {$_("upgrade.paymentTitle")}
                    {/if}
                </div>
                {#if step === "payment"}
                    <div class="balance">
                        <BalanceWithRefresh
                            token={tokenDetails.key}
                            value={tokenDetails.balance}
                            bind:refreshing={refreshingBalance}
                            on:refreshed={onBalanceRefreshed}
                            on:error={onBalanceRefreshError} />
                    </div>
                {/if}
            {/if}
        </div>
        <div class="body" slot="body">
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
                    {error}
                    accountBalance={Number(tokenDetails.balance)}
                    on:cancel
                    on:features={() => (step = "features")} />
            {/if}
        </div>
    </ModalContent>
</Overlay>

<style type="text/scss">
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
</style>

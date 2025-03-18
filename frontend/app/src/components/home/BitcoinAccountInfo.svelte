<script lang="ts">
    import QRCode from "../QRCode.svelte";
    import { BTC_SYMBOL, CKBTC_SYMBOL, OpenChat } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import TruncatedAccount from "./TruncatedAccount.svelte";
    import MultiToggle from "@components/MultiToggle.svelte";
    import { getContext } from "svelte";

    type Props = {
        userId: string;
        qrSize?: "default" | "smaller" | "larger",
        centered?: boolean;
        border?: boolean;
        fullWidthOnMobile?: boolean;
    }

    let {
        userId,
        qrSize = "default",
        centered = false,
        border = true,
        fullWidthOnMobile = false,
    }: Props = $props();

    const client = getContext<OpenChat>("client");
    const networkOptions = [BTC_SYMBOL, CKBTC_SYMBOL].map((n) => ({ id: n, label: n }));

    let btcAddress: string | undefined = $state();
    let selectedNetwork = $state(BTC_SYMBOL);
    let account = $derived(selectedNetwork === BTC_SYMBOL ? btcAddress : userId);
    let error = $state();
    let logo = $derived(selectedNetwork === BTC_SYMBOL
        ? "/assets/btc_logo.svg"
        : "/assets/ckbtc_nobackground.svg");

    $effect(() => {
        client.getBtcAddress().then((addr) => btcAddress = addr).catch((e) => error = e);
    });
</script>

<div class="account-info">
    <div class="network-selector">Network: <MultiToggle options={networkOptions} bind:selected={selectedNetwork} /></div>
    {#if account === undefined}
        <div class="generating">
            {#if error !== undefined}
                <div class="error-icon"></div>
            {:else}
                <div class="spinner"></div>
            {/if}
        </div>
    {:else}
        <QRCode {fullWidthOnMobile} text={account} size={qrSize} {logo} {border} />
    {/if}
    <p class="your-account" class:centered>
        <Translatable resourceKey={i18nKey("tokenTransfer.yourAccount", { token: selectedNetwork })} />
    </p>
    {#if account === undefined}
        {#if error !== undefined}
            <span class="error-label">{$_("cryptoAccount.failedToGenerateAddress")}</span>
        {:else}
            <span class="label">{$_("generating")}</span>
        {/if}
    {:else}
        <TruncatedAccount {centered} {account} />
    {/if}

</div>

<style lang="scss">
    .centered {
        text-align: center;
    }

    .account-info {
        display: flex;
        flex-direction: column;
        margin-bottom: $sp4;
        align-items: center;
    }

    .your-account {
        margin-top: $sp4;
    }

    .network-selector {
        display: flex;
        gap: $sp3;
        margin-bottom: $sp4;
        align-items: center;
    }

    .generating {
        height: 298px;
        width: 298px;
        border: 1px solid var(--bd);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .spinner {
        @include loading-spinner(4rem, 2rem, var(--button-spinner), "/assets/spinner.svg");
        flex: 0 0 toRem(24);
    }

    .label {
        color: var(--unread-mute-txt);
    }

    .error-icon {
        background-image: url("/assets/dead-bot.svg");
        height: 4rem;
        width: 4rem;
    }

    .error-label {
        color: var(--error);
    }
</style>

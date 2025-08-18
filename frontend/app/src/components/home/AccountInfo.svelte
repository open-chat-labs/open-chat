<script lang="ts">
    import {
        BTC_SYMBOL,
        cryptoLookup,
        currentUserIdStore,
        currentUserStore,
        ICP_SYMBOL,
    } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import QRCode from "../QRCode.svelte";
    import Translatable from "../Translatable.svelte";
    import TruncatedAccount from "./TruncatedAccount.svelte";
    import BitcoinAccountInfo from "@components/home/BitcoinAccountInfo.svelte";

    interface Props {
        qrSize?: "default" | "smaller" | "larger";
        ledger: string;
        centered?: boolean;
        border?: boolean;
        fullWidthOnMobile?: boolean;
    }

    let {
        qrSize = "default",
        ledger,
        centered = false,
        border = true,
        fullWidthOnMobile = false,
    }: Props = $props();

    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    let account = $derived(
        tokenDetails.symbol === ICP_SYMBOL ? $currentUserStore.cryptoAccount : $currentUserIdStore,
    );
    let symbol = $derived(tokenDetails.symbol);
</script>

{#if symbol === BTC_SYMBOL}
    <BitcoinAccountInfo {qrSize} {centered} {border} {fullWidthOnMobile} />
{:else}
    <div class="account-info">
        <QRCode {fullWidthOnMobile} text={account} size={qrSize} logo={tokenDetails.logo} {border} />
        <p class="your-account" class:centered>
            <Translatable resourceKey={i18nKey("tokenTransfer.yourAccount", { token: symbol })} />
        </p>
        <TruncatedAccount {centered} {account} />
    </div>
{/if}

<style lang="scss">
    .centered {
        text-align: center;
    }

    .account-info {
        display: flex;
        flex-direction: column;
        margin-bottom: $sp4;
    }

    .your-account {
        margin-top: $sp4;
    }
</style>

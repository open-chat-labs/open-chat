<script lang="ts">
    import QRCode from "../QRCode.svelte";
    import type { CreatedUser } from "openchat-client";
    import { ICP_SYMBOL } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import TruncatedAccount from "./TruncatedAccount.svelte";
    import { cryptoLookup } from "openchat-client";

    export let user: CreatedUser;
    export let qrSize: "default" | "smaller" | "larger" = "default";
    export let ledger: string;
    export let centered = false;
    export let border = true;
    export let fullWidthOnMobile: boolean = false;

    $: tokenDetails = $cryptoLookup[ledger];
    $: account = tokenDetails.symbol === ICP_SYMBOL ? user.cryptoAccount : user.userId;
    $: symbol = tokenDetails.symbol;
</script>

<div class="account-info">
    <QRCode {fullWidthOnMobile} text={account} size={qrSize} logo={tokenDetails.logo} {border} />
    <p class="your-account" class:centered>
        <Translatable resourceKey={i18nKey("tokenTransfer.yourAccount", { token: symbol })} />
    </p>
    <TruncatedAccount {centered} {account} />
</div>

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

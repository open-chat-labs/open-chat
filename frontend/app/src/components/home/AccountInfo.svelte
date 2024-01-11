<script lang="ts">
    import { _ } from "svelte-i18n";
    import QRCode from "../QRCode.svelte";
    import { toastStore } from "../../stores/toast";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import { iconSize } from "../../stores/iconSize";
    import type { CreatedUser, OpenChat } from "openchat-client";
    import { ICP_SYMBOL } from "openchat-client";
    import { copyToClipboard } from "../../utils/urls";
    import { getContext } from "svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    export let user: CreatedUser;
    export let qrSize: "default" | "smaller" | "larger" = "default";
    export let ledger: string;
    export let centered = false;
    export let border = true;
    export let fullWidthOnMobile: boolean = false;

    $: cryptoLookup = client.cryptoLookup;
    $: tokenDetails = $cryptoLookup[ledger];
    $: account = tokenDetails.symbol === ICP_SYMBOL ? user.cryptoAccount : user.userId;
    $: symbol = tokenDetails.symbol;

    function collapseAccount(account: string) {
        if (account.length > 23) {
            return account.slice(0, 10) + "..." + account.slice(account.length - 10);
        }
        return account;
    }

    function copy() {
        copyToClipboard(account).then((success) => {
            if (success) {
                toastStore.showSuccessToast(i18nKey("copiedToClipboard"));
            } else {
                toastStore.showFailureToast(
                    i18nKey("failedToCopyToClipboard", {
                        account,
                    }),
                );
            }
        });
    }
</script>

<div class="account-info">
    <QRCode {fullWidthOnMobile} text={account} size={qrSize} logo={tokenDetails.logo} {border} />
    <p class="your-account" class:centered>
        <Translatable resourceKey={i18nKey("tokenTransfer.yourAccount", { token: symbol })} />
    </p>
    <div class="receiver" class:centered>
        <div class="account">
            {collapseAccount(account)}
        </div>
        <div class="copy" title={$_("copyToClipboard")} on:click={copy}>
            <ContentCopy size={$iconSize} color={"var(--icon-txt)"} />
        </div>
    </div>
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

    .receiver {
        display: flex;
        align-items: center;
        gap: $sp3;
        .account {
            @include ellipsis();
            @include font(book, normal, fs-80);
            color: var(--primary);
        }

        &.centered {
            justify-content: center;
        }

        .copy {
            cursor: pointer;
            width: 30px;
        }
    }

    .your-account {
        margin-top: $sp4;
    }
</style>

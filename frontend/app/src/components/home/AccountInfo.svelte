<script lang="ts">
    import { _ } from "svelte-i18n";
    import QR from "svelte-qr";
    import { toastStore } from "../../stores/toast";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import { iconSize } from "../../stores/iconSize";
    import type { CreatedUser, Cryptocurrency } from "openchat-client";
    import { copyToClipboard } from "../../utils/urls";

    export let user: CreatedUser;
    export let qrSize: "default" | "smaller" = "default";
    export let token: Cryptocurrency;

    let accountSummary = collapseAccount(user.cryptoAccount);
    function collapseAccount(account: string) {
        if (account.length > 20) {
            return account.slice(0, 10) + "..." + account.slice(account.length - 10);
        }
        return account;
    }

    function copy() {
        copyToClipboard(user.cryptoAccount).then((success) => {
            if (success) {
                toastStore.showSuccessToast("copiedToClipboard");
            } else {
                toastStore.showFailureToast("failedToCopyToClipboard", {
                    values: { account: user.cryptoAccount },
                });
            }
        });
    }
</script>

<div class="account-info">
    <div class="qr-wrapper">
        <div class="qr" class:smaller={qrSize === "smaller"}>
            <QR text={user.cryptoAccount} />
        </div>
    </div>
    <p>{$_("tokenTransfer.yourAccount", { values: { token: token.toUpperCase() } })}</p>
    <div class="receiver">
        <div class="account">
            {accountSummary}
        </div>
        <div class="copy" title={$_("copyToClipboard")} on:click={copy}>
            <ContentCopy size={$iconSize} color={"var(--icon-txt)"} />
        </div>
    </div>
</div>

<style type="text/scss">
    .qr-wrapper {
        border: 1px solid var(--bd);
        padding: $sp5;
        display: flex;
        justify-content: center;
        width: 100%;
        margin-bottom: $sp4;
    }

    .qr {
        background-color: #fff;
        width: 140px;
        height: 140px;

        &.smaller {
            width: 120px;
            height: 120px;
        }
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

        .copy {
            cursor: pointer;
            width: 30px;
        }
    }
</style>

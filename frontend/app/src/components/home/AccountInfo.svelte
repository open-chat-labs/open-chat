<script lang="ts">
    import { _ } from "svelte-i18n";
    import QR from "svelte-qr";
    import { toastStore } from "../../stores/toast";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import { iconSize } from "../../stores/iconSize";
    import type { CreatedUser } from "openchat-client";

    export let user: CreatedUser;
    export let qrSize: "default" | "smaller" = "default";

    let accountSummary = collapseAccount(user.cryptoAccount);
    function collapseAccount(account: string) {
        if (account.length > 20) {
            return account.slice(0, 10) + "..." + account.slice(account.length - 10);
        }
        return account;
    }

    function copyToClipboard() {
        navigator.clipboard.writeText(user.cryptoAccount).then(
            () => {
                toastStore.showSuccessToast("copiedToClipboard");
            },
            () => {
                toastStore.showFailureToast("failedToCopyToClipboard", {
                    values: { account: user.cryptoAccount },
                });
            }
        );
    }
</script>

<div class="account-info">
    <div class="qr" class:smaller={qrSize === "smaller"}>
        <QR text={user.cryptoAccount} />
    </div>
    <div class="receiver">
        <div class="account">
            {accountSummary}
        </div>
        <div class="copy" title={$_("copyToClipboard")} on:click={copyToClipboard}>
            <ContentCopy size={$iconSize} color={"#555"} />
        </div>
    </div>
</div>

<style type="text/scss">
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
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .receiver {
        display: flex;
        align-items: center;
        .account {
            @include ellipsis();
            @include font(book, normal, fs-80);
            width: 200px;
        }

        .copy {
            cursor: pointer;
            width: 30px;
        }
        margin: $sp4 0;
    }
</style>

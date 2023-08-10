<script lang="ts">
    import { _ } from "svelte-i18n";
    import QR from "svelte-qr";
    import { toastStore } from "../../stores/toast";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import { iconSize } from "../../stores/iconSize";
    import type { CreatedUser, OpenChat } from "openchat-client";
    import { ICP_SYMBOL } from "openchat-client";
    import { copyToClipboard } from "../../utils/urls";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    export let user: CreatedUser;
    export let qrSize: "default" | "smaller" | "larger" = "default";
    export let ledger: string;
    export let centered = false;
    export let border = true;

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
                toastStore.showSuccessToast("copiedToClipboard");
            } else {
                toastStore.showFailureToast("failedToCopyToClipboard", {
                    values: { account },
                });
            }
        });
    }
</script>

<div class="account-info">
    <div class="qr-wrapper" class:border>
        <div class="qr" class:smaller={qrSize === "smaller"} class:larger={qrSize === "larger"}>
            <QR text={account} level="Q" />
            <img class="icon" src={tokenDetails.logo} />
        </div>
    </div>
    <p class:centered>{$_("tokenTransfer.yourAccount", { values: { token: symbol } })}</p>
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
    .qr-wrapper {
        padding: $sp5;
        display: flex;
        justify-content: center;
        width: 100%;
        margin-bottom: $sp4;
        position: relative;

        &.border {
            border: 1px solid var(--bd);
        }
    }

    .qr {
        background-color: #fff;
        width: 140px;
        height: 140px;

        .icon {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-size: contain;
            height: 35px;
            width: 35px;
            border-radius: 50%;
            background-repeat: no-repeat;
            background-position: top;
        }

        &.smaller {
            width: 120px;
            height: 120px;
            .icon {
                height: 30px;
                width: 30px;
            }
        }

        &.larger {
            width: 180px;
            height: 180px;
            .icon {
                height: 45px;
                width: 45px;
            }
        }
    }

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
</style>

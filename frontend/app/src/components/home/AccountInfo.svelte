<script lang="ts">
    import { _ } from "svelte-i18n";
    import QR from "svelte-qr";
    import { toastStore } from "../../stores/toast";
    import ContentCopy from "svelte-material-icons/ContentCopy.svelte";
    import { iconSize } from "../../stores/iconSize";
    import { CreatedUser, Cryptocurrency, cryptoLookup } from "openchat-client";
    import { copyToClipboard } from "../../utils/urls";

    export let user: CreatedUser;
    export let qrSize: "default" | "smaller" | "larger" = "default";
    export let token: Cryptocurrency;
    export let centered = false;
    export let border = true;

    $: account = token === "icp" ? user.cryptoAccount : user.userId;
    $: symbol = cryptoLookup[token].symbol;

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
            <QR text={account} />
            <div class={`icon ${token}`} />
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
            &.icp {
                background-image: url("../assets/icp_token.svg");
            }
            &.sns1 {
                background-image: url("../assets/sns1_token.png");
            }
            &.ckbtc {
                background-image: url("../assets/ckbtc_nobackground.svg");
            }
            &.chat {
                background-image: url("../assets/spinner.svg");
            }
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

<script lang="ts">
    import Button from "../../Button.svelte";
    import Input from "../../Input.svelte";
    import Legend from "../../Legend.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Overlay from "../../Overlay.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Send from "svelte-material-icons/Send.svelte";
    import { _ } from "svelte-i18n";
    import { getContext } from "svelte";
    import { logger } from "../../../utils/logging";
    import AccountInfo from "../AccountInfo.svelte";
    import { iconSize } from "../../../stores/iconSize";
    import { toastStore } from "../../../stores/toast";
    import { mobileWidth } from "../../../stores/screenDimensions";
    import TokenInput from "../TokenInput.svelte";
    import { Cryptocurrency, cryptoLookup } from "openchat-client";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import type { OpenChat } from "openchat-client";

    export let open: boolean;
    export let token: Cryptocurrency;

    const client = getContext<OpenChat>("client");
    const user = client.user;

    $: account = token === "icp" ? user.cryptoAccount : user.userId;
    $: cryptoBalance = client.cryptoBalance;

    let error: string | undefined = undefined;
    let targetAccount: string = "";
    let amountToWithdrawE8s = BigInt(0);
    let withdrawing = false;
    let balanceWithRefresh: BalanceWithRefresh;
    let validAmount = false;

    // make sure that they are not trying to withdraw to the same account - I can see people trying to do that

    $: valid =
        validAmount &&
        amountToWithdrawE8s > BigInt(0) &&
        targetAccount !== "" &&
        targetAccount !== account;

    $: transferFees = cryptoLookup[token].transferFeesE8s;
    $: symbol = cryptoLookup[token].symbol;
    $: howToBuyUrl = cryptoLookup[token].howToBuyUrl;

    $: remainingBalanceE8s =
        amountToWithdrawE8s > BigInt(0)
            ? $cryptoBalance[token] - amountToWithdrawE8s - transferFees
            : $cryptoBalance[token];

    function withdraw() {
        if (!valid) return;

        withdrawing = true;
        error = undefined;
        client
            .withdrawCryptocurrency({
                kind: "pending",
                token,
                to: targetAccount,
                amountE8s: amountToWithdrawE8s,
                feeE8s: transferFees,
            })
            .then((resp) => {
                if (resp.kind === "completed") {
                    amountToWithdrawE8s = BigInt(0);
                    targetAccount = "";
                    balanceWithRefresh.refresh();
                    toastStore.showSuccessToast("cryptoAccount.withdrawalSucceeded");
                } else {
                    error = "cryptoAccount.withdrawalFailed";
                    logger.error(`Unable to withdraw ${symbol}`, resp);
                    toastStore.showFailureToast("cryptoAccount.withdrawalFailed");
                }
            })
            .catch((err) => {
                error = "cryptoAccount.withdrawalFailed";
                logger.error(`Unable to withdraw ${symbol}`, err);
                toastStore.showFailureToast("cryptoAccount.withdrawalFailed");
            })
            .finally(() => (withdrawing = false));
    }

    function onBalanceRefreshed() {
        error = undefined;
    }

    function onBalanceRefreshError(ev: CustomEvent<string>) {
        error = ev.detail;
    }
</script>

{#if open}
    <Overlay dismissible={true}>
        <ModalContent>
            <span class="header" slot="header">
                <div class="main-title">
                    {$_("cryptoAccount.manageHeader", { values: { symbol } })}
                </div>
                <BalanceWithRefresh
                    bind:this={balanceWithRefresh}
                    {token}
                    value={remainingBalanceE8s}
                    label={$_("cryptoAccount.shortBalanceLabel")}
                    minDecimals={2}
                    bold
                    on:refreshed={onBalanceRefreshed}
                    on:error={onBalanceRefreshError} />
            </span>
            <form class="body" slot="body">
                <h4 class="title">{$_("cryptoAccount.topUp")}</h4>
                <AccountInfo {token} {user} />

                <div class="or">
                    <hr />
                    <span>or</span>
                    <hr />
                </div>

                <h4 class="title">{$_("cryptoAccount.withdraw")}</h4>

                <div class="token-input">
                    <TokenInput
                        {token}
                        maxAmountE8s={BigInt(
                            Math.max(0, Number($cryptoBalance[token] - transferFees))
                        )}
                        bind:valid={validAmount}
                        bind:amountE8s={amountToWithdrawE8s} />
                </div>
                <div class="target">
                    <Input
                        bind:value={targetAccount}
                        countdown={false}
                        maxlength={100}
                        placeholder={$_("cryptoAccount.withdrawTarget")} />

                    <div class="send" class:valid on:click={withdraw} class:withdrawing>
                        {#if !withdrawing}
                            <Send
                                size={$iconSize}
                                color={valid ? "var(--icon-selected)" : "var(--icon-txt)"} />
                        {/if}
                    </div>
                </div>
                <a rel="noreferrer" class="how-to" href={howToBuyUrl} target="_blank">
                    {$_("howToBuyToken", { values: { token: symbol.toUpperCase() } })}
                </a>
                {#if error}
                    <ErrorMessage>{$_(error)}</ErrorMessage>
                {/if}
            </form>
            <span slot="footer">
                <ButtonGroup>
                    <Button tiny={$mobileWidth} on:click={() => (open = false)}
                        >{$_("close")}</Button>
                </ButtonGroup>
            </span>
        </ModalContent>
    </Overlay>
{/if}

<style type="text/scss">
    :global(.target .input-wrapper input) {
        padding-right: 40px;
    }

    .or {
        display: flex;
        gap: $sp4;
        align-items: center;
        margin: 0 auto $sp4 auto;
        width: 80%;

        hr {
            flex: auto;
            border-top: 1px solid var(--bd);
        }
    }

    .title {
        @include font(bold, normal, fs-120);
        margin-bottom: $sp4;
    }

    .header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: $sp2;

        .main-title {
            flex: auto;
        }
    }
    .how-to {
        margin-top: $sp3;
    }

    .body {
        display: flex;
        flex-direction: column;
    }

    .token-input {
        margin-bottom: $sp3;
    }

    .target {
        margin-bottom: $sp3;
        position: relative;

        .send {
            position: absolute !important;
            top: 10px;
            right: $sp3;

            &.valid {
                cursor: pointer;
            }

            &.withdrawing {
                @include loading-spinner(
                    1em,
                    0.5em,
                    var(--button-spinner),
                    "../assets/plain-spinner.svg"
                );
                top: 21px;
                right: 20px;
            }
        }
    }
</style>

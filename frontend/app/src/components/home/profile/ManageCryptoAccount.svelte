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
    import TokenInput from "../TokenInput.svelte";
    import { Cryptocurrency, cryptoLookup } from "openchat-client";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import type { OpenChat } from "openchat-client";

    export let open: boolean;
    export let token: Cryptocurrency;

    const client = getContext<OpenChat>("client");
    const user = client.user;

    $: cryptoBalance = client.cryptoBalance;

    let error: string | undefined = undefined;
    let targetAccount: string = "";
    let amountToWithdrawE8s = BigInt(0);
    let withdrawing = false;
    let balanceWithRefresh: BalanceWithRefresh;

    // make sure that they are not trying to withdraw to the same account - I can see people trying to do that
    $: valid =
        amountToWithdrawE8s > BigInt(0) &&
        targetAccount !== "" &&
        targetAccount !== client.user.cryptoAccount;

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
                token: token,
                to: targetAccount,
                amountE8s: amountToWithdrawE8s,
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
                    label={amountToWithdrawE8s > BigInt(0)
                        ? $_("cryptoAccount.shortRemainingBalanceLabel")
                        : $_("cryptoAccount.shortBalanceLabel")}
                    minDecimals={2}
                    bold
                    on:refreshed={onBalanceRefreshed}
                    on:error={onBalanceRefreshError} />
            </span>
            <form class="body" slot="body">
                <h4 class="title">{$_("cryptoAccount.topUp")}</h4>
                <AccountInfo qrSize={"smaller"} {user} />

                <div class="or">
                    <hr />
                    <span>or</span>
                    <hr />
                </div>

                <h4 class="title">{$_("cryptoAccount.withdraw")}</h4>

                <Legend>{$_("tokenTransfer.amount", { values: { token: symbol } })}</Legend>
                <div class="token-input">
                    <TokenInput
                        maxAmountE8s={$cryptoBalance[token] - transferFees}
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
                                color={valid ? "var(--accent)" : "var(--icon-txt)"} />
                        {/if}
                    </div>
                </div>
                <div class="fee">
                    {$_("tokenTransfer.fee", {
                        values: { fee: client.formatTokens(transferFees, 0), token: symbol },
                    })}
                </div>
                {#if error}
                    <ErrorMessage>{$_(error)}</ErrorMessage>
                {/if}
            </form>
            <span class="footer" slot="footer">
                <a class="how-to" href={howToBuyUrl} target="_blank">
                    {$_("howToBuyToken", { values: { token: symbol } })}
                </a>
                <ButtonGroup>
                    <Button tiny={true} secondary={true} on:click={() => (open = false)}
                        >{$_("close")}</Button>
                </ButtonGroup>
            </span>
        </ModalContent>
    </Overlay>
{/if}

<style type="text/scss">
    .or {
        display: flex;
        gap: $sp4;
        align-items: center;
        margin: 0 auto $sp4 auto;
        width: 80%;

        hr {
            flex: auto;
            border-top: 1px solid var(--modal-header-bd);
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
        @include font(light, normal, fs-90);
        text-decoration: underline;
        text-decoration-color: var(--accent);
        text-underline-offset: $sp1;
        text-decoration-thickness: 2px;
    }
    .footer {
        position: relative;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
    }

    .body {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .token-input {
        width: 250px;
        margin-bottom: $sp3;
    }

    .target {
        width: 250px;
        margin-bottom: $sp3;
        position: relative;

        .send {
            position: absolute !important;
            top: 10px;
            right: -30px;

            &.valid {
                cursor: pointer;
            }

            &.withdrawing {
                @include loading-spinner(1em, 0.5em, var(--button-spinner));
                top: 21px;
                right: -16px;
            }
        }
    }
    .fee {
        @include font(light, normal, fs-60);
        margin-bottom: $sp3;
        text-transform: lowercase;
    }
</style>

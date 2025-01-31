<script lang="ts">
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import type { MessageContext, OpenChat, P2PSwapContentInitial } from "openchat-client";
    import TokenInput from "./TokenInput.svelte";
    import Overlay from "../Overlay.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Legend from "../Legend.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext } from "svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import BalanceWithRefresh from "./BalanceWithRefresh.svelte";
    import CryptoSelector from "./CryptoSelector.svelte";
    import DurationPicker from "./DurationPicker.svelte";
    import TextArea from "../TextArea.svelte";
    import AreYouSure from "../AreYouSure.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import { pinNumberErrorMessageStore } from "../../stores/pinNumber";
    import { enhancedCryptoLookup as cryptoLookup, isDiamond } from "openchat-client";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let fromLedger: string;
    export let messageContext: MessageContext;

    let fromAmount: bigint;
    let fromAmountValid: boolean;
    let toLedger: string;
    let toAmount: bigint;
    let toAmountValid: boolean;
    let expiresIn: bigint;
    let message = "";
    let error: string | undefined = undefined;
    let tokenInputState: "ok" | "zero" | "too_low" | "too_high";
    let confirming = false;
    let sending = false;

    $: fromDetails = $cryptoLookup[fromLedger];
    $: toDetails = $cryptoLookup[toLedger];
    $: totalFees = fromDetails.transferFee * BigInt(2);
    $: remainingBalance =
        fromAmount > 0n ? fromDetails.balance - fromAmount - totalFees : fromDetails.balance;
    $: minAmount = fromDetails.transferFee * BigInt(10);
    $: valid = error === undefined && fromAmountValid && toAmountValid;
    $: errorMessage = error !== undefined ? i18nKey(error) : $pinNumberErrorMessageStore;

    $: {
        if (tokenInputState === "too_low") {
            error = $_("minimumAmount", {
                values: {
                    amount: client.formatTokens(minAmount, fromDetails.decimals),
                    symbol: fromDetails.symbol,
                },
            });
        } else {
            error = undefined;
        }
    }

    function onSend() {
        if (!$isDiamond) {
            dispatch("upgrade");
            return;
        }

        if (!valid) {
            return;
        }

        confirming = true;
    }

    function send(yes: boolean): Promise<void> {
        confirming = false;

        if (!yes) {
            return Promise.resolve();
        }

        const content: P2PSwapContentInitial = {
            kind: "p2p_swap_content_initial",
            token0: {
                ledger: fromLedger,
                symbol: fromDetails.symbol,
                fee: fromDetails.transferFee,
                decimals: fromDetails.decimals,
            },
            token1: {
                ledger: toLedger,
                symbol: toDetails.symbol,
                fee: toDetails.transferFee,
                decimals: toDetails.decimals,
            },
            token0Amount: fromAmount,
            token1Amount: toAmount,
            caption: message === "" ? undefined : message,
            expiresIn,
        };

        sending = true;
        error = undefined;

        return client
            .sendMessageWithContent(messageContext, content, false)
            .then((resp) => {
                if (resp.kind === "success" || resp.kind === "transfer_success") {
                    dispatch("close");
                } else if ($pinNumberErrorMessageStore === undefined) {
                    error = "errorSendingMessage";
                }
            })
            .finally(() => (sending = false));
    }

    function cancel() {
        dispatch("close");
    }

    function onBalanceRefreshed() {
        onBalanceRefreshFinished();
        error = undefined;
    }

    function onBalanceRefreshError(ev: CustomEvent<string>) {
        onBalanceRefreshFinished();
        error = ev.detail;
    }

    function onBalanceRefreshFinished() {
        if (remainingBalance < 0) {
            remainingBalance = BigInt(0);
            fromAmount = fromDetails.balance - totalFees;
        }
    }

    function onSelectFromToken(ev: CustomEvent<{ ledger: string; urlFormat: string }>) {
        if (ev.detail.ledger === toLedger) {
            toLedger =
                Object.values($cryptoLookup)
                    .map((t) => t.ledger)
                    .find((l) => l !== toLedger) ?? toLedger;
        }
    }
</script>

{#if confirming}
    <AreYouSure
        message={i18nKey("p2pSwap.confirmSend", {
            amount: client.formatTokens(fromAmount + totalFees, fromDetails.decimals),
            token: fromDetails.symbol,
        })}
        action={send} />
{/if}

<Overlay dismissible>
    <ModalContent>
        <span class="header" slot="header">
            <div class="main-title">
                <Translatable resourceKey={i18nKey("p2pSwap.builderTitle")} />
            </div>
            <BalanceWithRefresh
                ledger={fromLedger}
                value={remainingBalance}
                label={i18nKey("cryptoAccount.shortBalanceLabel")}
                bold
                on:refreshed={onBalanceRefreshed}
                on:error={onBalanceRefreshError} />
        </span>
        <form slot="body" class="body swap-builder">
            <div class="row">
                <div class="select-from">
                    <Legend label={i18nKey("cryptoAccount.transactionHeaders.from")} />
                    <div class="inner">
                        <CryptoSelector
                            filter={(t) => t.balance > 0}
                            bind:ledger={fromLedger}
                            on:select={onSelectFromToken} />
                    </div>
                </div>
                <div class="amount">
                    <TokenInput
                        ledger={fromLedger}
                        {minAmount}
                        maxAmount={fromDetails.balance - totalFees}
                        showDollarAmount
                        bind:state={tokenInputState}
                        bind:valid={fromAmountValid}
                        bind:amount={fromAmount} />
                </div>
            </div>
            <div class="row">
                <div class="select-to">
                    <Legend label={i18nKey("cryptoAccount.transactionHeaders.to")} />
                    <div class="inner">
                        <CryptoSelector
                            filter={(t) => t.ledger !== fromLedger}
                            bind:ledger={toLedger} />
                    </div>
                </div>
                <div class="amount">
                    <TokenInput
                        ledger={toLedger}
                        showDollarAmount
                        bind:valid={toAmountValid}
                        bind:amount={toAmount} />
                </div>
            </div>
            <div class="duration">
                <Legend label={i18nKey("p2pSwap.expiryTime")} />
                <DurationPicker bind:milliseconds={expiresIn} />
            </div>
            <div class="message">
                <Legend label={i18nKey("tokenTransfer.message")} />
                <TextArea
                    maxlength={200}
                    rows={3}
                    autofocus={false}
                    placeholder={i18nKey("tokenTransfer.messagePlaceholder")}
                    bind:value={message} />
            </div>
            {#if errorMessage !== undefined}
                <div class="error">
                    <ErrorMessage><Translatable resourceKey={errorMessage} /></ErrorMessage>
                </div>
            {/if}
        </form>
        <span slot="footer">
            <ButtonGroup>
                <Button small={!$mobileWidth} tiny={$mobileWidth} secondary on:click={cancel}
                    ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                <Button
                    small={!$mobileWidth}
                    disabled={!valid || sending}
                    loading={sending}
                    tiny={$mobileWidth}
                    on:click={onSend}
                    ><Translatable resourceKey={i18nKey("tokenTransfer.send")} /></Button>
            </ButtonGroup>
        </span>
    </ModalContent>
</Overlay>

<style lang="scss">
    :global(.swap-builder .row input.amount-val) {
        border: var(--bw) solid var(--bd) !important;
        border-radius: 0 var(--rd) var(--rd) 0 !important;
        height: 47px;
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

    .body {
        display: flex;
        flex-direction: column;
        gap: $sp4;
    }

    .row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: var(--rd);

        .inner {
            @include font(book, normal, fs-100);
            padding: 0 $sp4;
            background-color: var(--modal-bg);
            border: var(--bw) solid var(--bd);
            border-right: 0;
            border-radius: var(--rd) 0 0 var(--rd);
            display: flex;
            height: 47px;
            align-items: center;
        }

        .amount {
            flex-grow: 1;
        }
    }

    .error {
        margin-top: $sp4;
    }
</style>

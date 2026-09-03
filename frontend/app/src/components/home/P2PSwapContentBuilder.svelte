<script lang="ts">
    import type { MessageContext, OpenChat, P2PSwapContentInitial, SignerWallet } from "@client";
    import {
        enhancedCryptoLookup as cryptoLookup,
        isDiamondStore,
        mobileWidth,
        publish,
    } from "@client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../stores/pinNumber";
    import AreYouSure from "../AreYouSure.svelte";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Legend from "../Legend.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import TextArea from "../TextArea.svelte";
    import Translatable from "../Translatable.svelte";
    import BalanceWithRefresh from "./BalanceWithRefresh.svelte";
    import CryptoSelector from "./CryptoSelector.svelte";
    import DurationPicker from "./DurationPicker.svelte";
    import ExternalWalletApproval from "./ExternalWalletApproval.svelte";
    import SourceWalletSelector from "./SourceWalletSelector.svelte";
    import TokenInput from "./TokenInput.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        fromLedger: string;
        messageContext: MessageContext;
        onClose: () => void;
    }

    let { fromLedger = $bindable(), messageContext, onClose }: Props = $props();

    let durationValid = $state(false);
    let fromAmount: bigint = $state(0n);
    let fromAmountValid: boolean = $state(false);
    let toLedger: string = $state("");
    let toAmount: bigint = $state(0n);
    let toAmountValid: boolean = $state(false);
    let expiresIn: bigint = $state(0n);
    let message = $state("");
    let error: string | undefined = $state(undefined);
    let tokenInputState: "ok" | "zero" | "too_low" | "too_high" = $state("ok");
    let confirming = $state(false);
    let sending = $state(false);
    // The external wallet the offer will be funded from, or undefined for the user's own OpenChat
    // account. Paying from an external wallet spends that wallet's balance rather than the user's
    // OpenChat one, so none of the limits derived from the latter apply while one is selected.
    let sourceWallet = $state<SignerWallet | undefined>();
    let payFromWallet = $derived(sourceWallet !== undefined);
    let approval: ExternalWalletApproval | undefined = $state();

    let fromDetails = $derived($cryptoLookup.get(fromLedger)!);
    let toDetails = $derived($cryptoLookup.get(toLedger)!);
    let totalFees = $derived(fromDetails.transferFee * BigInt(2));
    let remainingBalance = $state(0n);
    $effect(() => {
        remainingBalance =
            fromAmount > 0n && !payFromWallet
                ? fromDetails.balance - fromAmount - totalFees
                : fromDetails.balance;
    });
    // What the user is able to offer, or undefined when that is the external wallet's business
    // rather than ours
    let spendingLimit = $derived(payFromWallet ? undefined : fromDetails.balance - totalFees);
    let minAmount = $derived(fromDetails.transferFee * BigInt(10));
    let valid = $derived(error === undefined && fromAmountValid && toAmountValid && durationValid);
    let errorMessage = $derived(error !== undefined ? i18nKey(error) : $pinNumberErrorMessageStore);

    $effect(() => {
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
    });

    function onSend() {
        if (!$isDiamondStore) {
            publish("upgrade");
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

        sending = true;
        error = undefined;

        if (approval != null) {
            // The wallet has to approve us taking the offer's funds before we take them. Nothing
            // may be awaited before this call - the wallet opens in a popup, which the browser
            // only allows while it is still handling the click
            return approval.approve().then((fromAccount) => {
                if (fromAccount === undefined) {
                    sending = false;
                } else {
                    return sendSwap(fromAccount);
                }
            });
        } else {
            return sendSwap();
        }
    }

    // `fromAccount` is an external wallet which has just approved the transfer. Without it the
    // offer is funded from the user's own OpenChat account, as it always has been.
    function sendSwap(fromAccount?: string): Promise<void> {
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
            fromAccount,
        };

        return client
            .sendMessageWithContent(messageContext, content, false)
            .then((resp) => {
                if (resp.kind === "success" || resp.kind === "transfer_success") {
                    onClose();
                } else if ($pinNumberErrorMessageStore === undefined) {
                    error = "errorSendingMessage";
                }
            })
            .finally(() => (sending = false));
    }

    function cancel() {
        onClose();
    }

    function onBalanceRefreshed() {
        onBalanceRefreshFinished();
        error = undefined;
    }

    function onBalanceRefreshError(err: string) {
        onBalanceRefreshFinished();
        error = err;
    }

    function onBalanceRefreshFinished() {
        if (remainingBalance < 0 && !payFromWallet) {
            remainingBalance = BigInt(0);
            fromAmount = fromDetails.balance - totalFees;
        }
    }

    function onSelectFromToken(ledger: string, _: string) {
        if (ledger === toLedger) {
            toLedger =
                [...$cryptoLookup.values()].map((t) => t.ledger).find((l) => l !== toLedger) ??
                toLedger;
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
        {#snippet header()}
            <span class="header">
                <div class="main-title">
                    <Translatable resourceKey={i18nKey("p2pSwap.builderTitle")} />
                </div>
                <SourceWalletSelector bind:wallet={sourceWallet} />
                <!-- The balance is the external wallet's business while one is selected, so only
                     show OpenChat's own - but keep its space so the selector does not move -->
                <div class="oc-balance" class:hidden={payFromWallet}>
                    <BalanceWithRefresh
                        ledger={fromLedger}
                        value={remainingBalance}
                        label={i18nKey("cryptoAccount.shortBalanceLabel")}
                        bold
                        onRefreshed={onBalanceRefreshed}
                        onError={onBalanceRefreshError} />
                </div>
            </span>
        {/snippet}
        {#snippet body()}
            <form class="body swap-builder">
                <div class="row">
                    <div class="select-from">
                        <Legend label={i18nKey("cryptoAccount.transactionHeaders.from")} />
                        <div class="inner">
                            <!-- An external wallet's balance is its own business, so while one is
                                 selected tokens the user holds none of stay available -->
                            <CryptoSelector
                                filter={payFromWallet ? undefined : (t) => t.balance > 0}
                                bind:ledger={fromLedger}
                                onSelect={onSelectFromToken} />
                        </div>
                    </div>
                    <div class="amount">
                        <TokenInput
                            ledger={fromLedger}
                            {minAmount}
                            maxAmount={spendingLimit}
                            showDollarAmount
                            bind:status={tokenInputState}
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
                    <DurationPicker bind:valid={durationValid} bind:milliseconds={expiresIn} />
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
                {#if sourceWallet !== undefined}
                    <!-- The escrowed amount funds the swap's outbound transfer as well, so the
                         ledger charges the offer's amount plus two fees against the allowance -->
                    <ExternalWalletApproval
                        bind:this={approval}
                        wallet={sourceWallet}
                        ledger={fromLedger}
                        amount={fromAmount}
                        fees={totalFees} />
                {/if}
            </form>
        {/snippet}
        {#snippet footer()}
            <span>
                <ButtonGroup>
                    <Button small={!$mobileWidth} tiny={$mobileWidth} secondary onClick={cancel}
                        ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                    <Button
                        small={!$mobileWidth}
                        disabled={!valid || sending}
                        loading={sending}
                        tiny={$mobileWidth}
                        onClick={onSend}
                        ><Translatable resourceKey={i18nKey("tokenTransfer.send")} /></Button>
                </ButtonGroup>
            </span>
        {/snippet}
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

    .oc-balance.hidden {
        visibility: hidden;
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

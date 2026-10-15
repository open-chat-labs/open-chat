<script lang="ts">
    import type { ChatSummary, MessageContext, OpenChat, ResourceKey } from "@client";
    import { iconSize, mobileWidth } from "@client";
    import { getContext, untrack } from "svelte";
    import Alert from "svelte-material-icons/Alert.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../stores/pinNumber";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Legend from "../Legend.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import TextArea from "../TextArea.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import { CryptoTransferForm } from "@shared_components/home/cryptoTransfer/cryptoTransferForm.svelte";
    import AccountInfo from "./AccountInfo.svelte";
    import BalanceWithRefresh from "./BalanceWithRefresh.svelte";
    import CryptoSelector from "./CryptoSelector.svelte";
    import ExternalWalletApproval from "./ExternalWalletApproval.svelte";
    import SingleUserSelector from "./SingleUserSelector.svelte";
    import SourceWalletSelector from "./SourceWalletSelector.svelte";
    import TokenInput from "./TokenInput.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        draftAmount: bigint;
        ledger: string;
        chat: ChatSummary;
        defaultReceiver: string | undefined;
        messageContext: MessageContext;
        onClose: () => void;
    }

    let { draftAmount, ledger, chat, defaultReceiver, messageContext, onClose }: Props = $props();

    // The balance is refreshed by BalanceWithRefresh, which tells the form when it has been
    const form = untrack(
        () =>
            new CryptoTransferForm(client, ledger, chat, defaultReceiver, draftAmount, {
                refreshBalance: false,
            }),
    );
    let tokenState = $derived(form.tokenState);
    const refreshing = false;
    // Why the transfer failed, or the balance couldn't be refreshed
    let error: ResourceKey | undefined = $state(undefined);
    let message = $state("");
    let confirming = $state(false);
    let toppingUp = $state(false);
    let balanceWithRefresh: BalanceWithRefresh;
    let sending = $state(false);
    let approval: ExternalWalletApproval | undefined = $state();

    let valid = $derived(error === undefined && form.valid);
    let errorMessage = $derived(error ?? $pinNumberErrorMessageStore);

    function reset() {
        confirming = false;
        balanceWithRefresh?.refresh();
    }

    function send() {
        if (!confirming) {
            confirming = true;
            return;
        }

        sending = true;
        error = undefined;

        if (approval != null) {
            // The wallet has to approve us taking the transfer before we make it. Nothing may be
            // awaited before this call - the wallet opens in a popup, which the browser only
            // allows while it is still handling the click
            approval.approve().then((fromAccount) => {
                if (fromAccount === undefined) {
                    sending = false;
                } else {
                    transfer(fromAccount);
                }
            });
        } else {
            transfer();
        }
    }

    async function transfer(fromAccount?: string) {
        const outcome = await form.send(messageContext, message, fromAccount);
        sending = false;
        switch (outcome.kind) {
            case "sent":
                onClose();
                break;
            case "cancelled":
            case "pin_failed":
                // a PIN failure shows the PIN failure store's message
                break;
            case "failed":
                error = outcome.message;
                break;
            default:
                outcome satisfies never;
        }
    }

    function cancel() {
        toppingUp = false;
        onClose();
    }

    function onBalanceRefreshed() {
        toppingUp = false;
        error = undefined;
        form.balanceChecked();
    }

    function onBalanceRefreshError(err: string) {
        toppingUp = false;
        error = i18nKey(err);
        form.balanceChecked();
    }
</script>

<Overlay dismissible>
    <ModalContent>
        {#snippet header()}
            <span class="header">
                <div class="left">
                    <div class="main-title">
                        <div><Translatable resourceKey={i18nKey("tokenTransfer.send")} /></div>
                        <div>
                            <CryptoSelector
                                bind:ledger={() => form.ledger, (l) => (form.ledger = l)}
                            />
                        </div>
                    </div>
                </div>
                <SourceWalletSelector bind:wallet={form.sourceWallet} ledger={form.ledger} />
                <!-- The balance is the external wallet's business while one is selected, so only
                     show OpenChat's own - but keep its space so the selector does not move -->
                <div class="oc-balance" class:hidden={form.payFromWallet}>
                    <BalanceWithRefresh
                        bind:toppingUp
                        bind:this={balanceWithRefresh}
                        ledger={form.ledger}
                        value={tokenState.remainingBalance}
                        label={i18nKey("cryptoAccount.shortBalanceLabel")}
                        bold
                        showTopUp
                        onClick={() => (confirming = false)}
                        onRefreshed={onBalanceRefreshed}
                        onError={onBalanceRefreshError}
                    />
                </div>
            </span>
        {/snippet}
        {#snippet body()}
            <form>
                <div class="body" class:zero={form.zero || toppingUp}>
                    {#if form.zero || toppingUp}
                        <AccountInfo ledger={form.ledger} />
                        {#if form.zero}
                            <p>
                                <Translatable
                                    resourceKey={i18nKey("tokenTransfer.zeroBalance", {
                                        token: tokenState.symbol,
                                    })}
                                />
                            </p>
                        {/if}
                        <p><Translatable resourceKey={i18nKey("tokenTransfer.makeDeposit")} /></p>
                    {:else}
                        {#if form.multiUserChat}
                            <div class="receiver">
                                <Legend label={i18nKey("tokenTransfer.receiver")} />
                                <SingleUserSelector
                                    bind:selectedReceiver={form.receiver}
                                    autofocus={form.multiUserChat}
                                />
                            </div>
                        {/if}
                        <div class="transfer">
                            <TokenInput
                                ledger={form.ledger}
                                transferFees={tokenState.transferFees}
                                autofocus={!form.multiUserChat}
                                minAmount={tokenState.minAmount}
                                maxAmount={form.spendingLimit}
                                bind:amount={tokenState.draftAmount}
                            />
                        </div>
                        <div class="message">
                            <Legend label={i18nKey("tokenTransfer.message")} />
                            <TextArea
                                maxlength={200}
                                rows={3}
                                autofocus={false}
                                placeholder={i18nKey("tokenTransfer.messagePlaceholder")}
                                bind:value={message}
                            />
                        </div>
                        {#if confirming}
                            <div class="confirming">
                                <div class="alert">
                                    <Alert size={$iconSize} color={"var(--warn"} />
                                </div>
                                <div class="alert-txt">
                                    <Translatable
                                        resourceKey={i18nKey("tokenTransfer.warning", {
                                            token: tokenState.symbol,
                                        })}
                                    />
                                </div>
                            </div>
                        {/if}
                        {#if errorMessage !== undefined}
                            <div class="error">
                                <ErrorMessage
                                    ><Translatable resourceKey={errorMessage} /></ErrorMessage
                                >
                            </div>
                        {/if}
                    {/if}
                    {#if form.sourceWallet !== undefined}
                        <ExternalWalletApproval
                            bind:this={approval}
                            wallet={form.sourceWallet}
                            ledger={form.ledger}
                            amount={tokenState.draftAmount}
                            chatId={messageContext.chatId}
                        />
                    {/if}
                </div>
            </form>
        {/snippet}
        {#snippet footer()}
            <span>
                <ButtonGroup>
                    <Button small={!$mobileWidth} tiny={$mobileWidth} secondary onClick={cancel}
                        ><Translatable resourceKey={i18nKey("cancel")} /></Button
                    >
                    {#if toppingUp || form.zero}
                        <Button
                            small={!$mobileWidth}
                            disabled={refreshing}
                            loading={refreshing}
                            tiny={$mobileWidth}
                            onClick={reset}
                            ><Translatable resourceKey={i18nKey("refresh")} /></Button
                        >
                    {:else}
                        <Button
                            small={!$mobileWidth}
                            disabled={!valid || sending}
                            loading={sending}
                            tiny={$mobileWidth}
                            onClick={send}
                            ><Translatable
                                resourceKey={i18nKey(
                                    confirming ? "tokenTransfer.confirm" : "tokenTransfer.send",
                                )}
                            /></Button
                        >
                    {/if}
                </ButtonGroup>
            </span>
        {/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: $sp2;

        .left {
            flex: auto;
            display: flex;
            align-items: center;
            gap: $sp4;

            .main-title {
                flex: auto;
                display: flex;
                align-items: baseline;
                gap: 10px;
                @include font(bold, normal, fs-120);
            }
        }
    }

    .body {
        transition: background-color 100ms ease-in-out;
        @include font(book, normal, fs-100, 28);
    }

    .oc-balance.hidden {
        visibility: hidden;
    }

    .confirming {
        padding: $sp4;
        border: 1px solid var(--warn);
        display: flex;
        align-items: flex-start;
        gap: $sp3;
        border-radius: var(--rd);

        .alert {
            flex: 0 0 25px;
        }

        .alert-txt {
            flex: auto;
        }
    }

    .transfer {
        margin-bottom: $sp4;
    }

    .how-to {
        margin-top: $sp4;
    }

    .error {
        margin-top: $sp4;
    }
</style>

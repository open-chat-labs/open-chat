<script lang="ts">
    import type { ChatSummary, OpenChat, UserSummary } from "openchat-client";
    import {
        allUsersStore,
        cryptoBalanceStore,
        enhancedCryptoLookup as cryptoLookup,
        currentUserIdStore,
        iconSize,
        mobileWidth,
    } from "openchat-client";
    import { type CryptocurrencyContent, type MessageContext, nowNanos } from "openchat-shared";
    import { getContext, onMount } from "svelte";
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
    import Translatable from "../Translatable.svelte";
    import AccountInfo from "./AccountInfo.svelte";
    import BalanceWithRefresh from "./BalanceWithRefresh.svelte";
    import CryptoSelector from "./CryptoSelector.svelte";
    import SingleUserSelector from "./SingleUserSelector.svelte";
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

    let {
        draftAmount = $bindable(),
        ledger = $bindable(),
        chat,
        defaultReceiver,
        messageContext,
        onClose,
    }: Props = $props();

    let refreshing = false;
    let error: string | undefined = $state(undefined);
    let message = $state("");
    let confirming = $state(false);
    let toppingUp = $state(false);
    let tokenChanging = $state(true);
    let balanceWithRefresh: BalanceWithRefresh;
    let receiver: UserSummary | undefined = $state(undefined);
    let validAmount: boolean = $state(false);
    let sending = $state(false);

    let cryptoBalance = $derived($cryptoBalanceStore.get(ledger) ?? 0n);
    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    let symbol = $derived(tokenDetails.symbol);
    let transferFees = $derived(tokenDetails.transferFee);
    let multiUserChat = $derived(chat.kind === "group_chat" || chat.kind === "channel");
    let remainingBalance = $state(0n);
    $effect(() => {
        remainingBalance =
            draftAmount > BigInt(0) ? cryptoBalance - draftAmount - transferFees : cryptoBalance;
    });
    let valid = $derived(
        error === undefined && validAmount && receiver !== undefined && !tokenChanging,
    );
    let zero = $derived(cryptoBalance <= transferFees && !tokenChanging);
    let errorMessage = $derived(error !== undefined ? i18nKey(error) : $pinNumberErrorMessageStore);

    onMount(() => {
        // default the receiver to the other user in a direct chat
        if (chat.kind === "direct_chat") {
            receiver = $allUsersStore.get(chat.them.userId);
        } else if (defaultReceiver !== undefined && defaultReceiver !== $currentUserIdStore) {
            receiver = $allUsersStore.get(defaultReceiver);
        }
    });

    function reset() {
        confirming = false;
        balanceWithRefresh.refresh();
    }

    function maxAmount(balance: bigint): bigint {
        return balance - transferFees;
    }

    function send() {
        if (!confirming) {
            confirming = true;
            return;
        }

        if (receiver === undefined) return;

        const content: CryptocurrencyContent = {
            kind: "crypto_content",
            caption: message === "" ? undefined : message,
            transfer: {
                kind: "pending",
                ledger,
                token: symbol,
                recipient: receiver.userId,
                amountE8s: draftAmount,
                feeE8s: transferFees,
                createdAtNanos: nowNanos(),
            },
        };

        sending = true;
        error = undefined;

        client
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
        toppingUp = false;
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
        toppingUp = false;
        tokenChanging = false;
        if (remainingBalance < 0) {
            remainingBalance = BigInt(0);
            draftAmount = cryptoBalance - transferFees;
            if (draftAmount < 0) {
                draftAmount = BigInt(0);
            }
        }
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
                            <CryptoSelector bind:ledger />
                        </div>
                    </div>
                </div>
                <BalanceWithRefresh
                    bind:toppingUp
                    bind:this={balanceWithRefresh}
                    {ledger}
                    value={remainingBalance}
                    label={i18nKey("cryptoAccount.shortBalanceLabel")}
                    bold
                    showTopUp
                    onClick={() => (confirming = false)}
                    onRefreshed={onBalanceRefreshed}
                    onError={onBalanceRefreshError} />
            </span>
        {/snippet}
        {#snippet body()}
            <form>
                <div class="body" class:zero={zero || toppingUp}>
                    {#if zero || toppingUp}
                        <AccountInfo {ledger} />
                        {#if zero}
                            <p>
                                <Translatable
                                    resourceKey={i18nKey("tokenTransfer.zeroBalance", {
                                        token: symbol,
                                    })} />
                            </p>
                        {/if}
                        <p><Translatable resourceKey={i18nKey("tokenTransfer.makeDeposit")} /></p>
                    {:else}
                        {#if multiUserChat}
                            <div class="receiver">
                                <Legend label={i18nKey("tokenTransfer.receiver")} />
                                <SingleUserSelector
                                    bind:selectedReceiver={receiver}
                                    autofocus={multiUserChat} />
                            </div>
                        {/if}
                        <div class="transfer">
                            <TokenInput
                                {ledger}
                                {transferFees}
                                autofocus={!multiUserChat}
                                bind:valid={validAmount}
                                maxAmount={maxAmount(cryptoBalance)}
                                bind:amount={draftAmount} />
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
                        {#if confirming}
                            <div class="confirming">
                                <div class="alert">
                                    <Alert size={$iconSize} color={"var(--warn"} />
                                </div>
                                <div class="alert-txt">
                                    <Translatable
                                        resourceKey={i18nKey("tokenTransfer.warning", {
                                            token: symbol,
                                        })} />
                                </div>
                            </div>
                        {/if}
                        {#if errorMessage !== undefined}
                            <div class="error">
                                <ErrorMessage
                                    ><Translatable resourceKey={errorMessage} /></ErrorMessage>
                            </div>
                        {/if}
                    {/if}
                </div>
            </form>
        {/snippet}
        {#snippet footer()}
            <span>
                <ButtonGroup>
                    <Button small={!$mobileWidth} tiny={$mobileWidth} secondary onClick={cancel}
                        ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                    {#if toppingUp || zero}
                        <Button
                            small={!$mobileWidth}
                            disabled={refreshing}
                            loading={refreshing}
                            tiny={$mobileWidth}
                            onClick={reset}
                            ><Translatable resourceKey={i18nKey("refresh")} /></Button>
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
                                )} /></Button>
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

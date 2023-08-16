<script lang="ts">
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import type { ChatSummary, OpenChat, PartialUserSummary } from "openchat-client";
    import type { CryptocurrencyContent } from "openchat-shared";
    import TokenInput from "./TokenInput.svelte";
    import Overlay from "../Overlay.svelte";
    import AccountInfo from "./AccountInfo.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Alert from "svelte-material-icons/Alert.svelte";
    import Legend from "../Legend.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import { iconSize } from "../../stores/iconSize";
    import SingleUserSelector from "./SingleUserSelector.svelte";
    import BalanceWithRefresh from "./BalanceWithRefresh.svelte";
    import TextArea from "../TextArea.svelte";
    import CryptoSelector from "./CryptoSelector.svelte";

    const client = getContext<OpenChat>("client");
    const user = client.user;
    const dispatch = createEventDispatcher();

    export let draftAmount: bigint;
    export let ledger: string;
    export let chat: ChatSummary;
    export let defaultReceiver: string | undefined;

    $: currentChatBlockedUsers = client.currentChatBlockedUsers;
    $: currentChatMembers = client.currentChatMembers;
    $: lastCryptoSent = client.lastCryptoSent;
    $: cryptoBalanceStore = client.cryptoBalance;
    $: cryptoBalance = $cryptoBalanceStore[ledger] ?? BigInt(0);
    $: userStore = client.userStore;
    let refreshing = false;
    let error: string | undefined = undefined;
    let message = "";
    let confirming = false;
    let toppingUp = false;
    let tokenChanging = true;
    let balanceWithRefresh: BalanceWithRefresh;
    let receiver: PartialUserSummary | undefined = undefined;
    let validAmount: boolean = false;
    $: cryptoLookup = client.cryptoLookup;
    $: tokenDetails = $cryptoLookup[ledger];
    $: symbol = tokenDetails.symbol;
    $: howToBuyUrl = tokenDetails.howToBuyUrl;
    $: transferFees = tokenDetails.transferFee;
    $: multiUserChat = chat.kind === "group_chat" || chat.kind === "channel";
    $: remainingBalance =
        draftAmount > BigInt(0)
            ? cryptoBalance - draftAmount - transferFees
            : cryptoBalance;
    $: valid = error === undefined && validAmount && receiver !== undefined && !tokenChanging;
    $: zero = cryptoBalance <= transferFees && !tokenChanging;

    onMount(() => {
        // default the receiver to the other user in a direct chat
        if (chat.kind === "direct_chat") {
            receiver = $userStore[chat.them.userId];
        } else if (defaultReceiver !== undefined) {
            receiver = $userStore[defaultReceiver];
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
                createdAtNanos: BigInt(Date.now()) * BigInt(1_000_000),
            },
        };
        dispatch("sendTransfer", [content, undefined]);
        lastCryptoSent.set(ledger);
        dispatch("close");
    }

    function cancel() {
        toppingUp = false;
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
        <span class="header" slot="header">
            <div class="left">
                <div class="main-title">
                    <div>{$_("tokenTransfer.send")}</div>
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
                label={$_("cryptoAccount.shortBalanceLabel")}
                bold
                showTopUp
                on:click={() => (confirming = false)}
                on:refreshed={onBalanceRefreshed}
                on:error={onBalanceRefreshError} />
        </span>
        <form slot="body">
            <div class="body" class:zero={zero || toppingUp}>
                {#if zero || toppingUp}
                    <AccountInfo {ledger} {user} />
                    {#if zero}
                        <p>{$_("tokenTransfer.zeroBalance", { values: { token: symbol } })}</p>
                    {/if}
                    <p>{$_("tokenTransfer.makeDeposit")}</p>
                    <a rel="noreferrer" class="how-to" href={howToBuyUrl} target="_blank">
                        {$_("howToBuyToken", { values: { token: symbol } })}
                    </a>
                {:else}
                    {#if multiUserChat}
                        <div class="receiver">
                            <Legend label={$_("tokenTransfer.receiver")} />
                            <SingleUserSelector
                                bind:selectedReceiver={receiver}
                                members={$currentChatMembers}
                                blockedUsers={$currentChatBlockedUsers}
                                autofocus={multiUserChat} />
                        </div>
                    {/if}
                    <div class="transfer">
                        <TokenInput
                            {ledger}
                            autofocus={!multiUserChat}
                            bind:valid={validAmount}
                            maxAmount={maxAmount(cryptoBalance)}
                            bind:amount={draftAmount} />
                    </div>
                    <div class="message">
                        <Legend label={$_("tokenTransfer.message")} />
                        <TextArea
                            maxlength={200}
                            rows={3}
                            autofocus={false}
                            placeholder={$_("tokenTransfer.messagePlaceholder")}
                            bind:value={message} />
                    </div>
                    {#if error}
                        <ErrorMessage>{$_(error)}</ErrorMessage>
                    {/if}
                    {#if confirming}
                        <div class="confirming">
                            <div class="alert">
                                <Alert size={$iconSize} color={"var(--warn"} />
                            </div>
                            <div class="alert-txt">
                                {$_("tokenTransfer.warning", { values: { token: symbol } })}
                            </div>
                        </div>
                    {/if}
                {/if}
            </div>
        </form>
        <span slot="footer">
            <ButtonGroup>
                <Button small={!$mobileWidth} tiny={$mobileWidth} secondary on:click={cancel}
                    >{$_("cancel")}</Button>
                {#if toppingUp || zero}
                    <Button
                        small={!$mobileWidth}
                        disabled={refreshing}
                        loading={refreshing}
                        tiny={$mobileWidth}
                        on:click={reset}>{$_("refresh")}</Button>
                {:else}
                    <Button
                        small={!$mobileWidth}
                        disabled={!valid}
                        tiny={$mobileWidth}
                        on:click={send}
                        >{confirming
                            ? $_("tokenTransfer.confirm")
                            : $_("tokenTransfer.send")}</Button>
                {/if}
            </ButtonGroup>
        </span>
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
        border-radius: $sp2;

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
</style>

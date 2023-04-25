<script lang="ts">
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import { cryptoLookup, E8S_PER_TOKEN, PartialUserSummary } from "openchat-client";
    import type { Cryptocurrency, ChatSummary, OpenChat } from "openchat-client";
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

    export let draftAmountE8s: bigint;
    export let token: Cryptocurrency;
    export let chat: ChatSummary;
    export let defaultReceiver: string | undefined;

    $: currentChatBlockedUsers = client.currentChatBlockedUsers;
    $: currentChatMembers = client.currentChatMembers;
    $: lastCryptoSent = client.lastCryptoSent;
    $: cryptoBalance = client.cryptoBalance;
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
    $: symbol = cryptoLookup[token].symbol;
    $: howToBuyUrl = cryptoLookup[token].howToBuyUrl;
    $: transferFees = cryptoLookup[token].transferFeesE8s;
    $: group = chat.kind === "group_chat";
    $: remainingBalanceE8s =
        draftAmountE8s > BigInt(0)
            ? $cryptoBalance[token] - draftAmountE8s - transferFees
            : $cryptoBalance[token];
    $: valid = error === undefined && validAmount && receiver !== undefined && !tokenChanging;
    $: zero = $cryptoBalance[token] <= transferFees && !tokenChanging;
    $: isDiamond = client.isDiamond;

    onMount(() => {
        // default the receiver to the other user in a direct chat
        if (chat.kind === "direct_chat") {
            receiver = $userStore[chat.them];
        } else if (defaultReceiver !== undefined) {
            receiver = $userStore[defaultReceiver];
        }
    });

    function reset() {
        confirming = false;
        balanceWithRefresh.refresh();
    }

    function maxAmountE8s(balance: bigint): bigint {
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
                token,
                kind: "pending",
                recipient: receiver.userId,
                amountE8s: draftAmountE8s,
                feeE8s: transferFees,
                createdAtNanos: BigInt(Date.now()) * BigInt(1_000_000),
            },
        };
        dispatch("sendTransfer", [content, undefined]);
        lastCryptoSent.set(token);
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
        if (remainingBalanceE8s < 0) {
            remainingBalanceE8s = BigInt(0);
            draftAmountE8s = $cryptoBalance[token] - transferFees;
            if (draftAmountE8s < 0) {
                draftAmountE8s = BigInt(0);
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
                        <CryptoSelector on:upgrade isDiamond={$isDiamond} bind:token />
                    </div>
                </div>
            </div>
            <BalanceWithRefresh
                bind:toppingUp
                bind:this={balanceWithRefresh}
                {token}
                value={remainingBalanceE8s}
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
                    <AccountInfo {token} {user} />
                    {#if zero}
                        <p>{$_("tokenTransfer.zeroBalance", { values: { token: symbol } })}</p>
                    {/if}
                    <p>{$_("tokenTransfer.makeDeposit")}</p>
                    <a rel="noreferrer" class="how-to" href={howToBuyUrl} target="_blank">
                        {$_("howToBuyToken", { values: { token: symbol.toUpperCase() } })}
                    </a>
                {:else}
                    {#if group}
                        <div class="receiver">
                            <Legend label={$_("tokenTransfer.receiver")} />
                            <SingleUserSelector
                                bind:selectedReceiver={receiver}
                                members={$currentChatMembers}
                                blockedUsers={$currentChatBlockedUsers}
                                autofocus={group} />
                        </div>
                    {/if}
                    <div class="transfer">
                        <TokenInput
                            {token}
                            autofocus={!group}
                            bind:valid={validAmount}
                            maxAmountE8s={maxAmountE8s($cryptoBalance[token])}
                            bind:amountE8s={draftAmountE8s} />
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
                <Button small={!$mobileWidth} tiny={$mobileWidth} secondary={true} on:click={cancel}
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

<style type="text/scss">
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

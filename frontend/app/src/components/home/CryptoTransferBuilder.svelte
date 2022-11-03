<script lang="ts">
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import Avatar from "../Avatar.svelte";
    import {
        AvatarSize,
        cryptoLookup,
        UserStatus,
        E8S_PER_TOKEN,
        cryptoCurrencyList,
        PartialUserSummary,
    } from "openchat-client";
    import type { Cryptocurrency, ChatSummary, OpenChat, DirectChatSummary } from "openchat-client";
    import TokenInput from "./TokenInput.svelte";
    import Input from "../Input.svelte";
    import Overlay from "../Overlay.svelte";
    import AccountInfo from "./AccountInfo.svelte";
    import ModalContent from "../ModalContent.svelte";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import AlertOutline from "svelte-material-icons/AlertOutline.svelte";
    import Legend from "../Legend.svelte";
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { now } from "../../stores/time";
    import ErrorMessage from "../ErrorMessage.svelte";
    import { mobileWidth } from "../../stores/screenDimensions";
    import { iconSize } from "../../stores/iconSize";
    import SingleUserSelector from "./SingleUserSelector.svelte";
    import Link from "../Link.svelte";
    import Select from "../Select.svelte";
    import BalanceWithRefresh from "./BalanceWithRefresh.svelte";

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
    $: symbol = cryptoLookup[token].symbol;
    $: howToBuyUrl = cryptoLookup[token].howToBuyUrl;
    $: transferFees = cryptoLookup[token].transferFeesE8s;
    $: group = chat.kind === "group_chat";
    $: remainingBalanceE8s =
        draftAmountE8s > BigInt(0)
            ? $cryptoBalance[token] - draftAmountE8s - transferFees
            : $cryptoBalance[token];
    $: valid =
        error === undefined &&
        draftAmountE8s > BigInt(0) &&
        receiver !== undefined &&
        !tokenChanging;
    $: zero = $cryptoBalance[token] <= transferFees && !tokenChanging;

    onMount(() => {
        // default the receiver to the other user in a direct chat
        if (chat.kind === "direct_chat") {
            receiver = $userStore[chat.them];
        } else {
            receiver = $userStore[defaultReceiver];
        }
    });

    function reset() {
        confirming = false;
        balanceWithRefresh.refresh();
    }

    function maxAmountE8s(balance: bigint): bigint {
        const maxAvailable = balance - transferFees;
        const maxAllowed = BigInt(10 * E8S_PER_TOKEN);
        return maxAvailable > maxAllowed ? maxAllowed : maxAvailable;
    }

    function send() {
        if (!confirming) {
            confirming = true;
            return;
        }

        if (receiver === undefined) return;

        const content = {
            kind: "crypto_content",
            caption: message === "" ? undefined : message,
            transfer: {
                token: token,
                kind: "pending",
                recipient: receiver.userId,
                amountE8s: draftAmountE8s,
            },
        };
        dispatch("sendTransfer", [content, undefined]);
        lastCryptoSent.set(token);
        dispatch("close");
    }

    function onTokenChanged() {
        tokenChanging = true;
        reset();
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
    <ModalContent fill={confirming}>
        <span class="header" slot="header">
            <div class="left">
                <span class="avatar">
                    <Avatar
                        url={client.userAvatarUrl(receiver)}
                        status={receiver
                            ? client.getUserStatus($now, $userStore, receiver.userId)
                            : UserStatus.None}
                        size={AvatarSize.Small} />
                </span>
                {#if process.env.ENABLE_MULTI_CRYPTO}
                    <div class="main-title">
                        <div>{$_("tokenTransfer.send")}</div>
                        <div>
                            <Select bind:value={token} margin={false} on:change={onTokenChanged}>
                                {#each cryptoCurrencyList as t}
                                    <option value={t}>{cryptoLookup[t].symbol}</option>
                                {/each}
                            </Select>
                        </div>
                    </div>
                {:else}
                    <div>{$_("tokenTransfer.title", { values: { token: symbol } })}</div>
                {/if}
            </div>
            <BalanceWithRefresh
                bind:this={balanceWithRefresh}
                {token}
                value={remainingBalanceE8s}
                label={draftAmountE8s > BigInt(0)
                    ? $_("cryptoAccount.shortRemainingBalanceLabel")
                    : $_("cryptoAccount.shortBalanceLabel")}
                bold
                on:click={() => (confirming = false)}
                on:refreshed={onBalanceRefreshed}
                on:error={onBalanceRefreshError} />
        </span>
        <form slot="body">
            <div class="body" class:confirming class:zero={zero || toppingUp}>
                {#if zero || toppingUp}
                    <AccountInfo qrSize={"smaller"} {user} />
                    {#if zero}
                        <p>{$_("tokenTransfer.zeroBalance", { values: { token: symbol } })}</p>
                    {/if}
                    <p>{$_("tokenTransfer.makeDeposit")}</p>
                    <p class="back">
                        <ArrowLeft size={"0.8em"} color={"var(--txt)"} />
                        <Link underline="always" on:click={reset}>
                            {$_("tokenTransfer.done")}
                        </Link>
                    </p>
                {:else if confirming}
                    <div class="alert">
                        <AlertOutline size={$iconSize} color={"var(--toast-failure-txt"} />
                    </div>
                    <div class="alert-txt">
                        {$_("tokenTransfer.warning", { values: { token: symbol } })}
                    </div>
                {:else}
                    {#if group}
                        <div class="receiver">
                            <Legend>{$_("tokenTransfer.receiver")}</Legend>
                            <SingleUserSelector
                                bind:selectedReceiver={receiver}
                                members={$currentChatMembers}
                                blockedUsers={$currentChatBlockedUsers}
                                autofocus={group} />
                        </div>
                    {/if}
                    <div class="transfer">
                        <Legend
                            >{$_("tokenTransfer.amount", {
                                values: { token: symbol },
                            })}</Legend>
                        <TokenInput
                            autofocus={!group}
                            maxAmountE8s={maxAmountE8s($cryptoBalance[token])}
                            bind:amountE8s={draftAmountE8s} />
                    </div>
                    <div class="message">
                        <Legend>{$_("tokenTransfer.message")}</Legend>
                        <Input
                            maxlength={100}
                            type={"text"}
                            autofocus={false}
                            countdown={true}
                            placeholder={$_("tokenTransfer.messagePlaceholder")}
                            bind:value={message} />
                    </div>
                    <div class="fee">
                        <span>
                            {$_("tokenTransfer.fee", {
                                values: {
                                    fee: client.formatTokens(transferFees, 0),
                                    token: symbol,
                                },
                            })}
                        </span>
                    </div>
                    {#if error}
                        <ErrorMessage>{$_(error)}</ErrorMessage>
                    {/if}
                {/if}
            </div>
        </form>
        <span class="footer" class:zero={zero || toppingUp} slot="footer">
            {#if !zero && !toppingUp}
                <span class="topup">
                    <Link underline={"always"} on:click={() => (toppingUp = true)}>
                        {$_("cryptoAccount.topUp")}
                    </Link>
                </span>
            {:else if !$mobileWidth}
                <a class="how-to" href={howToBuyUrl} target="_blank">
                    {$_("howToBuyToken", { values: { token: symbol } })}
                </a>
            {/if}
            <ButtonGroup>
                {#if zero}
                    <Button disabled={refreshing} loading={refreshing} tiny={true} on:click={reset}
                        >{$_("refresh")}</Button>
                {:else}
                    <Button disabled={!valid} tiny={true} on:click={send}
                        >{confirming
                            ? $_("tokenTransfer.confirm")
                            : $_("tokenTransfer.send")}</Button>
                {/if}
                <Button tiny={true} secondary={true} on:click={cancel}>{$_("cancel")}</Button>
            </ButtonGroup>
        </span>
    </ModalContent>
</Overlay>

<style type="text/scss">
    .header {
        display: flex;
        align-items: flex-start;
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
                margin-top: 6px;
            }
        }
    }

    .topup {
        @include font(book, normal, fs-90);
        text-transform: lowercase;
    }

    .body {
        padding: 0 $sp3;
        transition: background-color 100ms ease-in-out;

        &.zero {
            text-align: center;
            p {
                margin-bottom: $sp4;
            }
        }

        &.confirming {
            display: flex;
            gap: $sp4;
            justify-content: space-evenly;
            align-items: center;
            padding: $sp5;
            height: 200px;
            @include font(book, normal, fs-120);
            background-color: var(--toast-failure-bg);
            color: var(--toast-failure-txt);

            .alert {
                flex: 0 0 50px;
            }
        }
    }

    .back {
        @include font(light, normal, fs-90);
    }

    .transfer {
        margin-bottom: $sp4;
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

        @include mobile() {
            &.zero {
                justify-content: center;
            }
        }
    }
    .fee {
        @include font(light, normal, fs-60);
        margin-bottom: $sp3;
        text-transform: lowercase;
    }
</style>

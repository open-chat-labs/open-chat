<script lang="ts">
    import Button from "../Button.svelte";
    import type {
        AcceptP2PSwapResponse,
        CancelP2PSwapResponse,
        MessageContext,
        OpenChat,
        P2PSwapContent,
        ResourceKey,
    } from "openchat-client";
    import {
        currentUser as user,
        cryptoLookup,
        isDiamond,
        exchangeRatesLookupStore as exchangeRatesLookup,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Clock from "svelte-material-icons/Clock.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import SwapIcon from "svelte-material-icons/SwapHorizontal.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import { rtlStore } from "../../stores/rtl";
    import { now500 } from "../../stores/time";
    import SpinningToken from "../icons/SpinningToken.svelte";
    import { toastStore } from "../../stores/toast";
    import AreYouSure from "../AreYouSure.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import Markdown from "./Markdown.svelte";
    import AcceptP2PSwapModal from "./AcceptP2PSwapModal.svelte";
    import Translatable from "../Translatable.svelte";
    import { calculateDollarAmount } from "../../utils/exchange";
    import P2PSwapProgress from "./P2PSwapProgress.svelte";
    import { pinNumberErrorMessageStore } from "../../stores/pinNumber";
    import { publish } from "@src/utils/pubsub";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let senderId: string;
    export let content: P2PSwapContent;
    export let messageContext: MessageContext;
    export let messageId: bigint;
    export let me: boolean;
    export let reply: boolean;
    export let pinned: boolean;

    let buttonText: ResourceKey;
    let instructionText: string | undefined = undefined;
    let summaryText: ResourceKey | undefined = undefined;
    let confirming = false;
    let showDetails = false;

    $: fromDetails = $cryptoLookup[content.token0.ledger];
    $: toDetails = $cryptoLookup[content.token1.ledger];
    $: finished = $now500 >= Number(content.expiresAt);
    $: timeRemaining = finished
        ? $_("p2pSwap.expired")
        : client.formatTimeRemaining($now500, Number(content.expiresAt));
    $: acceptedByYou =
        (content.status.kind === "p2p_swap_reserved" &&
            content.status.reservedBy === $user.userId) ||
        ((content.status.kind === "p2p_swap_accepted" ||
            content.status.kind === "p2p_swap_completed") &&
            content.status.acceptedBy === $user.userId);

    $: fromAmount = client.formatTokens(content.token0Amount, content.token0.decimals);
    $: toAmount = client.formatTokens(content.token1Amount, content.token1.decimals);
    $: buttonDisabled = content.status.kind !== "p2p_swap_open" || reply || pinned;
    $: fromAmountInUsd = calculateDollarAmount(
        content.token0Amount,
        $exchangeRatesLookup[fromDetails.symbol.toLowerCase()]?.toUSD,
        fromDetails.decimals,
    );
    $: toAmountInUsd = calculateDollarAmount(
        content.token1Amount,
        $exchangeRatesLookup[toDetails.symbol.toLowerCase()]?.toUSD,
        toDetails.decimals,
    );

    $: {
        if (content.status.kind === "p2p_swap_open") {
            if (me) {
                instructionText = undefined;
                buttonText = i18nKey("p2pSwap.cancel");
            } else {
                instructionText = undefined;
                buttonText = i18nKey("p2pSwap.accept");
            }
        } else if (content.status.kind === "p2p_swap_cancelled") {
            instructionText = undefined;
            buttonText = i18nKey("p2pSwap.cancelled");
        } else if (content.status.kind === "p2p_swap_expired") {
            instructionText = undefined;
            buttonText = i18nKey("p2pSwap.expired");
        } else if (content.status.kind === "p2p_swap_reserved") {
            if (acceptedByYou) {
                instructionText = $_("p2pSwap.youReserved");
            } else {
                instructionText = $_("p2pSwap.reservedBy", {
                    values: { user: `@UserId(${content.status.reservedBy})` },
                });
            }
            buttonText = i18nKey("p2pSwap.reserved");
        } else if (content.status.kind === "p2p_swap_accepted") {
            if (acceptedByYou) {
                instructionText = $_("p2pSwap.youAccepted");
            } else {
                instructionText = $_("p2pSwap.acceptedBy", {
                    values: { user: `@UserId(${content.status.acceptedBy})` },
                });
            }
            buttonText = i18nKey("p2pSwap.accepted");
        } else if (content.status.kind === "p2p_swap_completed") {
            if (acceptedByYou) {
                instructionText = $_("p2pSwap.youCompleted");
            } else {
                instructionText = $_("p2pSwap.completed", {
                    values: { user: `@UserId(${content.status.acceptedBy})` },
                });
            }
            buttonText = i18nKey("p2pSwap.accepted");
        }

        summaryText = i18nKey("p2pSwap.summary", {
            fromAmount,
            toAmount,
            fromToken: content.token0.symbol,
            toToken: content.token1.symbol,
        });
    }

    function onAcceptOrCancel(e: MouseEvent) {
        if (e.isTrusted && !buttonDisabled) {
            if (!me && !$isDiamond) {
                publish("upgrade");
            } else {
                confirming = true;
            }
        }
    }

    function cancel(yes: boolean): Promise<void> {
        confirming = false;

        if (yes && me) {
            client
                .cancelP2PSwap(
                    messageContext.chatId,
                    messageContext.threadRootMessageIndex,
                    messageId,
                )
                .then((resp) => {
                    if (resp.kind !== "success") {
                        showFailureToast(resp, false);
                    }
                });
        }

        return Promise.resolve();
    }

    function accept() {
        confirming = false;

        if (!me) {
            client
                .acceptP2PSwap(
                    messageContext.chatId,
                    messageContext.threadRootMessageIndex,
                    messageId,
                )
                .then((resp) => {
                    if (resp.kind !== "success") {
                        showFailureToast(resp, true);
                    }
                });
        }
    }

    function showFailureToast(
        response: AcceptP2PSwapResponse | CancelP2PSwapResponse,
        accepting: boolean,
    ) {
        if ($pinNumberErrorMessageStore !== undefined) {
            toastStore.showFailureToast(pinNumberErrorMessageStore);
            return;
        }

        let key: string = response.kind;

        switch (key) {
            case "already_reserved":
            case "already_completed":
                key = "already_accepted";
                break;
            case "channel_not_found":
            case "chat_not_found":
            case "user_suspended":
            case "user_not_in_group":
            case "user_not_in_community":
            case "user_not_in_channel":
            case "chat_frozen":
            case "insufficient_funds":
            case "internal_error":
                key = accepting ? "unknown_accept_error" : "unknown_cancel_error";
                break;
        }

        toastStore.showFailureToast(i18nKey("p2pSwap." + key));
    }

    function onSwapClick() {
        if (!confirming) {
            showDetails = true;
        }
    }
</script>

{#if confirming}
    {#if me}
        <AreYouSure
            message={i18nKey("p2pSwap.confirmCancel", {
                amount: fromAmount,
                token: content.token0.symbol,
            })}
            action={cancel} />
    {:else}
        <AcceptP2PSwapModal
            ledger0={content.token0.ledger}
            ledger1={content.token1.ledger}
            amount0={content.token0Amount}
            amount1={content.token1Amount}
            onAccept={accept}
            onClose={() => (confirming = false)} />
    {/if}
{:else if showDetails}
    <P2PSwapProgress {senderId} {content} onClose={() => (showDetails = false)} />
{/if}

<div class="swap">
    <div class="top">
        {#if content.status.kind === "p2p_swap_open"}
            <div class="countdown" class:rtl={$rtlStore}>
                <Clock size={"1em"} color={"#ffffff"} />
                <span>{timeRemaining}</span>
            </div>
        {/if}
        <div class="coins" on:click={onSwapClick}>
            <div class="coin">
                <SpinningToken logo={fromDetails.logo} spin={false} size="medium" />
                <div class="amount">
                    <div>{fromAmount} {content.token0.symbol}</div>
                    <div class="dollar">({fromAmountInUsd} USD)</div>
                </div>
            </div>

            <div class="swap-icon">
                <SwapIcon size={"2.5em"} />
            </div>

            <div class="coin">
                <SpinningToken logo={toDetails.logo} spin={false} size="medium" />
                <div class="amount">
                    <div>{toAmount} {content.token1.symbol}</div>
                    <div class="dollar">({toAmountInUsd} USD)</div>
                </div>
            </div>
        </div>
    </div>
    <div class="bottom">
        {#if content.caption !== undefined}
            <div class="caption">
                {content.caption}
            </div>
        {/if}
        {#if summaryText !== undefined}
            <div class="summary"><Translatable resourceKey={summaryText} /></div>
        {/if}
        {#if instructionText !== undefined}
            <div class="instructions">
                <Markdown text={instructionText} />
            </div>
        {/if}
        <div class="accept">
            <ButtonGroup align="fill">
                <Button
                    loading={content.status.kind === "p2p_swap_reserved" ||
                        content.status.kind === "p2p_swap_accepted"}
                    disabled={buttonDisabled}
                    hollow
                    on:click={onAcceptOrCancel}>
                    <Translatable resourceKey={buttonText} />
                </Button>
            </ButtonGroup>
        </div>
    </div>
</div>

<style lang="scss">
    $accent: var(--prize);

    .swap .bottom .accept {
        :global(button:not(.disabled)) {
            border: 1px solid $accent !important;
        }

        :global(button:not(.disabled):hover) {
            background-color: $accent;
            color: var(--button-txt);
        }

        :global(button.loading) {
            background-color: $accent;
            color: var(--button-txt);
        }

        min-height: 45px !important;
        min-width: unset !important;
    }

    .swap {
        max-width: 400px;
        padding: 0 $sp3 $sp3 $sp3;
    }

    .top {
        position: relative;
        margin-bottom: $sp4;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }

    .countdown {
        @include font-size(fs-60);
        font-weight: 700;
        display: flex;
        gap: $sp2;
        align-items: center;
        border-radius: var(--rd);
        color: white;
        background-color: rgba(0, 0, 0, 0.3);
        padding: $sp2 $sp3;
        text-transform: lowercase;

        &.rtl {
            left: unset;
            right: 10px;
        }
    }

    .summary,
    .instructions,
    .caption {
        @include font(book, normal, fs-80);
        margin-bottom: $sp4;
    }

    .coins {
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        margin-top: $sp3;
        width: 100%;
        cursor: pointer;
    }

    .amount {
        @include font(bold, normal, fs-80);
        text-align: center;

        .dollar {
            @include font(light, normal, fs-60);
        }
    }

    .swap-icon {
        height: 2.5em;
        position: relative;
        top: calc(2.5rem - 12px);
    }

    .coin {
        display: flex;
        flex-direction: column;
        gap: $sp2;
        align-items: center;
        flex: 1;
    }
</style>

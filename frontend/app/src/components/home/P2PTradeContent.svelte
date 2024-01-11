<script lang="ts">
    import Button from "../Button.svelte";
    import type { MessageContext, OpenChat, P2PTradeContent } from "openchat-client";
    import { _ } from "svelte-i18n";
    import Clock from "svelte-material-icons/Clock.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import SwapIcon from "svelte-material-icons/SwapHorizontal.svelte";
    import { getContext } from "svelte";
    import { rtlStore } from "../../stores/rtl";
    import { now500 } from "../../stores/time";
    import SpinningToken from "../icons/SpinningToken.svelte";
    import { toastStore } from "../../stores/toast";
    import AreYouSure from "../AreYouSure.svelte";

    const client = getContext<OpenChat>("client");

    export let content: P2PTradeContent;
    export let messageContext: MessageContext;
    export let messageIndex: number;
    export let messageId: bigint;
    export let me: boolean;

    let buttonDisabled = false;
    let buttonText = "";
    let instructionText = "";
    let summaryText = "";
    let confirming = false;

    $: user = client.user;
    $: cryptoLookup = client.cryptoLookup;
    $: fromLogo =
        Object.values($cryptoLookup).find(
            (t) => t.symbol.toLowerCase() === content.inputToken.symbol.toLowerCase(),
        )?.logo ?? "";
    $: toLogo =
        Object.values($cryptoLookup).find(
            (t) => t.symbol.toLowerCase() === content.outputToken.symbol.toLowerCase(),
        )?.logo ?? "";
    $: fromDetails = $cryptoLookup[content.inputToken.decimals];
    $: toDetails = $cryptoLookup[content.outputToken.decimals];
    $: finished = $now500 >= Number(content.expiresAt);
    $: timeRemaining = finished
        ? $_("p2pTrade.expired")
        : client.formatTimeRemaining($now500, Number(content.expiresAt));
    $: acceptedByYou =
        (content.status.kind === "p2p_trade_reserved" ||
            content.status.kind === "p2p_trade_completed") &&
        content.status.userId === $user.userId;

    $: fromAmount = client.formatTokens(content.inputAmount, fromDetails.decimals);
    $: toAmount = client.formatTokens(content.outputAmount, toDetails.decimals);

    $: {
        if (content.status.kind === "p2p_trade_open") {
            if (me) {
                instructionText = $_("p2pTrade.clickToCancel");
                buttonText = $_("p2pTrade.cancel");
            } else {
                instructionText = $_("p2pTrade.clickToAccept");
                buttonText = $_("p2pTrade.accept");
            }
        } else if (content.status.kind === "p2p_trade_cancelled") {
            if (me) {
                instructionText = $_("p2pTrade.youCancelled");
            } else {
                instructionText = $_("p2pTrade.offerCancelled");
            }
            buttonText = $_("p2pTrade.cancelled");
        } else if (content.status.kind === "p2p_trade_reserved") {
            if (acceptedByYou) {
                instructionText = $_("p2pTrade.youReserved");
            } else {
                instructionText = $_("p2pTrade.reservedBy", {
                    values: { user: `@UserId(${content.status.userId})` },
                });
            }
            buttonText = $_("p2pTrade.reserved");
        } else {
            if (acceptedByYou) {
                instructionText = $_("p2pTrade.youAccepted");
            } else {
                instructionText = $_("p2pTrade.acceptedBy", {
                    values: { user: `@UserId(${content.status.userId})` },
                });
            }
            buttonText = $_("p2pTrade.accepted");
        }

        summaryText = $_("p2pTrade.summary", {
            values: {
                fromAmount,
                toAmount,
                fromToken: fromDetails.symbol,
                toToken: toDetails.symbol,
            },
        });
    }

    function onAcceptOrCancel(e: MouseEvent) {
        if (e.isTrusted) {
            confirming = true;
        }
    }

    function acceptOrCancel(yes: boolean): Promise<void> {
        confirming = false;

        if (yes) {
            if (me) {
                // TODO: cancel??
            } else {
                client
                    .acceptP2PTradeOffer(
                        messageContext.chatId,
                        messageContext.threadRootMessageIndex,
                        messageId,
                    )
                    .then((resp) => {
                        if (resp !== "success") {
                            toastStore.showFailureToast(resp);
                        }
                    });
            }
        }

        return Promise.resolve();
    }
</script>

{#if confirming}
    <AreYouSure
        message={me ? $_("p2pTrade.confirmCancel") : $_("p2pTrade.conmfirmAccept")}
        action={acceptOrCancel} />
{/if}

<div class="swap">
    <div class="top">
        <div class="countdown" class:rtl={$rtlStore}>
            <Clock size={"1em"} color={"#ffffff"} />
            <span>
                {#if !finished}
                    {$_("p2pTrade.accepted")}
                {:else}
                    {timeRemaining}
                {/if}
            </span>
        </div>
        <div class="coins">
            <div class="coin">
                <SpinningToken logo={fromLogo} spin={false} />
                <div class="amount">{fromAmount}</div>
            </div>

            <div><SwapIcon size={"3em"} /></div>

            <div class="coin">
                <SpinningToken logo={toLogo} spin={false} />
                <div class="amount">{toAmount}</div>
            </div>
        </div>
    </div>
    <div class="bottom">
        {#if content.caption !== undefined}
            <div class="caption">
                {content.caption}
            </div>
        {/if}
        <div class="summary">{summaryText}</div>
        <div class="instructions">{instructionText}</div>
        <div class="accept">
            <ButtonGroup align="fill">
                <Button
                    loading={content.status.kind === "p2p_trade_reserved"}
                    disabled={buttonDisabled}
                    hollow
                    on:click={onAcceptOrCancel}>{buttonText}</Button>
            </ButtonGroup>
        </div>
    </div>
</div>

<style lang="scss">
    $accent: var(--prize);

    :global(.accept button) {
        &:not(.disabled) {
            border: 1px solid $accent !important;
        }
        min-height: 45px !important;
        min-width: unset !important;

        &:not(.disabled):hover,
        &.loading {
            background-color: $accent;
            color: var(--button-txt);
        }
    }

    .swap {
        max-width: 400px;
    }

    .top {
        position: relative;
        padding: 30px 0 30px 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        background: radial-gradient(circle, rgba(238, 31, 122, 1) 0%, rgba(59, 12, 190, 1) 80%);
    }

    .countdown {
        @include font-size(fs-60);
        font-weight: 700;
        position: absolute;
        display: flex;
        gap: $sp2;
        align-items: center;
        border-radius: var(--rd);
        color: white;
        top: 10px;
        left: 10px;
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

    .bottom {
        padding: $sp4;
    }

    .coins {
        display: flex;
        flex-direction: row;
        gap: 40px;
        justify-content: space-between;
    }

    .coin {
        display: flex;
        flex-direction: column;
        gap: 30px;
        justify-content: space-between;
    }
</style>

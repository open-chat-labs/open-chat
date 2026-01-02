<script lang="ts">
    import { BodySmall, Chip, Column, CommonButton, Row } from "component-lib";
    import type { MessageContext, OpenChat, P2PSwapContentInitial } from "openchat-client";
    import {
        enhancedCryptoLookup as cryptoLookup,
        isDiamondStore,
        localUpdates,
        ONE_DAY,
        publish,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Paperclip from "svelte-material-icons/Paperclip.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import AreYouSure from "../AreYouSure.svelte";
    import Translatable from "../Translatable.svelte";
    import CryptoSelector from "./CryptoSelector.svelte";
    import DurationSelector from "./DurationSelector.svelte";
    import SlidingPageContent from "./SlidingPageContent.svelte";
    import TokenInput from "./TokenInput.svelte";
    import TransferFeesMessage from "./TransferFeesMessage.svelte";
    import { TokenState } from "./wallet/walletState.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        fromLedger: string;
        messageContext: MessageContext;
        onClose: () => void;
    }

    let { fromLedger = $bindable(), messageContext, onClose }: Props = $props();

    let toLedger: string = $state(initialToLedger());
    let fromDetails = $derived($cryptoLookup.get(fromLedger)!);
    let toDetails = $derived($cryptoLookup.get(toLedger)!);
    let fromState = $derived(new TokenState(fromDetails));
    let toState = $derived(new TokenState(toDetails));
    let fromAmount: bigint = $state(0n);
    let fromAmountValid: boolean = $state(false);
    let toAmount: bigint = $state(0n);
    let toAmountValid: boolean = $state(false);
    let expiresIn: bigint = $state(BigInt(ONE_DAY));
    let error: string | undefined = $state(undefined);
    let tokenInputState: "ok" | "zero" | "too_low" | "too_high" = $state("ok");
    let confirming = $state(false);

    let totalFees = $derived(fromDetails.transferFee * BigInt(2));
    let minAmount = $derived(fromDetails.transferFee * BigInt(10));
    let valid = $derived(error === undefined && fromAmountValid && toAmountValid);

    function initialToLedger() {
        // just grab any old ledger for starters
        return [...$cryptoLookup.keys()].find((l) => l !== fromLedger) ?? "";
    }

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
            caption: undefined,
            expiresIn,
        };

        localUpdates.draftMessages.setAttachment(messageContext, content);
        onClose();
        return Promise.resolve();
    }

    function onSelectFromToken(ledger: string, _: string) {
        if (ledger === toLedger) {
            toLedger =
                [...$cryptoLookup.values()].map((t) => t.ledger).find((l) => l !== toLedger) ??
                toLedger;
        }
    }

    function setFromAmount(percentage: number) {
        fromAmount =
            BigInt(Math.floor(Number(fromDetails.balance) * (percentage / 100))) -
            fromState.transferFees * 2n;
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

{#snippet percentage(perc: number)}
    <Chip fill mode={"rounded"} onClick={() => setFromAmount(perc)}>
        {`${perc}%`}
    </Chip>
{/snippet}

<SlidingPageContent title={i18nKey("Create a swap offer")} subtitle={i18nKey("P2P Swap")}>
    <Column gap={"xl"} padding={["lg", "xl"]}>
        <Column>
            <BodySmall fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Token to offer")} />
            </BodySmall>
            <BodySmall colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "This is the token that you are offering for exchange. You can only swap tokens for which you hold a non-zero balance. Top up via your wallet if necessary.",
                    )} />
            </BodySmall>
        </Column>

        <Column gap={"md"}>
            <CryptoSelector
                filter={(t) => t.balance > 0}
                bind:ledger={fromLedger}
                draftAmount={fromAmount}
                showRefresh
                onSelect={onSelectFromToken} />
            <TokenInput
                ledger={fromLedger}
                {minAmount}
                bind:status={tokenInputState}
                bind:valid={fromAmountValid}
                bind:amount={fromAmount}>
                {#snippet subtext()}
                    {`Minimum amount ${fromState.formatTokens(minAmount)} ${fromState.symbol}`}
                {/snippet}
                {#snippet converted()}
                    <BodySmall colour={"textSecondary"}>
                        {`${fromState.formatConvertedTokens(fromAmount)}`}
                    </BodySmall>
                {/snippet}
            </TokenInput>

            <Row mainAxisAlignment={"spaceBetween"} gap={"sm"}>
                {@render percentage(25)}
                {@render percentage(50)}
                {@render percentage(75)}
                {@render percentage(100)}
            </Row>
        </Column>

        <Column>
            <BodySmall fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Token to receive")} />
            </BodySmall>
            <BodySmall colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "This is the token that you would like to receive in return. You decide how many tokens you would like to receive in the exchange.",
                    )} />
            </BodySmall>
        </Column>
        <Column gap={"md"}>
            <CryptoSelector filter={(t) => t.ledger !== fromLedger} bind:ledger={toLedger} />

            <TokenInput ledger={toLedger} bind:valid={toAmountValid} bind:amount={toAmount}>
                {#snippet subtext()}
                    {`The amount of ${toDetails.symbol} tokens you would like in return`}
                {/snippet}
                {#snippet converted()}
                    <BodySmall colour={"textSecondary"}>
                        {`${toState.formatConvertedTokens(toAmount)}`}
                    </BodySmall>
                {/snippet}
            </TokenInput>
        </Column>
        <DurationSelector bind:duration={expiresIn}>
            {#snippet title()}
                <BodySmall fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Swap expiry time")} />
                </BodySmall>
            {/snippet}
        </DurationSelector>

        <Row mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"end"}>
            <TransferFeesMessage
                symbol={fromDetails.symbol}
                tokenDecimals={fromDetails.decimals}
                transferFees={totalFees} />
            <CommonButton disabled={!valid} onClick={onSend} mode={"active"} size={"medium"}>
                {#snippet icon(color, size)}
                    <Paperclip {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Confirm")} />
            </CommonButton>
        </Row>
    </Column>
</SlidingPageContent>

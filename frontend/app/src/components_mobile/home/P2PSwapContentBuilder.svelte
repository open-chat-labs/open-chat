<script lang="ts">
    import { Body, Subtitle, Column, CommonButton2, Row, ColourVars } from "component-lib";
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
</script>

{#if confirming}
    <AreYouSure
        message={i18nKey("p2pSwap.confirmSend", {
            amount: client.formatTokens(fromAmount + totalFees, fromDetails.decimals),
            token: fromDetails.symbol,
        })}
        action={send} />
{/if}

<SlidingPageContent title={i18nKey("Create swap offer")}>
    <Column gap={"xl"} padding={["lg", "lg", "huge"]} overflow="auto" height="fill">
        <!-- Container for swap info -->
        <Column
            backgroundColor={ColourVars.background1}
            padding={["xl", "lg"]}
            borderRadius="lg"
            gap="xxl">
            <!-- Send token -->
            <Column gap={"xl"}>
                <Column gap="md">
                    <Subtitle fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("Token to swap")} />
                    </Subtitle>
                    <Body colour={"textSecondary"}>
                        <Translatable
                            resourceKey={i18nKey(
                                "This is the token that you are offering for exchange. You can only swap tokens for which you hold a non-zero balance. Top up via your wallet if necessary.",
                            )} />
                    </Body>
                </Column>
                <CryptoSelector
                    filter={(t) => t.balance > 0}
                    bind:ledger={fromLedger}
                    draftAmount={fromAmount}
                    showRefresh
                    onSelect={onSelectFromToken} />
                <TokenInput
                    placeholder="Swap amount"
                    balance={fromState.cryptoBalance}
                    ledger={fromLedger}
                    {minAmount}
                    converted={fromState.formatConvertedTokens(fromAmount)}
                    bind:status={tokenInputState}
                    bind:valid={fromAmountValid}
                    bind:amount={fromAmount}>
                    {#snippet subtext()}
                        {`Minimum amount ${fromState.formatTokens(minAmount)} ${fromState.symbol}`}
                    {/snippet}
                </TokenInput>
            </Column>

            <!-- Receive token -->
            <Column gap={"xl"}>
                <Column gap="md">
                    <Subtitle fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("Token to receive")} />
                    </Subtitle>
                    <Body colour={"textSecondary"}>
                        <Translatable
                            resourceKey={i18nKey(
                                "This is the token that you would like to receive in return. You decide how many tokens you would like to receive in the exchange.",
                            )} />
                    </Body>
                </Column>
                <CryptoSelector filter={(t) => t.ledger !== fromLedger} bind:ledger={toLedger} />
                <TokenInput
                    placeholder="Receive amount"
                    ledger={toLedger}
                    converted={toState.formatConvertedTokens(toAmount)}
                    bind:valid={toAmountValid}
                    bind:amount={toAmount} />
            </Column>
        </Column>

        <!-- Duration selection -->
        <Column padding={["zero", "lg"]}>
            <DurationSelector bind:duration={expiresIn}>
                {#snippet title()}
                    <Subtitle fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("Swap expiry time")} />
                    </Subtitle>
                {/snippet}
            </DurationSelector>
        </Column>

        <!-- Fees and button -->
        <Row
            mainAxisAlignment="spaceBetween"
            crossAxisAlignment="center"
            padding={["lg", "md"]}
            gap="xl">
            <TransferFeesMessage
                symbol={fromDetails.symbol}
                tokenDecimals={fromDetails.decimals}
                transferFees={totalFees} />
            <CommonButton2 onClick={onSend} variant="primary" mode={"regular"} disabled={!valid}>
                {#snippet icon(color, size)}
                    <Paperclip {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Confirm")} />
            </CommonButton2>
        </Row>
    </Column>
</SlidingPageContent>

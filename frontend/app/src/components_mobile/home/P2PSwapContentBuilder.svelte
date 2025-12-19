<script lang="ts">
    import {
        Body,
        BodySmall,
        Chip,
        Column,
        CommonButton,
        IconButton,
        Row,
        Sheet,
        transition,
    } from "component-lib";
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
    import ArrowRight from "svelte-material-icons/ArrowRight.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import Paperclip from "svelte-material-icons/Paperclip.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import AreYouSure from "../AreYouSure.svelte";
    import Translatable from "../Translatable.svelte";
    import CryptoSelector from "./CryptoSelector.svelte";
    import DurationSelector from "./DurationSelector.svelte";
    import TokenInput from "./TokenInput.svelte";
    import TransferFeesMessage from "./TransferFeesMessage.svelte";
    import { TokenState } from "./wallet/walletState.svelte";

    type Step = "from" | "to";

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
    let step = $state<Step>("from");
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

    function next() {
        if (step === "from") {
            transition(["fade"], () => {
                step = "to";
            });
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

{#snippet percentage(perc: number)}
    <Chip fill mode={"rounded"} onClick={() => setFromAmount(perc)}>
        {`${perc}%`}
    </Chip>
{/snippet}

<Sheet onDismiss={onClose}>
    <Column gap={"lg"} padding={["lg", "xl"]}>
        <Row>
            <Body fontWeight={"bold"}>
                {#if step === "from"}
                    <Translatable resourceKey={i18nKey("Select token to swap")} />
                {:else}
                    <Translatable resourceKey={i18nKey("Select token to receive")} />
                {/if}
            </Body>
            <IconButton onclick={onClose}>
                {#snippet icon(color)}
                    <Close {color} />
                {/snippet}
            </IconButton>
        </Row>

        {#if step === "from"}
            <CryptoSelector
                filter={(t) => t.balance > 0}
                bind:ledger={fromLedger}
                showRefresh
                onSelect={onSelectFromToken} />

            <Column gap={"md"}>
                <!-- TODO desktop TokenInput has the ability to showDollarAmount which I removed for some reason -->
                <TokenInput
                    ledger={fromLedger}
                    {minAmount}
                    maxAmount={fromDetails.balance - totalFees}
                    bind:status={tokenInputState}
                    bind:valid={fromAmountValid}
                    bind:amount={fromAmount}>
                    {#snippet subtext()}
                        {`Minimum amount ${fromState.formatTokens(minAmount)} ${fromState.symbol}`}
                    {/snippet}
                </TokenInput>

                <Row mainAxisAlignment={"spaceBetween"} gap={"sm"}>
                    {@render percentage(25)}
                    {@render percentage(50)}
                    {@render percentage(75)}
                    {@render percentage(100)}
                </Row>
            </Column>
        {:else}
            <CryptoSelector filter={(t) => t.ledger !== fromLedger} bind:ledger={toLedger} />

            <TokenInput ledger={toLedger} bind:valid={toAmountValid} bind:amount={toAmount} />

            <DurationSelector bind:duration={expiresIn}>
                {#snippet title()}
                    <BodySmall fontWeight={"bold"}>
                        <Translatable resourceKey={i18nKey("Swap expiry time")} />
                    </BodySmall>
                {/snippet}
            </DurationSelector>
        {/if}

        <Row
            mainAxisAlignment={step === "from" ? "end" : "spaceBetween"}
            crossAxisAlignment={"end"}>
            {#if step === "to"}
                <TransferFeesMessage
                    symbol={fromDetails.symbol}
                    tokenDecimals={fromDetails.decimals}
                    transferFees={totalFees} />
            {/if}
            {#if step === "from"}
                <CommonButton
                    disabled={!fromAmountValid}
                    onClick={next}
                    mode={"active"}
                    size={"medium"}>
                    {#snippet icon(color, size)}
                        <ArrowRight {color} {size} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Next 1/2")} />
                </CommonButton>
            {:else}
                <CommonButton disabled={!valid} onClick={onSend} mode={"active"} size={"medium"}>
                    {#snippet icon(color, size)}
                        <Paperclip {color} {size} />
                    {/snippet}
                    <Translatable resourceKey={i18nKey("Confirm")} />
                </CommonButton>
            {/if}
        </Row>
    </Column>
</Sheet>

<!-- <Overlay dismissible>
    <ModalContent>
        {#snippet header()}
            <span class="header">
                <div class="main-title">
                    <Translatable resourceKey={i18nKey("p2pSwap.builderTitle")} />
                </div>
                <BalanceWithRefresh
                    ledger={fromLedger}
                    value={remainingBalance}
                    onRefreshed={onBalanceRefreshed}
                    onError={onBalanceRefreshError} />
            </span>
        {/snippet}
        {#snippet body()}
            <form class="body swap-builder">
                <div class="row">
                    <div class="select-from">
                        <Legend label={i18nKey("cryptoAccount.transactionHeaders.from")} />
                        <div class="inner">
                            <CryptoSelector
                                filter={(t) => t.balance > 0}
                                bind:ledger={fromLedger}
                                onSelect={onSelectFromToken} />
                        </div>
                    </div>
                    <div class="amount">
                        <TokenInput
                            ledger={fromLedger}
                            {minAmount}
                            maxAmount={fromDetails.balance - totalFees}
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
</Overlay> -->

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

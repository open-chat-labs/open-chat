<script lang="ts">
    import type { OpenChat, ResourceKey } from "@client";
    import {
        enhancedCryptoLookup as cryptoLookup,
        mobileWidth,
        swappableTokensStore,
    } from "@client";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../../stores/pinNumber";
    import AlertBox from "../../AlertBox.svelte";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Checkbox from "../../Checkbox.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Legend from "../../Legend.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import CryptoSelector from "../CryptoSelector.svelte";
    import Markdown from "@shared_components/Markdown.svelte";
    import TokenInput from "../TokenInput.svelte";
    import SwapProgress from "./SwapProgress.svelte";
    import SwapQuotes from "./SwapQuotes.svelte";
    import { TokenState } from "@shared_components/home/wallet/walletState.svelte";
    import { SwapForm } from "@shared_components/home/wallet/swapForm.svelte";

    interface Props {
        ledgerIn: string;
        onClose: () => void;
    }

    let { ledgerIn, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    // The modal is opened for one token; the user can pick another
    const form = new SwapForm(client, new TokenState(untrack(() => $cryptoLookup.get(ledgerIn))));

    let balanceError = $state<ResourceKey>();
    let tokenIn = $derived(form.inToken.token);
    let tokenOut = $derived(form.outToken?.token);
    let outcome = $derived(form.outcome);
    // After these the user can try again: quote again after a changed rate, or change the amount
    let canRetry = $derived(
        outcome === undefined ||
            outcome.kind === "rate_changed" ||
            outcome.kind === "insufficient_funds",
    );
    let canClick = $derived(
        form.stage === "confirm"
            ? form.canSwap
            : outcome?.kind === "insufficient_funds" || form.canQuote,
    );
    let primaryButtonText = $derived(
        i18nKey(
            form.stage === "quote"
                ? "tokenSwap.quote"
                : form.stage === "confirm"
                  ? "tokenSwap.swap"
                  : outcome?.kind === "insufficient_funds"
                    ? "tokenSwap.back"
                    : "tokenSwap.requote",
        ),
    );
    let title = $derived(
        form.stage === "quote" || tokenOut === undefined
            ? i18nKey("tokenSwap.swapToken", { tokenIn: tokenIn.symbol })
            : i18nKey("tokenSwap.swapTokenTo", {
                  tokenIn: tokenIn.symbol,
                  tokenOut: tokenOut.symbol,
              }),
    );
    let errorMessage = $derived($pinNumberErrorMessageStore ?? form.error ?? balanceError);

    function onPrimaryClick() {
        if (form.stage === "confirm") {
            form.swap();
        } else if (outcome?.kind === "insufficient_funds") {
            form.inToken.draftAmount = 0n;
            form.backToQuote();
        } else {
            form.getQuote();
        }
    }

    function selectIn(ledger: string) {
        const token = $cryptoLookup.get(ledger);
        if (token === undefined) return;
        form.selectIn(token);
    }

    function selectOut(ledger: string | undefined) {
        const token = ledger !== undefined ? $cryptoLookup.get(ledger) : undefined;
        if (token !== undefined) form.selectOut(token);
    }
</script>

<ModalContent>
    {#snippet header()}
        <span class="header">
            <div class="main-title"><Translatable resourceKey={title} /></div>
            {#if form.stage === "quote"}
                <BalanceWithRefresh
                    ledger={form.inToken.ledger}
                    value={form.inToken.remainingBalance}
                    label={i18nKey("cryptoAccount.shortBalanceLabel")}
                    bold
                    onRefreshed={() => (balanceError = undefined)}
                    onError={(err) => (balanceError = i18nKey(err))}
                />
            {/if}
        </span>
    {/snippet}
    {#snippet body()}
        <form class="body">
            {#if form.loaded}
                {#if form.stage === "quote"}
                    <div class="swap">
                        <div class="select-from">
                            <Legend label={i18nKey("cryptoAccount.transactionHeaders.from")} />
                            <div class="inner">
                                <CryptoSelector
                                    filter={(t) =>
                                        t.balance > 0 && $swappableTokensStore.has(t.ledger)}
                                    ledger={form.inToken.ledger}
                                    onSelect={selectIn}
                                />
                            </div>
                        </div>
                        <div class="amount">
                            <TokenInput
                                ledger={form.inToken.ledger}
                                minAmount={form.inToken.minAmount}
                                maxAmount={tokenIn.balance}
                                bind:valid={form.validAmount}
                                bind:amount={form.inToken.draftAmount}
                            />
                        </div>
                        <div class="select-to">
                            <Legend label={i18nKey("cryptoAccount.transactionHeaders.to")} />
                            <div class="inner">
                                <CryptoSelector
                                    filter={(t) => t.ledger in form.swaps}
                                    bind:ledger={() => form.outToken?.ledger, selectOut}
                                />
                            </div>
                        </div>
                    </div>
                {/if}

                {#if (form.stage === "quote" || form.stage === "confirm") && form.quotes.length > 0 && tokenOut !== undefined}
                    <SwapQuotes
                        quotes={form.quotes}
                        symbolOut={tokenOut.symbol}
                        decimalsOut={tokenOut.decimals}
                        best={form.quote?.dex} />
                {/if}

                {#if (form.stage === "swapping" || form.stage === "done") && form.quote !== undefined && tokenOut !== undefined}
                    <div>
                        <SwapProgress
                            values={form.quote.values}
                            decimalsOut={tokenOut.decimals}
                            step={form.step}
                            {outcome}
                        />
                    </div>
                {/if}

                {#if form.stage === "confirm" && form.quote !== undefined}
                    {@const swapMessageValues = form.quote.values}
                    <div>{$_("tokenSwap.bestQuote", { values: swapMessageValues })}</div>
                    <Markdown
                        text={$_("tokenSwap.youWillReceive", { values: swapMessageValues })}
                    />

                    {#if form.quote.valueWarning !== undefined}
                        <AlertBox>
                            <div class="warning">
                                {#if form.quote.valueWarning === "dropped"}
                                    <Translatable
                                        resourceKey={i18nKey(
                                            "tokenSwap.warningValueDropped",
                                            swapMessageValues,
                                        )}
                                    />
                                {:else}
                                    <Translatable
                                        resourceKey={i18nKey(
                                            "tokenSwap.warningValueUnknown",
                                            swapMessageValues,
                                        )}
                                    />
                                {/if}
                            </div>
                            <Checkbox
                                id="confirm-understanding"
                                small
                                label={i18nKey("tokenSwap.confirmUnderstanding")}
                                bind:checked={form.warningConfirmed}
                            />
                        </AlertBox>
                    {/if}

                    <div>{$_("tokenSwap.proceedWithSwap", { values: swapMessageValues })}</div>
                {/if}

                {#if errorMessage !== undefined}
                    <ErrorMessage>
                        <Translatable resourceKey={errorMessage} />
                    </ErrorMessage>
                {/if}
            {/if}
        </form>
    {/snippet}
    {#snippet footer()}
        <span>
            <ButtonGroup>
                {#if form.stage !== "swapping"}
                    <Button secondary tiny={$mobileWidth} onClick={onClose}
                        ><Translatable resourceKey={i18nKey("close")} /></Button
                    >
                {/if}
                {#if canRetry}
                    <Button
                        disabled={form.busy || !canClick}
                        loading={form.busy}
                        tiny={$mobileWidth}
                        onClick={onPrimaryClick}
                        ><Translatable resourceKey={primaryButtonText} /></Button
                    >
                {/if}
            </ButtonGroup>
        </span>
    {/snippet}
</ModalContent>

<style lang="scss">
    :global(.swap input.amount-val) {
        border-radius: 0 !important;
        border: var(--bw) solid var(--bd) !important;
        border-left: none !important;
        border-right: none !important;
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

    .swap {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .inner {
            @include font(book, normal, fs-100);
            padding: 0 $sp4;
            border: var(--bw) solid var(--bd);
            background-color: var(--modal-bg);
            display: flex;
            height: 47px;
            align-items: center;
        }

        .select-from .inner {
            border-radius: var(--rd) 0 0 var(--rd);
        }

        .select-to .inner {
            border-radius: 0 var(--rd) var(--rd) 0;
        }

        .amount {
            flex-grow: 1;
        }
    }

    .warning {
        margin-bottom: $sp4;
    }
</style>

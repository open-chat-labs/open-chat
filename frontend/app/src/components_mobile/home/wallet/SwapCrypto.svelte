<script lang="ts">
    import {
        Avatar,
        Body,
        BodySmall,
        Caption,
        ColourVars,
        CommonButton,
        Container,
    } from "component-lib";
    import type {
        DexId,
        EnhancedTokenDetails,
        InterpolationValues,
        OpenChat,
        ResourceKey,
    } from "openchat-client";
    import {
        exchangeRatesLookupStore as exchangeRatesLookup,
        swappableTokensStore,
    } from "openchat-client";
    import { random128 } from "openchat-shared";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import ShareOutline from "svelte-material-icons/ShareOutline.svelte";
    import SwapVertical from "svelte-material-icons/SwapVertical.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../../stores/pinNumber";
    import { calculateDollarAmount } from "../../../utils/exchange";
    import AlertBox from "../../AlertBox.svelte";
    import Checkbox from "../../Checkbox.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Translatable from "../../Translatable.svelte";
    import Markdown from "../Markdown.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import TokenInput from "../TokenInput.svelte";
    import SwapProgress, { type SwapOutcome } from "./SwapProgress.svelte";
    import TokenCard from "./TokenCard.svelte";
    import TokenSelector from "./TokenSelector.svelte";
    import { TokenState } from "./walletState.svelte";

    interface Props {
        inToken: TokenState;
        onClose: () => void;
    }

    let { inToken = $bindable() }: Props = $props();

    const client = getContext<OpenChat>("client");

    type TokenSelectorParams = {
        title: ResourceKey;
        onSelect: (token: EnhancedTokenDetails) => void;
        extraFilter?: (token: EnhancedTokenDetails) => boolean;
    };
    type SwapState = "quote" | "swap" | "finished";
    type Result = "success" | "rateChanged" | "insufficientFunds" | "error" | undefined;

    let outToken = $state<TokenState>();
    let ledgerIn = $derived(inToken.ledger);
    let tokenSelector = $state<TokenSelectorParams>();
    let error: string | undefined = $state(undefined);
    let busy = $state(false);
    let valid = $state(false);
    let swapState = $state<SwapState>("quote");
    let result: Result = $state(undefined);
    let validAmount = $state(false);
    let ledgerOut = $derived(outToken?.ledger);
    let swaps = $state({} as Record<string, DexId[]>);
    let swapMessageValues: InterpolationValues | undefined = $state(undefined);
    let bestQuote: [DexId, bigint] | undefined = $state(undefined);
    let swapId: bigint | undefined = $state();
    let userAcceptedWarning = $state(false);
    let warnValueUnknown = $state(false);
    let warnValueDropped = $state(false);
    let initialized = $state(false);
    let detailsIn = $derived(inToken.token);
    let detailsOut = $derived(outToken?.token);
    let anySwapsAvailable = $derived(Object.keys(swaps).length > 0 && detailsOut !== undefined);
    let swapping = $derived(swapState === "swap" && busy);
    let amountInText = $derived(client.formatTokens(inToken.draftAmount, detailsIn.decimals));

    onMount(() => loadSwaps(inToken.ledger));

    function getPrimaryButtonText(state: SwapState, result: Result): ResourceKey {
        let label;

        if (state === "finished") {
            label = result === "insufficientFunds" ? "back" : "requote";
        } else {
            label = state;
        }

        return i18nKey(`tokenSwap.${label}`);
    }

    function quote() {
        if (!valid) return;

        busy = true;
        error = undefined;
        result = undefined;
        swapId = undefined;

        client
            .getTokenSwapQuotes(
                ledgerIn,
                ledgerOut!,
                inToken.draftAmount - BigInt(2) * detailsIn.transferFee,
            )
            .then((response) => {
                if (response.length === 0) {
                    error = $_("tokenSwap.noQuotes", { values: { tokenIn: detailsIn.symbol } });
                } else {
                    bestQuote = response[0];

                    const [dexId, quote] = bestQuote!;

                    const amountOutText = client.formatTokens(quote, detailsOut!.decimals);
                    const rate = (Number(amountOutText) / Number(amountInText)).toPrecision(3);
                    const dex = dexName(dexId);
                    const minAmountOut = BigInt(10) * detailsOut!.transferFee;
                    const minAmountOutText = client.formatTokens(
                        minAmountOut,
                        detailsOut!.decimals,
                    );

                    const usdInText = calculateDollarAmount(
                        inToken.draftAmount,
                        $exchangeRatesLookup.get(detailsIn.symbol.toLowerCase())?.toUSD,
                        detailsIn.decimals,
                    );
                    const usdOutText = calculateDollarAmount(
                        bestQuote[1],
                        $exchangeRatesLookup.get(detailsOut!.symbol.toLowerCase())?.toUSD,
                        detailsOut!.decimals,
                    );

                    warnValueUnknown = usdInText === "???" || usdOutText === "???";
                    warnValueDropped =
                        !warnValueUnknown && Number(usdOutText) < 0.9 * Number(usdInText);

                    swapMessageValues = {
                        amountIn: amountInText,
                        tokenIn: detailsIn.symbol,
                        rate,
                        amountOut: amountOutText,
                        tokenOut: detailsOut!.symbol,
                        dex,
                        minAmountOut: minAmountOutText,
                        usdOut: usdOutText,
                        usdIn: usdInText,
                    };

                    if (quote > minAmountOut) {
                        swapState = "swap";
                    } else {
                        error = $_("tokenSwap.quoteTooLow", { values: swapMessageValues });
                    }
                }
            })
            .catch((err) => {
                client.logError(`Error getting swap quotes for token: ${detailsIn.symbol}`, err);
                error = $_("tokenSwap.quoteError", { values: { tokenIn: detailsIn.symbol } });
            })
            .finally(() => (busy = false));
    }

    function swap() {
        if (!valid || bestQuote === undefined) return;

        busy = true;
        error = undefined;
        result = undefined;

        const ledgerInLocal = ledgerIn;
        const ledgerOutLocal = ledgerOut!;
        const bestQuoteLocal = bestQuote;

        let minAmountOut = (bestQuoteLocal[1] * BigInt(98)) / BigInt(100);

        client
            .refreshAccountBalance(ledgerIn)
            .then((balance) => {
                if (balance < inToken.draftAmount) {
                    error = $_("tokenSwap.progress.insufficientFunds");
                    result = "insufficientFunds";
                    return false;
                } else {
                    return true;
                }
            })
            .then((balanceCheckSuccess) => {
                if (balanceCheckSuccess) {
                    swapId = random128();
                    return client.swapTokens(
                        swapId,
                        ledgerInLocal,
                        ledgerOutLocal,
                        inToken.draftAmount,
                        minAmountOut,
                        bestQuoteLocal[0],
                    );
                }
            })
            .catch(() => {
                swapId = undefined;
                busy = false;
            });
    }

    function dexName(dex: DexId): string {
        switch (dex) {
            case "icpswap":
                return "ICPSwap";

            case "sonic":
                return "Sonic";

            case "kongswap":
                return "KongSwap";
        }
    }

    function loadSwaps(ledger: string) {
        client.getTokenSwaps(ledger).then((results) => {
            outToken = undefined;
            swaps = results;
            client.refreshSwappableTokens();
            initialized = true;
        });
    }

    function onSwapFinished(outcome: SwapOutcome, ledgerIn: string, ledgerOut: string) {
        busy = false;
        swapState = "finished";
        result = outcome;

        client.refreshAccountBalance(ledgerIn);
        client.refreshAccountBalance(ledgerOut);
    }

    function onPrimaryClick() {
        if (swapState === "finished" && result === "insufficientFunds") {
            inToken.draftAmount = 0n;
            swapState = "quote";
        } else if (swapState === "quote" || result === "rateChanged") {
            quote();
        } else if (swapState === "swap") {
            swap();
        }
    }

    $effect(() => {
        valid =
            anySwapsAvailable &&
            validAmount &&
            (swapState === "swap"
                ? (bestQuote !== undefined && userAcceptedWarning) ||
                  (!warnValueUnknown && !warnValueDropped)
                : true);
    });
    let primaryButtonText = $derived(getPrimaryButtonText(swapState, result));
    let pinNumberError = $derived($pinNumberErrorMessageStore);

    function setAmount(percentage: number) {
        inToken.draftAmount =
            BigInt(Math.floor(Number(inToken.cryptoBalance) * (percentage / 100))) -
            inToken.transferFees;
    }

    function selectFrom() {
        tokenSelector = {
            title: i18nKey("Select token to swap from"),
            onSelect: (token: EnhancedTokenDetails) => {
                inToken = new TokenState(token, "usd");
                tokenSelector = undefined;
                loadSwaps(inToken.ledger);
            },
            extraFilter: (token: EnhancedTokenDetails) =>
                $swappableTokensStore.has(token.ledger) &&
                token.symbol !== outToken?.symbol &&
                token.balance > 0n,
        };
    }

    function selectTo() {
        tokenSelector = {
            title: i18nKey("Select token to swap to"),
            onSelect: (token: EnhancedTokenDetails) => {
                outToken = new TokenState(token, "usd");
                tokenSelector = undefined;
            },
            extraFilter: (token: EnhancedTokenDetails) =>
                $swappableTokensStore.has(token.ledger) && token.symbol !== inToken?.symbol,
        };
    }
</script>

{#snippet swapIcon(color: string, size: string)}
    <SwapVertical {color} {size} />
{/snippet}

{#if tokenSelector !== undefined}
    <TokenSelector
        icon={swapIcon}
        onSelect={tokenSelector.onSelect}
        placeholder={i18nKey("Find token...")}
        extraFilter={tokenSelector.extraFilter}
        onDismiss={() => (tokenSelector = undefined)}
        title={tokenSelector.title} />
{/if}

{#snippet selectedToken(onClick: () => void, token?: EnhancedTokenDetails)}
    <Container
        {onClick}
        background={ColourVars.textTertiary}
        height={{ kind: "fixed", size: "3rem" }}
        padding={["xs", "md"]}
        borderRadius={"circle"}
        gap={"sm"}
        mainAxisAlignment={"spaceBetween"}
        crossAxisAlignment={"center"}>
        {#if token !== undefined}
            <Container crossAxisAlignment={"center"} gap={"sm"}>
                <Avatar url={token.logo} customSize={"1.5rem"}></Avatar>
                <Body fontWeight={"bold"}>
                    {token.symbol}
                </Body>
            </Container>
        {:else}
            <Body colour={"textPlaceholder"}>
                <Translatable resourceKey={i18nKey("Choose token...")} />
            </Body>
        {/if}
        <div class="icon">
            <ChevronDown color={"var(--text-placeholder)"} size="1.5rem" />
        </div>
    </Container>
{/snippet}

<SlidingPageContent title={i18nKey("Swap tokens")}>
    <Container height={{ kind: "fill" }} gap={"lg"} padding={"xl"} direction={"vertical"}>
        <Container gap={"md"} direction={"vertical"} padding={"md"}>
            <Body fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey(`Swap ${inToken.symbol}`)} />
            </Body>

            <BodySmall colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "Provide values first to obtain our best quote from DEX partners. If you accept the quote your tokens are securely sent, exchanged for the selected token, and the swapped tokens are automatically returned to your wallet.",
                    )} />
            </BodySmall>
        </Container>

        <TokenCard tokenState={inToken} />

        {#if initialized}
            {#if swapState === "quote"}
                <Container
                    background={ColourVars.background1}
                    gap={"xl"}
                    direction={"vertical"}
                    borderRadius={"lg"}
                    padding={["xl", "lg"]}>
                    <Container direction={"vertical"} gap={"md"} crossAxisAlignment={"center"}>
                        {@render selectedToken(selectFrom, inToken.token)}
                        <Container
                            supplementalClass={"swap_down_arrow"}
                            width={{ kind: "fixed", size: "3rem" }}
                            height={{ kind: "fixed", size: "3rem" }}
                            borderRadius={"circle"}
                            background={ColourVars.background1}
                            mainAxisAlignment={"center"}
                            crossAxisAlignment={"center"}>
                            <ArrowDown size={"1.5rem"} />
                        </Container>
                        {@render selectedToken(selectTo, outToken?.token)}
                    </Container>

                    <TokenInput
                        ledger={inToken.ledger}
                        minAmount={inToken.minAmount}
                        disabled={busy}
                        error={!validAmount}
                        bind:valid={validAmount}
                        bind:amount={inToken.draftAmount}>
                        {#snippet subtext()}
                            {`Minimum amount ${inToken.minAmountLabel} ${inToken.symbol}`}
                        {/snippet}
                        {#snippet icon()}
                            <Container padding={["zero", "xs"]} width={{ kind: "hug" }}>
                                <Avatar url={inToken.logo} size={"sm"} />
                            </Container>
                        {/snippet}
                    </TokenInput>

                    <Container direction={"vertical"} gap={"xs"}>
                        <Container
                            mainAxisAlignment={"spaceBetween"}
                            padding={["sm", "zero"]}
                            gap={"sm"}>
                            {@render percentage(25)}
                            {@render percentage(50)}
                            {@render percentage(75)}
                            {@render percentage(100)}
                        </Container>
                        <Caption colour={"disabledButton"}>
                            <Translatable
                                resourceKey={i18nKey(
                                    "Use the options above to select a specific percentage of your total token amount you would like to swap.",
                                )} />
                        </Caption>
                    </Container>
                </Container>
            {/if}

            {#if (swapping || swapState === "finished") && swapId !== undefined && detailsOut !== undefined && bestQuote !== undefined}
                <div>
                    <SwapProgress
                        {swapId}
                        tokenIn={detailsIn.symbol}
                        tokenOut={detailsOut.symbol}
                        ledgerIn={detailsIn.ledger}
                        ledgerOut={detailsOut.ledger}
                        amountIn={amountInText}
                        decimalsOut={detailsOut.decimals}
                        dex={dexName(bestQuote[0])}
                        onFinished={onSwapFinished} />
                </div>
            {/if}

            {#if swapState === "swap" && !swapping && outToken !== undefined}
                <TokenCard tokenState={outToken} />

                <div>{$_("tokenSwap.bestQuote", { values: swapMessageValues })}</div>
                <Markdown text={$_("tokenSwap.youWillReceive", { values: swapMessageValues })} />

                {#if warnValueDropped || warnValueUnknown}
                    <AlertBox>
                        <div class="warning">
                            {#if warnValueDropped}
                                <Translatable
                                    resourceKey={i18nKey(
                                        "tokenSwap.warningValueDropped",
                                        swapMessageValues,
                                    )} />
                            {:else}
                                <Translatable
                                    resourceKey={i18nKey(
                                        "tokenSwap.warningValueUnknown",
                                        swapMessageValues,
                                    )} />
                            {/if}
                        </div>
                        <Checkbox
                            id="confirm-understanding"
                            small
                            label={i18nKey("tokenSwap.confirmUnderstanding")}
                            bind:checked={userAcceptedWarning} />
                    </AlertBox>
                {/if}

                <div>{$_("tokenSwap.proceedWithSwap", { values: swapMessageValues })}</div>
            {/if}
        {/if}
        {#if error !== undefined || pinNumberError !== undefined}
            <ErrorMessage>
                {#if pinNumberError !== undefined}
                    <Translatable resourceKey={pinNumberError} />
                {:else}
                    {error}
                {/if}
            </ErrorMessage>
        {/if}
        <Container mainAxisAlignment={"end"}>
            {#if result !== "success" && result !== "error"}
                <CommonButton
                    loading={busy}
                    onClick={onPrimaryClick}
                    disabled={busy || !valid}
                    mode={"active"}
                    size={"medium"}>
                    {#snippet icon(color, size)}
                        <ShareOutline {color} {size} />
                    {/snippet}
                    <Translatable resourceKey={primaryButtonText} />
                </CommonButton>
            {/if}
        </Container>
    </Container>
</SlidingPageContent>

{#snippet percentage(perc: number)}
    <CommonButton
        width={{ kind: "fill" }}
        onClick={() => setAmount(perc)}
        mode={"active"}
        size={"small"}>
        {`${perc}%`}
    </CommonButton>
{/snippet}

<!-- <ModalContent>
    {#snippet body()}
        <form class="body">
            {#if initialized}
                {#if swapState === "quote"}
                    <div class="swap">
                        <div class="select-from">
                            <Legend label={i18nKey("cryptoAccount.transactionHeaders.from")} />
                            <div class="inner">
                                <CryptoSelector
                                    filter={(t) =>
                                        t.balance > 0 && $swappableTokensStore.has(t.ledger)}
                                    bind:ledger={ledgerIn}
                                    onSelect={onLedgerInSelected} />
                            </div>
                        </div>
                        <div class="amount">
                            <TokenInput
                                ledger={ledgerIn}
                                minAmount={detailsIn.transferFee * BigInt(10)}
                                maxAmount={detailsIn.balance}
                                bind:valid={validAmount}
                                bind:amount={fromToken.draftAmount} />
                        </div>
                        <div class="select-to">
                            <Legend label={i18nKey("cryptoAccount.transactionHeaders.to")} />
                            <div class="inner">
                                <CryptoSelector
                                    filter={(t) => Object.keys(swaps).includes(t.ledger)}
                                    bind:ledger={ledgerOut} />
                            </div>
                        </div>
                    </div>
                {/if}

                {#if (swapping || swapState === "finished") && swapId !== undefined && detailsOut !== undefined && bestQuote !== undefined}
                    <div>
                        <SwapProgress
                            {swapId}
                            tokenIn={detailsIn.symbol}
                            tokenOut={detailsOut.symbol}
                            ledgerIn={detailsIn.ledger}
                            ledgerOut={detailsOut.ledger}
                            amountIn={amountInText}
                            decimalsOut={detailsOut.decimals}
                            dex={dexName(bestQuote[0])}
                            onFinished={onSwapFinished} />
                    </div>
                {/if}

                {#if swapState === "swap" && !swapping}
                    <div>{$_("tokenSwap.bestQuote", { values: swapMessageValues })}</div>
                    <Markdown
                        text={$_("tokenSwap.youWillReceive", { values: swapMessageValues })} />

                    {#if warnValueDropped || warnValueUnknown}
                        <AlertBox>
                            <div class="warning">
                                {#if warnValueDropped}
                                    <Translatable
                                        resourceKey={i18nKey(
                                            "tokenSwap.warningValueDropped",
                                            swapMessageValues,
                                        )} />
                                {:else}
                                    <Translatable
                                        resourceKey={i18nKey(
                                            "tokenSwap.warningValueUnknown",
                                            swapMessageValues,
                                        )} />
                                {/if}
                            </div>
                            <Checkbox
                                id="confirm-understanding"
                                small
                                label={i18nKey("tokenSwap.confirmUnderstanding")}
                                bind:checked={userAcceptedWarning} />
                        </AlertBox>
                    {/if}

                    <div>{$_("tokenSwap.proceedWithSwap", { values: swapMessageValues })}</div>
                {/if}

                {#if error !== undefined || pinNumberError !== undefined}
                    <ErrorMessage>
                        {#if pinNumberError !== undefined}
                            <Translatable resourceKey={pinNumberError} />
                        {:else}
                            {error}
                        {/if}
                    </ErrorMessage>
                {/if}
            {/if}
        </form>
    {/snippet}
    {#snippet footer()}
        <span>
            <ButtonGroup>
                {#if !swapping}
                    <Button secondary tiny={$mobileWidth} onClick={onClose}
                        ><Translatable resourceKey={i18nKey("close")} /></Button>
                {/if}
                {#if result !== "success" && result !== "error"}
                    <Button
                        disabled={busy || !valid}
                        loading={busy}
                        tiny={$mobileWidth}
                        onClick={onPrimaryClick}
                        ><Translatable resourceKey={primaryButtonText} /></Button>
                {/if}
            </ButtonGroup>
        </span>
    {/snippet}
</ModalContent>
 -->
<style lang="scss">
    :global(.container.swap_down_arrow) {
        position: absolute;
        width: 3rem;
        height: 3rem;
        transform: translateY(calc(50% + 0.3rem));
        z-index: 1;
    }

    .warning {
        margin-bottom: $sp4;
    }
</style>

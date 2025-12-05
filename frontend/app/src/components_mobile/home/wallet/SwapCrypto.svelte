<script lang="ts">
    import {
        Avatar,
        Body,
        BodySmall,
        Caption,
        ColourVars,
        CommonButton,
        Container,
        Switch,
    } from "component-lib";
    import {
        exchangeRatesLookupStore as exchangeRatesLookup,
        formatTokens,
        swappableTokensStore,
        type DexId,
        type EnhancedTokenDetails,
        type InterpolationValues,
        type OpenChat,
        type ResourceKey,
    } from "openchat-client";
    import { random128 } from "openchat-shared";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import Alert from "svelte-material-icons/AlertOutline.svelte";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import Info from "svelte-material-icons/InformationOutline.svelte";
    import ShareOutline from "svelte-material-icons/ShareOutline.svelte";
    import SwapVertical from "svelte-material-icons/SwapVertical.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../../stores/pinNumber";
    import { calculateDollarAmount } from "../../../utils/exchange";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import TokenInput from "../TokenInput.svelte";
    import SwapProgress from "./SwapProgress.svelte";
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
    type SwapState = "quote" | "swap";

    let outToken = $state<TokenState>();
    let ledgerIn = $derived(inToken.ledger);
    let tokenSelector = $state<TokenSelectorParams>();
    let error: string | undefined = $state(undefined);
    let busy = $state(false);
    let valid = $state(false);
    let swapState = $state<SwapState>("quote");
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
    let amountInText = $derived(formatTokens(inToken.draftAmount, detailsIn.decimals));

    onMount(() => loadSwaps(inToken.ledger));

    function quote() {
        if (!valid) return;

        busy = true;
        error = undefined;
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

                    const amountOutText = formatTokens(quote, detailsOut!.decimals);
                    const rate = (Number(amountOutText) / Number(amountInText)).toPrecision(3);
                    const dex = dexName(dexId);
                    const minAmountOut = BigInt(10) * detailsOut!.transferFee;
                    const minAmountOutText = formatTokens(minAmountOut, detailsOut!.decimals);

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

        const ledgerInLocal = ledgerIn;
        const ledgerOutLocal = ledgerOut!;
        const bestQuoteLocal = bestQuote;

        let minAmountOut = (bestQuoteLocal[1] * BigInt(98)) / BigInt(100);

        client
            .refreshAccountBalance(ledgerIn)
            .then((balance) => {
                if (balance < inToken.draftAmount) {
                    error = $_("tokenSwap.progress.insufficientFunds");
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

    function onPrimaryClick() {
        switch (swapState) {
            case "quote":
                quote();
                break;
            case "swap":
                swap();
                break;
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
        height={{ size: "3rem" }}
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
    <Container height={"fill"} gap={"lg"} padding={"xl"} direction={"vertical"}>
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
                            width={{ size: "3rem" }}
                            height={{ size: "3rem" }}
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
                            <Container padding={["zero", "xs"]} width={"hug"}>
                                <Avatar url={inToken.logo} size={"sm"} />
                            </Container>
                        {/snippet}
                    </TokenInput>

                    <Container height={{ size: "2rem" }} direction={"vertical"} gap={"xs"}>
                        <Container
                            height={"fill"}
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

            {#if swapState === "swap" && outToken !== undefined && swapMessageValues !== undefined}
                <TokenCard tokenState={outToken} />

                <Container
                    gap={"lg"}
                    background={ColourVars.background1}
                    padding={"lg"}
                    borderRadius={"lg"}
                    direction={"vertical"}>
                    <Container mainAxisAlignment={"spaceBetween"}>
                        <BodySmall colour={"textSecondary"}>
                            <Translatable resourceKey={i18nKey("You swap")} />
                        </BodySmall>
                        <Container crossAxisAlignment={"end"} width={"hug"} direction={"vertical"}>
                            <Body align={"end"} width={"hug"} fontWeight={"bold"}>
                                {`${swapMessageValues.amountIn} ${swapMessageValues.tokenIn}`}
                            </Body>
                            <Caption
                                align={"end"}
                                width={"hug"}
                                fontWeight={"bold"}
                                colour={"textSecondary"}>
                                ${swapMessageValues.usdIn}
                            </Caption>
                        </Container>
                    </Container>
                    <Container mainAxisAlignment={"spaceBetween"}>
                        <BodySmall colour={"textSecondary"}>
                            <Translatable resourceKey={i18nKey("You receive (approx.)")} />
                        </BodySmall>
                        <Container crossAxisAlignment={"end"} width={"hug"} direction={"vertical"}>
                            <Body
                                align={"end"}
                                width={"hug"}
                                colour={"primary"}
                                fontWeight={"bold"}>
                                {`${swapMessageValues.amountOut} ${swapMessageValues.tokenOut}`}
                            </Body>
                            <Caption
                                align={"end"}
                                width={"hug"}
                                fontWeight={"bold"}
                                colour={"textSecondary"}>
                                ${swapMessageValues.usdOut}
                            </Caption>
                        </Container>
                    </Container>
                    <Container mainAxisAlignment={"spaceBetween"}>
                        <BodySmall colour={"textSecondary"}>
                            <Translatable resourceKey={i18nKey("Exchange rate")} />
                        </BodySmall>
                        <Body width={"hug"} fontWeight={"bold"}>
                            {`${swapMessageValues.rate} ${swapMessageValues.tokenOut} ~ 1 ${swapMessageValues.tokenIn}`}
                        </Body>
                    </Container>
                    <Container mainAxisAlignment={"spaceBetween"}>
                        <BodySmall colour={"textSecondary"}>
                            <Translatable resourceKey={i18nKey("Quote provider")} />
                        </BodySmall>
                        <Body width={"hug"} fontWeight={"bold"}>
                            {`${swapMessageValues.dex}`}
                        </Body>
                    </Container>
                </Container>

                {#if warnValueDropped || warnValueUnknown}
                    <Container
                        gap={"md"}
                        background={ColourVars.background1}
                        padding={"lg"}
                        borderRadius={"lg"}
                        direction={"vertical"}>
                        <Container crossAxisAlignment={"center"} gap={"sm"}>
                            <Alert color={ColourVars.warning} />
                            <Body fontWeight={"bold"} colour={"warning"}>
                                <Translatable resourceKey={i18nKey("Low value warning")} />
                            </Body>
                        </Container>
                        <Body colour={"textSecondary"}>
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
                        </Body>
                        <Switch reverse bind:checked={userAcceptedWarning}>
                            <Translatable resourceKey={i18nKey("tokenSwap.confirmUnderstanding")} />
                        </Switch>
                    </Container>
                {/if}

                <Container
                    gap={"md"}
                    background={ColourVars.background1}
                    padding={"lg"}
                    borderRadius={"lg"}
                    direction={"vertical"}>
                    <Container crossAxisAlignment={"center"} gap={"sm"}>
                        <Info color={ColourVars.secondary} />
                        <Body fontWeight={"bold"} colour={"secondary"}>
                            <Translatable resourceKey={i18nKey("Swap success limit")} />
                        </Body>
                    </Container>
                    <Body colour={"textSecondary"}>
                        <Translatable
                            resourceKey={i18nKey("tokenSwap.proceedWithSwap", swapMessageValues)} />
                    </Body>
                </Container>
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
        <Container
            crossAxisAlignment={"end"}
            mainAxisAlignment={swapState === "quote" ? "end" : "spaceBetween"}>
            {#if swapState === "swap" && !swapping}
                <CommonButton
                    onClick={() => (swapState = "quote")}
                    mode={"default"}
                    size={"small_text"}>
                    <Translatable resourceKey={i18nKey("cancel")} />
                </CommonButton>
            {/if}
            <CommonButton
                loading={busy}
                onClick={onPrimaryClick}
                disabled={busy || !valid}
                mode={"active"}
                size={"medium"}>
                {#snippet icon(color, size)}
                    {#if swapState === "swap"}
                        <Check {color} {size} />
                    {:else}
                        <ShareOutline {color} {size} />
                    {/if}
                {/snippet}
                {#if swapState === "swap"}
                    <Translatable resourceKey={i18nKey("Accept quote & proceed")} />
                {:else}
                    <Translatable resourceKey={i18nKey("Get swap quote")} />
                {/if}
            </CommonButton>
        </Container>
    </Container>
</SlidingPageContent>

{#if swapping && swapId !== undefined && detailsOut !== undefined && bestQuote !== undefined}
    <SwapProgress
        {swapId}
        tokenIn={detailsIn.symbol}
        tokenOut={detailsOut.symbol}
        ledgerIn={detailsIn.ledger}
        ledgerOut={detailsOut.ledger}
        amountIn={amountInText}
        decimalsOut={detailsOut.decimals}
        dex={dexName(bestQuote[0])} />
{/if}

{#snippet percentage(perc: number)}
    <CommonButton width={"fill"} onClick={() => setAmount(perc)} mode={"active"} size={"small"}>
        {`${perc}%`}
    </CommonButton>
{/snippet}

<style lang="scss">
    :global(.container.swap_down_arrow) {
        position: absolute;
        width: 3rem;
        height: 3rem;
        transform: translateY(calc(50% + 0.3rem));
        z-index: 1;
    }
</style>

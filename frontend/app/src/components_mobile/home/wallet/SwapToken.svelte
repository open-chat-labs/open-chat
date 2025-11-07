<script lang="ts">
    import { pinNumberErrorMessageStore } from "@src/stores/pinNumber";
    import { calculateDollarAmount } from "@src/utils/exchange";
    import {
        Avatar,
        Body,
        BodySmall,
        Caption,
        ColourVars,
        CommonButton,
        Container,
    } from "component-lib";
    import {
        exchangeRatesLookupStore as exchangeRatesLookup,
        OpenChat,
        swappableTokensStore,
        type DexId,
        type EnhancedTokenDetails,
        type InterpolationValues,
        type ResourceKey,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import ShareOutline from "svelte-material-icons/ShareOutline.svelte";
    import SwapVertical from "svelte-material-icons/SwapVertical.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import TokenInput from "../TokenInput.svelte";
    import TokenCard from "./TokenCard.svelte";
    import TokenSelector from "./TokenSelector.svelte";
    import { TokenState } from "./walletState.svelte";

    const client = getContext<OpenChat>("client");

    type SwapState = "quote" | "swap" | "finished";

    type Result = "success" | "rateChanged" | "insufficientFunds" | "error" | undefined;

    type TokenSelectorParams = {
        title: ResourceKey;
        onSelect: (token: EnhancedTokenDetails) => void;
        extraFilter?: (token: EnhancedTokenDetails) => boolean;
    };

    interface Props {
        fromToken: TokenState;
        onClose: () => void;
    }

    let { fromToken = $bindable() }: Props = $props();

    let swapState = $state<SwapState>("quote");
    let result = $state<Result>();
    let swapId = $state<bigint>();
    let bestQuote = $state<[DexId, bigint]>();
    let validAmount = $state(false);
    let toToken = $state<TokenState>();
    let tokenSelector = $state<TokenSelectorParams>();
    let busy = $state(false);
    let valid = $derived(validAmount && fromToken !== undefined && toToken !== undefined);
    let pinNumberError = $derived($pinNumberErrorMessageStore);
    let error = $state<string>();
    let warnValueUnknown = $state(false);
    let warnValueDropped = $state(false);
    let swapMessageValues: InterpolationValues | undefined = $state(undefined);
    let swaps = $state({} as Record<string, DexId[]>);

    function selectFrom() {
        tokenSelector = {
            title: i18nKey("Select token to swap from"),
            onSelect: (token: EnhancedTokenDetails) => {
                fromToken = new TokenState(token, "usd");
                tokenSelector = undefined;
            },
            extraFilter: (token: EnhancedTokenDetails) =>
                !$swappableTokensStore.has(token.ledger) &&
                token.symbol !== toToken?.symbol &&
                token.balance > 0n,
        };
    }

    function selectTo() {
        tokenSelector = {
            title: i18nKey("Select token to swap to"),
            onSelect: (token: EnhancedTokenDetails) => {
                toToken = new TokenState(token, "usd");
                tokenSelector = undefined;
            },
            extraFilter: (token: EnhancedTokenDetails) =>
                !$swappableTokensStore.has(token.ledger) && token.symbol !== fromToken?.symbol,
        };
    }

    function setAmount(percentage: number) {
        fromToken.draftAmount =
            BigInt(Math.floor(Number(fromToken.cryptoBalance) * (percentage / 100))) -
            fromToken.transferFees;
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

    function quote() {
        if (!valid) return;
        if (toToken === undefined) return;

        busy = true;
        error = undefined;
        result = undefined;
        swapId = undefined;

        client
            .getTokenSwapQuotes(
                fromToken.ledger,
                toToken.ledger!,
                fromToken.draftAmount - BigInt(2) * fromToken.transferFees,
            )
            .then((response) => {
                if (response.length === 0) {
                    error = $_("tokenSwap.noQuotes", { values: { tokenIn: fromToken.symbol } });
                } else {
                    bestQuote = response[0];

                    const [dexId, quote] = bestQuote!;

                    const amountOutText = client.formatTokens(quote, toToken!.decimals);
                    const amountInText = client.formatTokens(
                        fromToken.draftAmount,
                        fromToken.decimals,
                    );
                    const rate = (Number(amountOutText) / Number(amountInText)).toPrecision(3);
                    const dex = dexName(dexId);
                    const minAmountOut = toToken!.minAmount;
                    const minAmountOutText = client.formatTokens(minAmountOut, toToken!.decimals);

                    const usdInText = calculateDollarAmount(
                        fromToken.draftAmount,
                        $exchangeRatesLookup.get(fromToken.symbol.toLowerCase())?.toUSD,
                        fromToken.decimals,
                    );
                    const usdOutText = calculateDollarAmount(
                        bestQuote[1],
                        $exchangeRatesLookup.get(toToken!.symbol.toLowerCase())?.toUSD,
                        toToken!.decimals,
                    );

                    warnValueUnknown = usdInText === "???" || usdOutText === "???";
                    warnValueDropped =
                        !warnValueUnknown && Number(usdOutText) < 0.9 * Number(usdInText);

                    swapMessageValues = {
                        amountIn: amountInText,
                        tokenIn: fromToken.symbol,
                        rate,
                        amountOut: amountOutText,
                        tokenOut: toToken!.symbol,
                        dex,
                        minAmountOut: minAmountOutText,
                        usdOut: usdOutText,
                        usdIn: usdInText,
                    };

                    console.log("SwapMessageValues: ", swapMessageValues);

                    if (quote > minAmountOut) {
                        swapState = "swap";
                    } else {
                        error = $_("tokenSwap.quoteTooLow", { values: swapMessageValues });
                    }
                }
            })
            .catch((err) => {
                client.logError(`Error getting swap quotes for token: ${fromToken.symbol}`, err);
                error = $_("tokenSwap.quoteError", { values: { tokenIn: fromToken.symbol } });
            })
            .finally(() => (busy = false));
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
                <Translatable resourceKey={i18nKey(`Swap ${fromToken.symbol}`)} />
            </Body>

            <BodySmall colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "Provide values first to obtain our best quote from DEX partners. If you accept the quote your tokens are securely sent, exchanged for the selected token, and the swapped tokens are automatically returned to your wallet.",
                    )} />
            </BodySmall>
        </Container>

        <TokenCard tokenState={fromToken} />

        <Container
            background={ColourVars.background1}
            gap={"xl"}
            direction={"vertical"}
            borderRadius={"lg"}
            padding={["xl", "lg"]}>
            <Container direction={"vertical"} gap={"md"} crossAxisAlignment={"center"}>
                {@render selectedToken(selectFrom, fromToken.token)}
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
                {@render selectedToken(selectTo, toToken?.token)}
            </Container>

            <TokenInput
                ledger={fromToken.ledger}
                minAmount={fromToken.minAmount}
                disabled={busy}
                error={!validAmount}
                bind:valid={validAmount}
                bind:amount={fromToken.draftAmount}>
                {#snippet subtext()}
                    {`Minimum amount ${fromToken.minAmountLabel} ${fromToken.symbol}`}
                {/snippet}
                {#snippet icon()}
                    <Container padding={["zero", "xs"]} width={{ kind: "hug" }}>
                        <Avatar url={fromToken.logo} size={"sm"} />
                    </Container>
                {/snippet}
            </TokenInput>

            <Container direction={"vertical"} gap={"xs"}>
                <Container mainAxisAlignment={"spaceBetween"} padding={["sm", "zero"]} gap={"sm"}>
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
            <CommonButton
                loading={busy}
                onClick={quote}
                disabled={!valid}
                mode={"active"}
                size={"medium"}>
                {#snippet icon(color, size)}
                    <ShareOutline {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Get swap quote")} />
            </CommonButton>
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

<style lang="scss">
    :global(.container.swap_down_arrow) {
        position: absolute;
        width: 3rem;
        height: 3rem;
        transform: translateY(1.9rem);
        z-index: 1;
    }

    .icon {
        position: absolute;
        right: 0.7rem;
        top: 50%;
        transform: translateY(-50%);
        pointer-events: none;
        display: flex;
    }
</style>

<script lang="ts">
    import {
        Avatar,
        Body,
        BodySmall,
        ColourVars,
        Column,
        CommonButton2,
        Container,
        Switch,
    } from "component-lib";
    import {
        swappableTokensStore,
        type EnhancedTokenDetails,
        type OpenChat,
        type ResourceKey,
    } from "@client";
    import { getContext, untrack } from "svelte";
    import Alert from "svelte-material-icons/AlertOutline.svelte";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import Info from "svelte-material-icons/InformationOutline.svelte";
    import ShareOutline from "svelte-material-icons/ShareOutline.svelte";
    import SwapVertical from "svelte-material-icons/SwapVertical.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../../stores/pinNumber";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import TokenInput from "../TokenInput.svelte";
    import SwapProgress from "./SwapProgress.svelte";
    import SwapQuotes from "./SwapQuotes.svelte";
    import TokenCard from "./TokenCard.svelte";
    import TokenSelector from "./TokenSelector.svelte";
    import type { TokenState } from "@shared_components/home/wallet/walletState.svelte";
    import { SwapForm } from "@shared_components/home/wallet/swapForm.svelte";

    interface Props {
        inToken: TokenState;
        onClose: () => void;
    }

    let { inToken }: Props = $props();

    const client = getContext<OpenChat>("client");

    type TokenSelectorParams = {
        title: ResourceKey;
        onSelect: (token: EnhancedTokenDetails) => void;
        extraFilter?: (token: EnhancedTokenDetails) => boolean;
    };

    // The page is opened for one token; the user can pick another
    const form = new SwapForm(
        client,
        untrack(() => inToken),
    );
    let tokenSelector = $state<TokenSelectorParams>();
    let errorMessage = $derived($pinNumberErrorMessageStore ?? form.error);

    function onPrimaryClick() {
        if (form.stage === "confirm") {
            form.swap();
        } else {
            form.getQuote();
        }
    }

    function selectFrom() {
        tokenSelector = {
            title: i18nKey("Select token to swap from"),
            onSelect: (token: EnhancedTokenDetails) => {
                form.selectIn(token);
                tokenSelector = undefined;
            },
            extraFilter: (token: EnhancedTokenDetails) =>
                $swappableTokensStore.has(token.ledger) &&
                token.symbol !== form.outToken?.symbol &&
                token.balance > 0n,
        };
    }

    function selectTo() {
        tokenSelector = {
            title: i18nKey("Select token to swap to"),
            onSelect: (token: EnhancedTokenDetails) => {
                form.selectOut(token);
                tokenSelector = undefined;
            },
            // Only the tokens the DEXes have a pool for with the input token
            extraFilter: (token: EnhancedTokenDetails) => token.ledger in form.swaps,
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
        title={tokenSelector.title}
    />
{/if}

{#snippet selectedToken(onClick: () => void, token?: EnhancedTokenDetails)}
    <Container
        {onClick}
        background={ColourVars.inputBackground}
        height={{ size: "3.5rem" }}
        padding={["xs", "md"]}
        borderRadius={"circle"}
        gap={"sm"}
        mainAxisAlignment={"spaceBetween"}
        crossAxisAlignment={"center"}
    >
        {#if token !== undefined}
            <Container crossAxisAlignment={"center"} gap={"sm"}>
                <Avatar url={token.logo} customSize={"1.5rem"}></Avatar>
                <Body fontWeight={"bold"}>
                    {token.symbol}
                </Body>
            </Container>
        {:else}
            <Container padding={["zero", "zero", "zero", "sm"]}>
                <Body colour="inputPlaceholder">
                    <Translatable resourceKey={i18nKey("Choose token...")} />
                </Body>
            </Container>
        {/if}
        <ChevronDown color={"var(--input-placeholder)"} size="1.5rem" />
    </Container>
{/snippet}

{#snippet quoteView()}
    <Container
        background={ColourVars.surface1}
        gap={"xl"}
        direction={"vertical"}
        borderRadius={"lg"}
        padding={["xl", "lg"]}
    >
        <Container direction={"vertical"} gap={"md"} crossAxisAlignment={"center"}>
            {@render selectedToken(selectFrom, form.inToken.token)}
            <Container
                supplementalClass={"swap_down_arrow"}
                width={{ size: "2.5rem" }}
                borderRadius={"circle"}
                background={ColourVars.surface1}
                mainAxisAlignment={"center"}
                crossAxisAlignment={"center"}
            >
                <ArrowDown size={"1.5rem"} />
            </Container>
            {@render selectedToken(selectTo, form.outToken?.token)}
        </Container>

        <TokenInput
            balance={form.inToken.cryptoBalance}
            ledger={form.inToken.ledger}
            minAmount={form.inToken.minAmount}
            disabled={form.busy}
            error={!form.validAmount}
            bind:valid={form.validAmount}
            bind:amount={form.inToken.draftAmount}
        >
            {#snippet subtext()}
                {`Minimum amount ${form.inToken.minAmountLabel} ${form.inToken.symbol}`}
            {/snippet}
        </TokenInput>
    </Container>
{/snippet}

{#snippet quotesView()}
    {#if form.quotes.length > 0 && form.outToken !== undefined}
        <SwapQuotes
            quotes={form.quotes}
            symbolOut={form.outToken.symbol}
            decimalsOut={form.outToken.decimals}
            best={form.quote?.dex}
        />
    {/if}
{/snippet}

{#snippet swapView()}
    {#if form.outToken !== undefined && form.quote !== undefined}
        {@const swapMessageValues = form.quote.values}
        <TokenCard tokenState={form.outToken} />
        <Container
            gap={"lg"}
            background={ColourVars.surface1}
            padding={"lg"}
            borderRadius={"lg"}
            direction={"vertical"}
        >
            <Container mainAxisAlignment={"spaceBetween"}>
                <BodySmall colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("You swap")} />
                </BodySmall>
                <Container crossAxisAlignment={"end"} width={"hug"} direction={"vertical"}>
                    <Body align={"end"} width={"hug"} fontWeight={"bold"}>
                        {`${swapMessageValues.amountIn} ${swapMessageValues.tokenIn}`}
                    </Body>
                    <BodySmall
                        align={"end"}
                        width={"hug"}
                        fontWeight={"bold"}
                        colour={"textSecondary"}
                    >
                        ≈ ${swapMessageValues.usdIn}
                    </BodySmall>
                </Container>
            </Container>
            <Container mainAxisAlignment={"spaceBetween"}>
                <BodySmall colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("You receive (approx.)")} />
                </BodySmall>
                <Container crossAxisAlignment={"end"} width={"hug"} direction={"vertical"}>
                    <Body align={"end"} width={"hug"} colour={"primary"} fontWeight={"bold"}>
                        {`${swapMessageValues.amountOut} ${swapMessageValues.tokenOut}`}
                    </Body>
                    <BodySmall
                        align={"end"}
                        width={"hug"}
                        fontWeight={"bold"}
                        colour={"textSecondary"}
                    >
                        ≈ ${swapMessageValues.usdOut}
                    </BodySmall>
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

        {@render quotesView()}

        {#if form.quote.valueWarning !== undefined}
            <Container
                gap={"md"}
                background={ColourVars.surface1}
                padding={"lg"}
                borderRadius={"lg"}
                direction={"vertical"}
            >
                <Container crossAxisAlignment={"center"} gap={"sm"}>
                    <Alert color={ColourVars.validationWarning} />
                    <Body fontWeight={"bold"} colour={"validationWarning"}>
                        <Translatable resourceKey={i18nKey("Low value warning")} />
                    </Body>
                </Container>
                <Body colour={"textSecondary"}>
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
                </Body>
                <Switch reverse bind:checked={form.warningConfirmed}>
                    <Translatable resourceKey={i18nKey("tokenSwap.confirmUnderstanding")} />
                </Switch>
            </Container>
        {/if}

        <Container
            gap={"md"}
            background={ColourVars.surface1}
            padding={"lg"}
            borderRadius={"lg"}
            direction={"vertical"}
        >
            <Container crossAxisAlignment={"center"} gap={"sm"}>
                <Info color={ColourVars.secondary} />
                <Body fontWeight={"bold"} colour={"secondary"}>
                    <Translatable resourceKey={i18nKey("Swap success limit")} />
                </Body>
            </Container>
            <Body colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey("tokenSwap.proceedWithSwap", swapMessageValues)}
                />
            </Body>
        </Container>
    {/if}
{/snippet}

<SlidingPageContent title={i18nKey("Swap tokens")}>
    <Container height={"fill"} gap={"xl"} padding={["xl", "lg", "huge"]} direction={"vertical"}>
        <!-- Title and description -->
        <Container gap={"md"} direction={"vertical"} padding={["zero", "sm"]}>
            <Body fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey(`Swap ${form.inToken.symbol}`)} />
            </Body>
            <Body colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "Provide values first to obtain our best quote from DEX partners. If you accept the quote your tokens are securely sent, exchanged for the selected token, and the swapped tokens are automatically returned to your wallet.",
                    )}
                />
            </Body>
        </Container>

        <!-- Content -->
        <Column gap="sm">
            <TokenCard tokenState={form.inToken} />

            {#if form.loaded}
                {#if form.stage === "quote"}
                    {@render quoteView()}
                    {@render quotesView()}
                {:else}
                    {@render swapView()}
                {/if}
            {/if}
            {#if errorMessage !== undefined}
                <ErrorMessage>
                    <Translatable resourceKey={errorMessage} />
                </ErrorMessage>
            {/if}
        </Column>

        <!-- Buttons -->
        <Container
            crossAxisAlignment="center"
            mainAxisAlignment={form.stage === "quote" ? "end" : "spaceBetween"}
        >
            {#if form.stage !== "quote"}
                <CommonButton2
                    onClick={() => form.backToQuote()}
                    variant="primary"
                    mode="text"
                    disabled={form.busy}
                >
                    <Translatable resourceKey={i18nKey("cancel")} />
                </CommonButton2>
            {/if}
            <CommonButton2
                loading={form.busy}
                disabled={form.stage === "confirm" ? !form.canSwap : !form.canQuote}
                onClick={onPrimaryClick}
                variant="primary"
                mode="small"
            >
                {#snippet icon(color, size)}
                    {#if form.stage === "confirm"}
                        <Check {color} {size} />
                    {:else}
                        <ShareOutline {color} {size} />
                    {/if}
                {/snippet}
                {#if form.stage === "confirm"}
                    <Translatable resourceKey={i18nKey("Accept quote & proceed")} />
                {:else}
                    <Translatable resourceKey={i18nKey("Get swap quote")} />
                {/if}
            </CommonButton2>
        </Container>
    </Container>
</SlidingPageContent>

{#if (form.stage === "swapping" || form.stage === "done") && form.quote !== undefined && form.outToken !== undefined}
    <SwapProgress
        values={form.quote.values}
        decimalsOut={form.outToken.decimals}
        step={form.step}
        outcome={form.outcome}
    />
{/if}

<style lang="scss">
    :global(.container.swap_down_arrow) {
        position: absolute;
        width: 2.5rem;
        height: 2.5rem;
        transform: translateY(calc(50% + 1.25rem));
        z-index: 1;
    }
</style>

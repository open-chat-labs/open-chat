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
    import {
        swappableTokensStore,
        type EnhancedTokenDetails,
        type ResourceKey,
    } from "openchat-client";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import ShareOutline from "svelte-material-icons/ShareOutline.svelte";
    import SwapVertical from "svelte-material-icons/SwapVertical.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import TokenInput from "../TokenInput.svelte";
    import TokenCard from "./TokenCard.svelte";
    import TokenSelector from "./TokenSelector.svelte";
    import { TokenState } from "./walletState.svelte";

    type TokenSelectorParams = {
        title: ResourceKey;
        onSelect: (token: EnhancedTokenDetails) => void;
        extraFilter?: (token: EnhancedTokenDetails) => boolean;
    };

    interface Props {
        tokenState: TokenState;
        onClose: () => void;
    }

    let { tokenState = $bindable() }: Props = $props();

    let validAmount = $state(false);
    let otherToken = $state<TokenState>();
    let tokenSelector = $state<TokenSelectorParams>();
    let status = $state<"idle" | "sending" | "sent" | "error">("idle");
    let busy = $derived(status === "sending");
    let valid = $derived(validAmount && tokenState !== undefined && otherToken !== undefined);

    function selectFrom() {
        tokenSelector = {
            title: i18nKey("Select token to swap from"),
            onSelect: (token: EnhancedTokenDetails) => {
                tokenState = new TokenState(token, "usd");
                tokenSelector = undefined;
            },
            extraFilter: (token: EnhancedTokenDetails) =>
                !$swappableTokensStore.has(token.ledger) &&
                token.symbol !== otherToken?.symbol &&
                token.balance > 0n,
        };
    }

    function selectTo() {
        tokenSelector = {
            title: i18nKey("Select token to swap to"),
            onSelect: (token: EnhancedTokenDetails) => {
                otherToken = new TokenState(token, "usd");
                tokenSelector = undefined;
            },
            extraFilter: (token: EnhancedTokenDetails) =>
                !$swappableTokensStore.has(token.ledger) && token.symbol !== tokenState?.symbol,
        };
    }

    function setAmount(percentage: number) {
        tokenState.draftAmount =
            BigInt(Math.floor(Number(tokenState.cryptoBalance) * (percentage / 100))) -
            tokenState.transferFees;
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
                <Translatable resourceKey={i18nKey("Choose...")} />
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
                <Translatable resourceKey={i18nKey(`Swap ${tokenState.symbol}`)} />
            </Body>

            <BodySmall colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "Provide values first to obtain our best quote from DEX partners. If you accept the quote your tokens are securely sent, exchanged for the selected token, and the swapped tokens are automatically returned to your wallet.",
                    )} />
            </BodySmall>
        </Container>

        <TokenCard {tokenState} />

        <Container
            background={ColourVars.background1}
            gap={"xl"}
            direction={"vertical"}
            borderRadius={"lg"}
            padding={["xl", "lg"]}>
            <Container direction={"vertical"} gap={"md"} crossAxisAlignment={"center"}>
                {@render selectedToken(selectFrom, tokenState.token)}
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
                {@render selectedToken(selectTo, otherToken?.token)}
            </Container>

            <TokenInput
                ledger={tokenState.ledger}
                minAmount={tokenState.minAmount}
                disabled={busy}
                error={!validAmount}
                bind:valid={validAmount}
                bind:amount={tokenState.draftAmount}>
                {#snippet subtext()}
                    {`Minimum amount ${tokenState.minAmountLabel} ${tokenState.symbol}`}
                {/snippet}
                {#snippet icon()}
                    <Container padding={["zero", "xs"]} width={{ kind: "hug" }}>
                        <Avatar url={tokenState.logo} size={"sm"} />
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
        <Container mainAxisAlignment={"end"}>
            <CommonButton disabled={!valid} mode={"active"} size={"medium"}>
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

<script lang="ts">
    import { Avatar, Body, BodySmall, ColourVars, Column, Row, Subtitle } from "component-lib";
    import { getContext, type Snippet } from "svelte";
    import type { CryptocurrencyContent, OpenChat } from "openchat-client";
    import {
        currentUserIdStore,
        enhancedCryptoLookup,
        exchangeRatesLookupStore,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import Markdown from "./Markdown.svelte";
    import { TokenState, formatConvertedValue } from "./wallet/walletState.svelte";
    import MessageRenderer from "./MessageRenderer.svelte";
    import Alert from "svelte-material-icons/AlertRhombusOutline.svelte";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        content: CryptocurrencyContent;
        title?: Snippet;
        me?: boolean;
        reply?: boolean;
        senderId: string;
        draft?: boolean;
        edited?: boolean;
        blockLevelMarkdown?: boolean;
        onRemove?: () => void;
    }

    let {
        content,
        title,
        me = false,
        reply = false,
        senderId,
        draft = false,
        edited = false,
        blockLevelMarkdown = false,
        onRemove,
    }: Props = $props();

    let participantUserId = $derived(
        $currentUserIdStore === senderId ? content.transfer.recipient : senderId,
    );

    let tokenState = $derived(new TokenState($enhancedCryptoLookup.get(content.transfer.ledger)!));
    let transactionUrl = $derived(
        content.transfer.kind === "completed"
            ? client.buildTransactionUrl(content.transfer.blockIndex, content.transfer.ledger)
            : undefined,
    );

    let usdUnitValue = $derived(
        exchangeRatesLookupStore.value.get(tokenState.symbol.toLowerCase())?.toUSD ?? 0,
    );
    let transferAmountWithFees = $derived(
        content.transfer.amountE8s + (content.transfer.feeE8s ?? 0n),
    );
    let transferValue = $derived.by(() => {
        const value = Number(transferAmountWithFees) * usdUnitValue;
        const divider = 10 ** tokenState.decimals;
        return value / divider;
    });

    function username(userId: string): string {
        return userId === currentUserIdStore.value ? $_("you") : `@UserId(${userId})`;
    }
</script>

{#snippet transactionDetails()}
    <a class="transaction_link" href={transactionUrl ?? "_blank"} target="_blank">
        <Row
            width="fill"
            padding="md"
            borderRadius="md"
            crossAxisAlignment="center"
            background={ColourVars.background0}>
            <Column>
                <Subtitle fontWeight="bold">
                    {#if me}
                        <Markdown text={`@UserId(${participantUserId})`} inline={true} />
                    {:else}
                        You
                    {/if}
                </Subtitle>
                <Body colour="textSecondary">
                    Received {tokenState.formatTokens(content.transfer.amountE8s)}
                    {tokenState.symbol}
                </Body>
            </Column>
            <ChevronRight size="1.5rem" color={ColourVars.textSecondary} />
        </Row>
    </a>
{/snippet}

{#snippet tokenDetailsView()}
    <Row
        width="fill"
        gap="lg"
        borderRadius="md"
        padding="md"
        background={ColourVars.background0}
        crossAxisAlignment="center">
        <Avatar size={"md"} url={tokenState.logo} />
        <Column width="fill">
            <Subtitle fontWeight="bold">{tokenState.symbol}</Subtitle>
            <Body colour="textSecondary" fontWeight="bold" maxLines={1}>
                {tokenState.token.name}
            </Body>
        </Column>
        <Column width="hug">
            <Subtitle fontWeight="bold" align="end">
                {tokenState.formatTokens(content.transfer.amountE8s)}
            </Subtitle>
            <Body colour="primary" fontWeight="bold" align="end">
                ≈ {formatConvertedValue("usd", transferValue)}
            </Body>
        </Column>
    </Row>
{/snippet}

{#snippet replyView(textContent?: Snippet)}
    {@const iamSender = $currentUserIdStore === senderId}
    {@const textColor = me ? "secondary" : "primary"}
    {@render title?.()}
    <Row padding={["xs", "zero", "zero"]}>
        <Body fontWeight="semi-bold" colour={textColor}>
            <Translatable resourceKey={i18nKey(iamSender ? "You sent" : "You received")} />
            {tokenState.formatTokens(content.transfer.amountE8s)}
            {tokenState.symbol}
        </Body>
    </Row>
    {@render textContent?.()}
{/snippet}

{#snippet draftView()}
    <Column supplementalClass="send_tx_draft" padding="xs">
        <Column padding="xs" gap="xs" borderRadius="lg" background={ColourVars.background2}>
            <Row
                supplementalClass="tx_header"
                gap={"xs"}
                padding={["xs", "lg", "xs", "md"]}
                crossAxisAlignment={"center"}
                borderRadius={["lg", "lg", "md", "md"]}>
                <Body width="hug" colour="textPrimary">Sending to</Body>
                <Body width="hug" colour="primary" maxLines={1}>
                    <Markdown text={username(content.transfer.recipient)} inline={true} />
                </Body>
            </Row>
            {@render tokenDetailsView()}
            <Row
                gap="md"
                borderRadius={["md", "md", "lg", "lg"]}
                crossAxisAlignment={"center"}
                padding={["sm", "lg", "sm", "sm"]}
                background={ColourVars.background0}>
                <Alert size={"1.5rem"} color={ColourVars.warning} />
                <BodySmall colour={"warning"}>
                    <Translatable
                        resourceKey={i18nKey("tokenTransfer.warning", {
                            token: tokenState.symbol,
                        })} />
                </BodySmall>
            </Row>
        </Column>
    </Column>
{/snippet}

{#snippet regularView(textContent?: Snippet)}
    <Column padding={["zero", "zero", textContent ? "zero" : me ? "xl" : "lg"]}>
        <Column
            gap={"xs"}
            padding={me ? "xs" : "zero"}
            borderRadius={me ? ["lg", "md", "md", "md"] : "zero"}
            background={me ? ColourVars.background2 : undefined}>
            <Row width="fill" mainAxisAlignment="end" padding={["xs", "xs", "xxs"]}>
                <BodySmall colour="primary" fontWeight="bold" align="end">
                    <Translatable
                        resourceKey={i18nKey(me ? "Transaction sent" : "Transaction received")} />
                </BodySmall>
            </Row>
            {@render transactionDetails()}
            {@render tokenDetailsView()}
        </Column>
    </Column>
    {@render textContent?.()}
{/snippet}

<MessageRenderer
    {replyView}
    {draftView}
    {regularView}
    caption={content.caption}
    {me}
    {reply}
    {draft}
    {edited}
    {blockLevelMarkdown}
    {onRemove} />

<style lang="scss">
    .transaction_link {
        display: block;
        width: 100%;
    }

    :global {
        .send_tx_draft {
            .tx_header profile-link {
                text-decoration: none !important;
            }
        }
    }
</style>

<script lang="ts">
    import Markdown from "@src/core/Markdown.svelte";
    import {
        Avatar,
        Body,
        Button,
        ChatCaption,
        ColourVars,
        Column,
        Row,
        Subtitle,
    } from "component-lib";
    import type {
        MessageContext,
        OpenChat,
        P2PSwapContent,
        P2PSwapContentInitial,
    } from "@client";
    import {
        enhancedCryptoLookup as cryptoLookup,
        currentUserIdStore,
        isDiamondStore,
        publish,
        swapFailureMessage,
        swapLabels,
    } from "@client";
    import { type Snippet, getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import Cached from "svelte-material-icons/Cached.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import CloseCircleOutline from "svelte-material-icons/CloseCircleOutline.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../stores/pinNumber";
    import { now500 } from "../../stores/time";
    import { toastStore } from "../../stores/toast";
    import { getProxyAdjustedBlobUrl } from "../../utils/media";
    import AreYouSure from "../AreYouSure.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import AcceptP2PSwapModal from "./AcceptP2PSwapModal.svelte";
    import MessageRenderer from "./MessageRenderer.svelte";
    import P2PSwapProgress from "./P2PSwapProgress.svelte";
    import { TokenState } from "@src/logic/wallet/walletState.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        content: P2PSwapContentInitial | P2PSwapContent;
        messageContext?: MessageContext;
        senderId?: string;
        messageId?: bigint;
        title?: Snippet;
        me?: boolean;
        reply?: boolean;
        draft?: boolean;
        edited?: boolean;
        pinned?: boolean;
        isPreview?: boolean;
        blockLevelMarkdown?: boolean;
        onRemove?: () => void;
    }

    let {
        content,
        messageContext,
        senderId,
        messageId,
        title,
        me = false,
        reply = false,
        draft = false,
        edited = false,
        pinned = false,
        isPreview = false,
        blockLevelMarkdown = false,
        onRemove,
    }: Props = $props();

    let fromState = $derived(new TokenState($cryptoLookup.get(content.token0.ledger)));
    let toState = $derived(new TokenState($cryptoLookup.get(content.token1.ledger)));
    let confirming = $state(false);
    let showDetails = $state(false);
    let finished = $derived(
        content.kind === "p2p_swap_content" ? $now500 >= Number(content.expiresAt) : undefined,
    );
    let timeRemaining = $derived(
        !finished && content.kind === "p2p_swap_content"
            ? client.formatTimeRemaining($now500, Number(content.expiresAt))
            : $_("p2pSwap.expired"),
    );
    let labels = $derived(
        content.kind === "p2p_swap_content"
            ? swapLabels(content, { me: $currentUserIdStore, mine: me })
            : undefined,
    );
    let recipientId = $derived(labels?.takenBy);
    let acceptedByYou = $derived(labels?.takenByYou ?? false);
    let fromAmount = $derived(client.formatTokens(content.token0Amount, content.token0.decimals));
    let toAmount = $derived(client.formatTokens(content.token1Amount, content.token1.decimals));
    let buttonDisabled = $derived(
        (content.kind === "p2p_swap_content" && content.status.kind !== "p2p_swap_open") ||
            reply ||
            pinned,
    );

    let buttonLabelKey = $derived(labels?.buttonLabelKey);
    let headerLabelKey = $derived(
        labels === undefined ? undefined : (labels.headerLabelKey ?? timeRemaining),
    );
    function onAcceptOrCancel(e: MouseEvent) {
        if (e.isTrusted && !buttonDisabled) {
            if (!me && !$isDiamondStore) {
                publish("upgrade");
            } else {
                confirming = true;
            }
        }
    }

    function cancel(yes: boolean): Promise<void> {
        if (messageContext && messageId) {
            confirming = false;

            if (yes && me) {
                client
                    .cancelP2PSwap(
                        messageContext.chatId,
                        messageContext.threadRootMessageIndex,
                        messageId,
                    )
                    .then((resp) => {
                        if (resp.kind !== "success") {
                            showFailureToast(false);
                        } else {
                            client.refreshAccountBalance(content.token1.ledger);
                        }
                    });
            }
        }

        return Promise.resolve();
    }

    function accept(fromAccount?: string) {
        if (!messageContext || !messageId) return;
        confirming = false;

        if (!me) {
            client
                .acceptP2PSwap(
                    messageContext.chatId,
                    messageContext.threadRootMessageIndex,
                    messageId,
                    content.token1,
                    content.token1Amount,
                    fromAccount,
                )
                .then((resp) => {
                    if (resp.kind !== "success") {
                        showFailureToast(true);
                    } else {
                        client.refreshAccountBalance(content.token1.ledger);
                    }
                });
        }
    }

    function showFailureToast(accepting: boolean) {
        if ($pinNumberErrorMessageStore !== undefined) {
            toastStore.showFailureToast(pinNumberErrorMessageStore);
            return;
        }

        toastStore.showFailureToast(swapFailureMessage(accepting));
    }

    function onSwapClick() {
        if (!confirming) {
            showDetails = true;
        }
    }
</script>

{#if confirming}
    {#if me}
        <AreYouSure
            message={i18nKey("p2pSwap.confirmCancel", {
                amount: fromAmount,
                token: content.token0.symbol,
            })}
            action={cancel} />
    {:else}
        <AcceptP2PSwapModal
            token0={content.token0}
            token1={content.token1}
            amount0={content.token0Amount}
            amount1={content.token1Amount}
            onAccept={accept}
            onClose={() => (confirming = false)} />
    {/if}
{:else if showDetails && senderId && content.kind === "p2p_swap_content"}
    <P2PSwapProgress {senderId} {content} onClose={() => (showDetails = false)} />
{/if}

{#snippet replyView(textContent?: Snippet)}
    <Row gap="sm" minWidth="12rem">
        <Column width="fill" gap="xs" padding={["xs", "zero"]}>
            {@render title?.()}
            {#if textContent}
                {@render textContent()}
            {/if}
            <Row gap="xs" crossAxisAlignment="center">
                <Cached
                    color={me ? ColourVars.secondaryAccent : ColourVars.primaryAccent}
                    size="1.25rem" />
                <ChatCaption colour={me ? "secondaryAccent" : "primaryAccent"}>
                    <Translatable
                        resourceKey={i18nKey("p2pSwap.summaryShort", {
                            fromAmount,
                            toAmount,
                            fromToken: content.token0.symbol,
                            toToken: content.token1.symbol,
                        })} />
                </ChatCaption>
            </Row>
        </Column>
    </Row>
{/snippet}

{#snippet draftView()}
    <Column padding="xs">
        <Column padding="xs" borderRadius="lg" background={ColourVars.surface2}>
            <Row
                gap={"xs"}
                padding={["xs", "lg", "xs", "md"]}
                crossAxisAlignment={"center"}
                borderRadius={["lg", "lg", "md", "md"]}>
                <Body width="hug" colour="textSecondary" fontWeight="semi-bold">
                    <Translatable resourceKey={i18nKey("p2pSwap.builderTitle")} />
                </Body>
            </Row>
            {@render swapView()}
        </Column>
    </Column>
{/snippet}

{#snippet regularView(textContent?: Snippet)}
    {@const statusKind = content.kind === "p2p_swap_content" ? content.status.kind : undefined}
    <Column padding={["zero", "zero", textContent ? "zero" : "xl"]}>
        <Column
            gap="xs"
            padding={me ? "xs" : "zero"}
            backgroundColor={ColourVars.surface2}
            borderRadius={[me ? "lg" : "md", !me ? "lg" : "md", "lg", "lg"]}>
            <Row supplementalClass="swap_header_title" padding={["sm", "sm", "zero"]}>
                <Body
                    align="end"
                    fontWeight="bold"
                    colour={statusKind === "p2p_swap_completed" && acceptedByYou
                        ? "primary"
                        : "textSecondary"}>
                    <Translatable resourceKey={i18nKey(headerLabelKey ?? "")} />
                    {#if recipientId && recipientId !== $currentUserIdStore}
                        <Markdown text={`@UserId(${recipientId})`} inline />
                    {/if}
                </Body>
            </Row>
            {@render swapView(onSwapClick)}
            <Row width="fill">
                <!-- In DMs Swaps should have a decline option -->
                <Button
                    loading={(me || acceptedByYou) &&
                        (statusKind === "p2p_swap_reserved" || statusKind === "p2p_swap_accepted")}
                    disabled={buttonDisabled}
                    onClick={onAcceptOrCancel}>
                    <Translatable
                        resourceKey={i18nKey(
                            buttonLabelKey ?? (me ? "p2pSwap.cancel" : "p2pSwap.accept"),
                        )} />
                    {#snippet icon(color: string)}
                        {@const size = "1rem"}
                        <!-- for reserved and accepted statuses we don't show an icon, since a loader is showing -->
                        {#if statusKind === "p2p_swap_open"}
                            {#if me}
                                <CloseCircleOutline {size} {color} />
                            {:else}
                                <Cached {size} {color} />
                            {/if}
                        {:else if acceptedByYou || me}
                            {#if statusKind === "p2p_swap_completed"}
                                <Check {size} {color} />
                            {:else if statusKind === "p2p_swap_cancelled" || statusKind === "p2p_swap_expired"}
                                <Close {size} {color} />
                            {/if}
                        {/if}
                    {/snippet}
                </Button>
            </Row>
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
    {isPreview}
    {onRemove} />

{#snippet tokenDetailsView(tokenState: TokenState, amount: bigint, isTopSection: boolean = false)}
    <Row
        width="fill"
        gap="lg"
        borderRadius="md"
        padding={[!isTopSection ? "lg" : "md", "md", isTopSection ? "lg" : "md", "md"]}
        background={ColourVars.surface0}
        crossAxisAlignment="center">
        <Avatar size={"md"} url={getProxyAdjustedBlobUrl(tokenState.logo) ?? tokenState.logo} />
        <Column width="fill">
            <Subtitle fontWeight="bold" colour="textPrimary">{tokenState.symbol}</Subtitle>
            <Body colour="textSecondary" fontWeight="bold" maxLines={1}>
                {tokenState.token.name}
            </Body>
        </Column>
        <Column width="hug">
            <Subtitle fontWeight="bold" align="end" colour="textPrimary">
                {tokenState.formatTokens(amount)}
            </Subtitle>
            <Body colour="primary" fontWeight="bold" align="end">
                ≈ {tokenState.formatConvertedTokens(amount)}
            </Body>
        </Column>
    </Row>
{/snippet}

{#snippet swapView(onClick?: () => void)}
    <Column gap="xs" crossAxisAlignment={"center"} {onClick}>
        {@render tokenDetailsView(fromState, content.token0Amount, true)}
        <Row
            supplementalClass={"swap_initial_down_arrow"}
            width={{ size: "2rem" }}
            height={{ size: "2rem" }}
            borderRadius={"circle"}
            borderWidth={"extraThick"}
            borderColour={ColourVars.surface2}
            background={ColourVars.surface0}
            mainAxisAlignment={"center"}
            crossAxisAlignment={"center"}>
            <ArrowDown size={"1rem"} color={ColourVars.textPrimary} />
        </Row>
        {@render tokenDetailsView(toState, content.token1Amount)}
    </Column>
{/snippet}

<style lang="scss">
    :global {
        .container.swap_initial_down_arrow {
            position: absolute;
            top: 50%;
            transform: translateY(-1rem);
            width: 2rem;
            height: 2rem;
            z-index: 1;
        }

        .swap_header_title profile-link {
            text-decoration: none !important;
        }
    }
</style>

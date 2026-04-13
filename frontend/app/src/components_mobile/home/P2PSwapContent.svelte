<script lang="ts">
    import { type Snippet, getContext } from "svelte";
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
        AcceptP2PSwapResponse,
        CancelP2PSwapResponse,
        MessageContext,
        OpenChat,
        P2PSwapContent,
        P2PSwapContentInitial,
    } from "openchat-client";
    import {
        enhancedCryptoLookup as cryptoLookup,
        currentUserIdStore,
        isDiamondStore,
        publish,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../stores/pinNumber";
    import { now500 } from "../../stores/time";
    import { toastStore } from "../../stores/toast";
    import { TokenState } from "./wallet/walletState.svelte";
    import { getProxyAdjustedBlobUrl } from "../../utils/media";
    import Markdown from "./Markdown.svelte";
    import MessageRenderer from "./MessageRenderer.svelte";
    import Translatable from "../Translatable.svelte";
    import AreYouSure from "../AreYouSure.svelte";
    import AcceptP2PSwapModal from "./AcceptP2PSwapModal.svelte";
    import P2PSwapProgress from "./P2PSwapProgress.svelte";
    import Cached from "svelte-material-icons/Cached.svelte";
    import Check from "svelte-material-icons/Check.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import CloseCircleOutline from "svelte-material-icons/CloseCircleOutline.svelte";

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

    let fromState = $derived(new TokenState($cryptoLookup.get(content.token0.ledger)!));
    let toState = $derived(new TokenState($cryptoLookup.get(content.token1.ledger)!));
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
    let recipientId = $derived(
        content.kind === "p2p_swap_content"
            ? content.status.kind === "p2p_swap_reserved"
                ? content.status.reservedBy
                : content.status.kind === "p2p_swap_accepted" ||
                    content.status.kind === "p2p_swap_completed"
                  ? content.status.acceptedBy
                  : undefined
            : undefined,
    );
    let acceptedByYou = $derived(recipientId === $currentUserIdStore);
    let fromAmount = $derived(client.formatTokens(content.token0Amount, content.token0.decimals));
    let toAmount = $derived(client.formatTokens(content.token1Amount, content.token1.decimals));
    let buttonDisabled = $derived(
        (content.kind === "p2p_swap_content" && content.status.kind !== "p2p_swap_open") ||
            reply ||
            pinned,
    );

    let buttonLabelKey = $derived.by<string | undefined>(() => {
        if (content.kind !== "p2p_swap_content") return;
        const ifAcceptedByYou = (labelKey: string) =>
            acceptedByYou || me ? labelKey : "p2pSwap.notAvailable";

        switch (content.status.kind) {
            case "p2p_swap_open":
                return me ? "p2pSwap.cancel" : "p2pSwap.accept";

            case "p2p_swap_cancelled":
                return "p2pSwap.cancelled";

            case "p2p_swap_expired":
                return "p2pSwap.expired";

            case "p2p_swap_reserved":
            case "p2p_swap_accepted":
                return ifAcceptedByYou("p2pSwap.progress.pendingCompletion");

            case "p2p_swap_completed":
                return ifAcceptedByYou("p2pSwap.progress.success");
        }
    });

    let headerLabelKey = $derived.by<string | undefined>(() => {
        if (content.kind !== "p2p_swap_content") return;

        switch (content.status.kind) {
            case "p2p_swap_open":
                return timeRemaining;

            case "p2p_swap_cancelled":
                return "p2pSwap.cancelled";

            case "p2p_swap_expired":
                return "p2pSwap.expired";

            case "p2p_swap_reserved":
                return acceptedByYou ? "p2pSwap.reserved" : "p2pSwap.progress.acceptedBy";

            case "p2p_swap_accepted":
                return acceptedByYou ? "p2pSwap.accepted" : "p2pSwap.progress.acceptedBy";

            case "p2p_swap_completed":
                return acceptedByYou
                    ? "p2pSwap.progress.completed"
                    : recipientId
                      ? "p2pSwap.progress.acceptedBy"
                      : "p2pSwap.accepted";
        }
    });

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
                            showFailureToast(resp, false);
                        } else {
                            client.refreshAccountBalance(content.token1.ledger);
                        }
                    });
            }
        }

        return Promise.resolve();
    }

    function accept() {
        if (!messageContext || !messageId) return;
        confirming = false;

        if (!me) {
            client
                .acceptP2PSwap(
                    messageContext.chatId,
                    messageContext.threadRootMessageIndex,
                    messageId,
                )
                .then((resp) => {
                    if (resp.kind !== "success") {
                        showFailureToast(resp, true);
                    } else {
                        client.refreshAccountBalance(content.token1.ledger);
                    }
                });
        }
    }

    function showFailureToast(
        response: AcceptP2PSwapResponse | CancelP2PSwapResponse,
        accepting: boolean,
    ) {
        if ($pinNumberErrorMessageStore !== undefined) {
            toastStore.showFailureToast(pinNumberErrorMessageStore);
            return;
        }

        let key: string = response.kind;

        switch (key) {
            case "already_reserved":
            case "already_completed":
                key = "already_accepted";
                break;
            case "channel_not_found":
            case "chat_not_found":
            case "user_suspended":
            case "user_not_in_group":
            case "user_not_in_community":
            case "user_not_in_channel":
            case "chat_frozen":
            case "insufficient_funds":
            case "internal_error":
                key = accepting ? "unknown_accept_error" : "unknown_cancel_error";
                break;
        }

        toastStore.showFailureToast(i18nKey("p2pSwap." + key));
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
            ledger0={content.token0.ledger}
            ledger1={content.token1.ledger}
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
                    color={me ? ColourVars.secondaryLight : ColourVars.primaryLight}
                    size="1.25rem" />
                <ChatCaption colour={me ? "secondaryLight" : "primaryLight"}>
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
        <Column padding="xs" borderRadius="lg" background={ColourVars.background2}>
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
            backgroundColor={ColourVars.background2}
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
        background={ColourVars.background0}
        crossAxisAlignment="center">
        <Avatar size={"md"} url={getProxyAdjustedBlobUrl(tokenState.logo) ?? tokenState.logo} />
        <Column width="fill">
            <Subtitle fontWeight="bold">{tokenState.symbol}</Subtitle>
            <Body colour="textSecondary" fontWeight="bold" maxLines={1}>
                {tokenState.token.name}
            </Body>
        </Column>
        <Column width="hug">
            <Subtitle fontWeight="bold" align="end">
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
            borderColour={ColourVars.background2}
            background={ColourVars.background0}
            mainAxisAlignment={"center"}
            crossAxisAlignment={"center"}>
            <ArrowDown size={"1rem"} />
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

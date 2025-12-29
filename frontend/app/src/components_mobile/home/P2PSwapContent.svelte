<script lang="ts">
    import {
        Avatar,
        BodySmall,
        Button,
        ColourVars,
        Column,
        type Padding,
        Row,
        Subtitle,
    } from "component-lib";
    import type {
        AcceptP2PSwapResponse,
        CancelP2PSwapResponse,
        MessageContext,
        OpenChat,
        P2PSwapContent,
        ResourceKey,
    } from "openchat-client";
    import {
        enhancedCryptoLookup as cryptoLookup,
        currentUserIdStore,
        isDiamondStore,
        publish,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import ArrowDown from "svelte-material-icons/ArrowDown.svelte";
    import Clock from "svelte-material-icons/Clock.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../stores/pinNumber";
    import { now500 } from "../../stores/time";
    import { toastStore } from "../../stores/toast";
    import AreYouSure from "../AreYouSure.svelte";
    import MulticolourText from "../MulticolourText.svelte";
    import Translatable from "../Translatable.svelte";
    import AcceptP2PSwapModal from "./AcceptP2PSwapModal.svelte";
    import ContentCaption from "./ContentCaption.svelte";
    import Markdown from "./Markdown.svelte";
    import P2PSwapProgress from "./P2PSwapProgress.svelte";
    import { TokenState } from "./wallet/walletState.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        senderId: string;
        content: P2PSwapContent;
        messageContext: MessageContext;
        messageId: bigint;
        me: boolean;
        reply: boolean;
        pinned: boolean;
    }

    let { senderId, content, messageContext, messageId, me, reply, pinned }: Props = $props();

    let confirming = $state(false);
    let showDetails = $state(false);

    let fromDetails = $derived($cryptoLookup.get(content.token0.ledger)!);
    let toDetails = $derived($cryptoLookup.get(content.token1.ledger)!);
    let fromState = $derived(new TokenState(fromDetails));
    let toState = $derived(new TokenState(toDetails));
    let finished = $derived($now500 >= Number(content.expiresAt));
    let timeRemaining = $derived(
        finished
            ? $_("p2pSwap.expired")
            : client.formatTimeRemaining($now500, Number(content.expiresAt)),
    );
    let acceptedByYou = $derived(
        (content.status.kind === "p2p_swap_reserved" &&
            content.status.reservedBy === $currentUserIdStore) ||
            ((content.status.kind === "p2p_swap_accepted" ||
                content.status.kind === "p2p_swap_completed") &&
                content.status.acceptedBy === $currentUserIdStore),
    );

    let fromAmount = $derived(client.formatTokens(content.token0Amount, content.token0.decimals));
    let toAmount = $derived(client.formatTokens(content.token1Amount, content.token1.decimals));
    let buttonDisabled = $derived(content.status.kind !== "p2p_swap_open" || reply || pinned);

    type Labels = {
        instructionText?: string;
        buttonText: ResourceKey;
        summaryText: ResourceKey;
    };

    let labels = $derived.by<Labels>(() => {
        let instructionText: string | undefined = undefined;
        let buttonText: ResourceKey = i18nKey("");

        if (content.status.kind === "p2p_swap_open") {
            if (me) {
                instructionText = undefined;
                buttonText = i18nKey("p2pSwap.cancel");
            } else {
                instructionText = undefined;
                buttonText = i18nKey("p2pSwap.accept");
            }
        } else if (content.status.kind === "p2p_swap_cancelled") {
            instructionText = undefined;
            buttonText = i18nKey("p2pSwap.cancelled");
        } else if (content.status.kind === "p2p_swap_expired") {
            instructionText = undefined;
            buttonText = i18nKey("p2pSwap.expired");
        } else if (content.status.kind === "p2p_swap_reserved") {
            if (acceptedByYou) {
                instructionText = $_("p2pSwap.youReserved");
            } else {
                instructionText = $_("p2pSwap.reservedBy", {
                    values: { user: `@UserId(${content.status.reservedBy})` },
                });
            }
            buttonText = i18nKey("p2pSwap.reserved");
        } else if (content.status.kind === "p2p_swap_accepted") {
            if (acceptedByYou) {
                instructionText = $_("p2pSwap.youAccepted");
            } else {
                instructionText = $_("p2pSwap.acceptedBy", {
                    values: { user: `@UserId(${content.status.acceptedBy})` },
                });
            }
            buttonText = i18nKey("p2pSwap.accepted");
        } else if (content.status.kind === "p2p_swap_completed") {
            if (acceptedByYou) {
                instructionText = $_("p2pSwap.youCompleted");
            } else {
                instructionText = $_("p2pSwap.completed", {
                    values: { user: `@UserId(${content.status.acceptedBy})` },
                });
            }
            buttonText = i18nKey("p2pSwap.accepted");
        }

        return {
            instructionText,
            buttonText,
            summaryText: i18nKey("p2pSwap.summary", {
                fromAmount,
                toAmount,
                fromToken: content.token0.symbol,
                toToken: content.token1.symbol,
            }),
        };
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
                    }
                });
        }

        return Promise.resolve();
    }

    function accept() {
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
{:else if showDetails}
    <P2PSwapProgress {senderId} {content} onClose={() => (showDetails = false)} />
{/if}

{#snippet token(
    label: string,
    state: TokenState,
    amount: bigint,
    padding: Padding = ["md", "lg", "md", "sm"],
)}
    <Row
        gap={"lg"}
        crossAxisAlignment={"center"}
        {padding}
        borderRadius={"lg"}
        background={ColourVars.background1}>
        <Avatar size={"lg"} url={state.logo} />
        <Column>
            <Subtitle ellipsisTruncate fontWeight={"bold"}>
                <MulticolourText
                    parts={[
                        {
                            text: i18nKey(label),
                            colour: "textPrimary",
                        },
                        {
                            text: i18nKey(`${state.formatTokens(amount)} ${state.symbol}`),
                            colour: "primary",
                        },
                    ]} />
            </Subtitle>
            <BodySmall colour={"textSecondary"}>
                {`= ${state.formatConvertedTokens(amount)}`}
            </BodySmall>
        </Column>
    </Row>
{/snippet}

<Column
    padding={["lg", "zero"]}
    gap={"md"}
    crossAxisAlignment={"center"}
    mainAxisAlignment={"center"}>
    {#if content.status.kind === "p2p_swap_open"}
        <Row
            padding={["sm", "md"]}
            borderRadius={"md"}
            mainAxisAlignment={"center"}
            width={"hug"}
            backgroundColor={ColourVars.background1}
            crossAxisAlignment={"center"}
            gap={"xs"}>
            <Clock size={"1em"} color={"#ffffff"} />
            <BodySmall colour={"textSecondary"}>
                {timeRemaining}
            </BodySmall>
        </Row>
    {/if}
    <Column minWidth={"16rem"} onClick={onSwapClick} crossAxisAlignment={"center"} gap={"xs"}>
        {@render token("Swap ", fromState, content.token0Amount, ["md", "lg", "xl", "sm"])}
        <Row
            supplementalClass={"swap_content_down_arrow"}
            width={{ size: "2.5rem" }}
            height={{ size: "2.5rem" }}
            borderRadius={"circle"}
            borderWidth={"extraThick"}
            borderColour={me ? ColourVars.primary : ColourVars.background2}
            background={ColourVars.background1}
            mainAxisAlignment={"center"}
            crossAxisAlignment={"center"}>
            <ArrowDown size={"1.2rem"} />
        </Row>
        {@render token("For ", toState, content.token1Amount, ["xl", "lg", "md", "sm"])}
    </Column>
    <ContentCaption caption={content.caption} edited={false} />
    {#if labels.instructionText !== undefined}
        <BodySmall>
            <Markdown text={labels.instructionText} />
        </BodySmall>
    {/if}
    <Row overflow={"visible"} background={ColourVars.background1} borderRadius={"sm"}>
        <Button
            secondary
            width={"fill"}
            loading={content.status.kind === "p2p_swap_reserved" ||
                content.status.kind === "p2p_swap_accepted"}
            disabled={buttonDisabled}
            onClick={onAcceptOrCancel}>
            <Translatable resourceKey={labels.buttonText} />
        </Button>
    </Row>
</Column>

<style lang="scss">
    :global(.container.swap_content_down_arrow) {
        position: absolute;
        width: 2.5rem;
        height: 2.5rem;
        transform: translateY(4rem);
        z-index: 1;
    }
</style>

<script lang="ts">
    import { i18nKey, interpolate } from "@src/i18n/i18n";
    import { pinNumberErrorMessageStore } from "@src/stores/pinNumber";
    import {
        Avatar,
        Body,
        BodySmall,
        Button,
        ColourVars,
        CommonButton,
        Container,
        Sheet,
        TextArea,
    } from "component-lib";
    import {
        formatTokens,
        nowNanos,
        OpenChat,
        type CryptocurrencyContent,
        type MessageContext,
        type UserSummary,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Chat from "svelte-material-icons/ChatPlusOutline.svelte";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import SelectUser from "../../SelectDirectUser.svelte";
    import Translatable from "../../Translatable.svelte";
    import TokenInput from "../TokenInput.svelte";
    import TransferFeesMessage from "../TransferFeesMessage.svelte";
    import SuccessIcon from "./SuccessIcon.svelte";
    import type { TokenState } from "./walletState.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        tokenState: TokenState;
        onComplete: () => void;
    }

    let { tokenState, onComplete }: Props = $props();

    let selectedUser = $state<UserSummary>();
    let messageContext = $derived.by<MessageContext | undefined>(() => {
        if (selectedUser === undefined) return undefined;
        return { chatId: { kind: "direct_chat", userId: selectedUser.userId } };
    });
    let validAmount = $state(false);
    // svelte-ignore state_referenced_locally
    let message = $state("");
    let valid = $derived(validAmount && selectedUser !== undefined);
    let status = $state<"idle" | "sending" | "sent" | "error">("idle");
    let busy = $derived(status === "sending");

    function send() {
        if (selectedUser === undefined || messageContext === undefined) return;

        const content: CryptocurrencyContent = {
            kind: "crypto_content",
            caption: message === "" ? undefined : message,
            transfer: {
                kind: "pending",
                ledger: tokenState.ledger,
                token: tokenState.symbol,
                recipient: selectedUser.userId,
                amountE8s: tokenState.draftAmount,
                feeE8s: tokenState.transferFees,
                createdAtNanos: nowNanos(),
            },
        };

        status = "sending";

        client.sendMessageWithContent(messageContext, content, false).then((resp) => {
            if (resp.kind === "success" || resp.kind === "transfer_success") {
                status = "sent";
            } else if ($pinNumberErrorMessageStore === undefined) {
                status = "error";
                //error = "errorSendingMessage";
            }
        });
    }
</script>

<SelectUser
    disabled={busy}
    onSelect={(user) => (selectedUser = user)}
    selected={selectedUser}
    placeholder={`Select a user to send ${tokenState.symbol} to`}>
    {#snippet subtext()}
        {`Select a user to send ${tokenState.symbol} to`}
    {/snippet}
</SelectUser>

<TokenInput
    ledger={tokenState.ledger}
    minAmount={tokenState.minAmount}
    disabled={busy}
    error={!validAmount}
    bind:valid={validAmount}
    maxAmount={tokenState.maxAmount}
    bind:amount={tokenState.draftAmount}>
    {#snippet subtext()}
        {`Minimum amount ${tokenState.minAmountLabel} ${tokenState.symbol}`}
    {/snippet}
</TokenInput>

<TextArea
    disabled={busy}
    maxlength={200}
    rows={3}
    placeholder={interpolate($_, i18nKey("tokenTransfer.messagePlaceholder"))}
    bind:value={message}>
    {#snippet subtext()}
        {"Recipient will receive this message as a DM"}
    {/snippet}
</TextArea>

<Container mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"center"}>
    <TransferFeesMessage
        symbol={tokenState.symbol}
        tokenDecimals={tokenState.decimals}
        transferFees={tokenState.transferFees} />

    <CommonButton onClick={send} loading={status === "sending"} disabled={!valid} mode={"active"}>
        {#snippet icon(color, size)}
            <Chat {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("Send to user")} />
    </CommonButton>
</Container>

{#if status === "sent" && selectedUser !== undefined}
    <Sheet>
        <Container gap={"xs"} direction={"vertical"} padding={"xl"}>
            <SuccessIcon tokenUrl={tokenState.logo} />

            <Container
                padding={"lg"}
                gap={"md"}
                borderRadius={["lg", "lg", "zero", "zero"]}
                background={ColourVars.background2}>
                <Avatar url={client.userAvatarUrl(selectedUser)}></Avatar>
                <Container direction={"vertical"}>
                    <BodySmall colour={"textSecondary"}>
                        <Translatable resourceKey={i18nKey("Recipient")} />
                    </BodySmall>
                    <Body fontWeight={"bold"}>
                        {#if selectedUser.displayName}
                            {selectedUser.displayName} (@{selectedUser.username})
                        {:else}
                            @{selectedUser.username}
                        {/if}
                    </Body>
                </Container>
            </Container>
            <Container
                gap={"lg"}
                background={ColourVars.background2}
                padding={"lg"}
                direction={"vertical"}>
                <Container mainAxisAlignment={"spaceBetween"}>
                    <BodySmall colour={"textSecondary"}>
                        <Translatable resourceKey={i18nKey("Transfer amount")} />
                    </BodySmall>
                    <Body width={{ kind: "hug" }} colour={"primary"} fontWeight={"bold"}>
                        {formatTokens(tokenState.draftAmount, tokenState.decimals)}
                    </Body>
                </Container>
                <Container mainAxisAlignment={"spaceBetween"}>
                    <BodySmall colour={"textSecondary"}>
                        <Translatable resourceKey={i18nKey("Fee")} />
                    </BodySmall>
                    <Body width={{ kind: "hug" }} fontWeight={"bold"}>
                        {formatTokens(tokenState.transferFees, tokenState.decimals)}
                    </Body>
                </Container>
                <Container mainAxisAlignment={"spaceBetween"}>
                    <BodySmall colour={"textSecondary"}>
                        <Translatable resourceKey={i18nKey("Date & time")} />
                    </BodySmall>
                    <Body width={{ kind: "hug" }} fontWeight={"bold"}>
                        {new Date().toISOString()}
                    </Body>
                </Container>
                <Container mainAxisAlignment={"spaceBetween"}>
                    <BodySmall colour={"textSecondary"}>
                        <Translatable resourceKey={i18nKey("Transaction ID")} />
                    </BodySmall>
                    <Body width={{ kind: "hug" }} fontWeight={"bold"}>
                        {"XXXXXXXX"}
                    </Body>
                </Container>
            </Container>
            <Container
                direction={"vertical"}
                padding={"lg"}
                gap={"md"}
                borderRadius={["zero", "zero", "lg", "lg"]}
                background={ColourVars.background2}>
                <BodySmall colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("With message")} />
                </BodySmall>
                <Body>
                    {message}
                </Body>
            </Container>
        </Container>
        <Container padding={["sm", "xl", "zero", "xl"]}>
            <Button onClick={onComplete}>
                {#snippet icon(color)}
                    <ChevronRight {color} />
                {/snippet}
                Done
            </Button>
        </Container>
    </Sheet>
{/if}

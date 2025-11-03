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
        cryptoBalanceStore,
        formatTokens,
        nowNanos,
        OpenChat,
        type CryptocurrencyContent,
        type EnhancedTokenDetails,
        type MessageContext,
        type UserSummary,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Chat from "svelte-material-icons/ChatOutline.svelte";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import SelectUser from "../../SelectDirectUser.svelte";
    import Translatable from "../../Translatable.svelte";
    import TokenInput from "../TokenInput.svelte";
    import TransferFeesMessage from "../TransferFeesMessage.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        token: EnhancedTokenDetails;
        onComplete: () => void;
    }

    let { token, onComplete }: Props = $props();

    let ledger = $derived(token.ledger);
    let transferFees = $derived(token.transferFee);
    let cryptoBalance = $derived($cryptoBalanceStore.get(ledger) ?? 0n);
    let selectedUser = $state<UserSummary>();
    let messageContext = $derived.by<MessageContext | undefined>(() => {
        if (selectedUser === undefined) return undefined;
        return { chatId: { kind: "direct_chat", userId: selectedUser.userId } };
    });
    let validAmount = $state(false);
    let minAmount = $derived(token.transferFee * BigInt(10));
    let minAmountLabel = $derived(Number(minAmount) / Math.pow(10, token.decimals));
    // svelte-ignore state_referenced_locally
    let draftAmount = $state(minAmount);
    let message = $state("");
    let valid = $derived(validAmount && selectedUser !== undefined);
    let status = $state<"idle" | "sending" | "sent" | "error">("idle");
    let busy = $derived(status === "sending");

    function maxAmount(balance: bigint): bigint {
        return balance - transferFees;
    }

    function send() {
        if (selectedUser === undefined || messageContext === undefined) return;

        const content: CryptocurrencyContent = {
            kind: "crypto_content",
            caption: message === "" ? undefined : message,
            transfer: {
                kind: "pending",
                ledger,
                token: token.symbol,
                recipient: selectedUser.userId,
                amountE8s: draftAmount,
                feeE8s: transferFees,
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
    placeholder={`Select a user to send ${token.symbol} to`}>
    {#snippet subtext()}
        {`Select a user to send ${token.symbol} to`}
    {/snippet}
</SelectUser>

<TokenInput
    {ledger}
    {minAmount}
    disabled={busy}
    error={!validAmount}
    bind:valid={validAmount}
    maxAmount={maxAmount(cryptoBalance)}
    bind:amount={draftAmount}>
    {#snippet subtext()}
        {`Minimum amount ${minAmountLabel} ${token.symbol}`}
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
        symbol={token.symbol}
        tokenDecimals={token.decimals}
        transferFees={token.transferFee} />

    <CommonButton onClick={send} loading={status === "sending"} disabled={!valid} mode={"active"}>
        {#snippet icon(color)}
            <Chat {color} />
        {/snippet}
        <Translatable resourceKey={i18nKey("Send to user")} />
    </CommonButton>
</Container>

{#if status === "sent" && selectedUser !== undefined}
    <Sheet>
        <Container gap={"xs"} direction={"vertical"} padding={"xl"}>
            {@render success_icon()}

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
                        {formatTokens(draftAmount, token.decimals)}
                    </Body>
                </Container>
                <Container mainAxisAlignment={"spaceBetween"}>
                    <BodySmall colour={"textSecondary"}>
                        <Translatable resourceKey={i18nKey("Fee")} />
                    </BodySmall>
                    <Body width={{ kind: "hug" }} fontWeight={"bold"}>
                        {formatTokens(transferFees, token.decimals)}
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

{#snippet success_icon()}
    <Container padding={"xl"} crossAxisAlignment={"center"} mainAxisAlignment={"center"}>
        <Container allowOverflow width={{ kind: "hug" }}>
            <svg
                width="80"
                height="80"
                viewBox="0 0 80 80"
                fill="none"
                xmlns="http://www.w3.org/2000/svg">
                <path
                    d="M40 2C60.9868 2 78 19.0132 78 40C78 60.9868 60.9868 78 40 78C19.0132 78 2 60.9868 2 40C2 19.0132 19.0132 2 40 2Z"
                    fill="#1C1D26" />
                <path
                    d="M40 2C60.9868 2 78 19.0132 78 40C78 60.9868 60.9868 78 40 78C19.0132 78 2 60.9868 2 40C2 19.0132 19.0132 2 40 2Z"
                    stroke="#4DC164"
                    stroke-width="4" />
                <path
                    d="M60.25 28.7496L33.25 55.7496L20.875 43.3746L24.0475 40.2021L33.25 49.3821L57.0775 25.5771L60.25 28.7496Z"
                    fill="#4DC164" />
            </svg>
            <div class="nested_avatar">
                <Avatar size={"sm"} url={token.logo}></Avatar>
            </div>
        </Container>
    </Container>
{/snippet}

<style lang="scss">
    .nested_avatar {
        padding: 4px;
        background-color: var(--background-1);
        border-radius: var(--rad-circle);
        position: absolute;
        bottom: -0.5rem;
        right: -0.5rem;
    }
</style>

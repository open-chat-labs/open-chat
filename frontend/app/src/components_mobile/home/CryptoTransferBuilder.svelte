<script lang="ts">
    import {
        Body,
        ColourVars,
        CommonButton,
        Container,
        IconButton,
        Row,
        Sheet,
        StatusCard,
        TextArea,
    } from "component-lib";
    import type { ChatSummary, OpenChat, UserSummary } from "openchat-client";
    import {
        allUsersStore,
        enhancedCryptoLookup as cryptoLookup,
        currentUserIdStore,
    } from "openchat-client";
    import { type CryptocurrencyContent, type MessageContext, nowNanos } from "openchat-shared";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import Chat from "svelte-material-icons/ChatPlusOutline.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../stores/pinNumber";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Translatable from "../Translatable.svelte";
    import CryptoSelector from "./CryptoSelector.svelte";
    import SingleUserSelector from "./SingleUserSelector.svelte";
    import TokenInput from "./TokenInput.svelte";
    import TransferFeesMessage from "./TransferFeesMessage.svelte";
    import { TokenState } from "./wallet/walletState.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        ledger: string;
        chat: ChatSummary;
        defaultReceiver: string | undefined;
        messageContext: MessageContext;
        onClose: () => void;
    }

    let { ledger = $bindable(), chat, defaultReceiver, messageContext, onClose }: Props = $props();

    let error: string | undefined = $state(undefined);
    let message = $state("");
    let confirming = $state(false);
    let receiver: UserSummary | undefined = $state(undefined);
    let validAmount: boolean = $state(false);
    let sending = $state(false);

    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    let tokenState = $derived(new TokenState(tokenDetails, "usd"));
    let multiUserChat = $derived(chat.kind === "group_chat" || chat.kind === "channel");
    let valid = $derived(error === undefined && validAmount && receiver !== undefined);
    let errorMessage = $derived(error !== undefined ? i18nKey(error) : $pinNumberErrorMessageStore);

    onMount(() => {
        // default the receiver to the other user in a direct chat
        if (chat.kind === "direct_chat") {
            receiver = $allUsersStore.get(chat.them.userId);
        } else if (defaultReceiver !== undefined && defaultReceiver !== $currentUserIdStore) {
            receiver = $allUsersStore.get(defaultReceiver);
        }
    });

    function send() {
        if (!confirming) {
            confirming = true;
            return;
        }

        if (receiver === undefined) return;

        const content: CryptocurrencyContent = {
            kind: "crypto_content",
            caption: message === "" ? undefined : message,
            transfer: {
                kind: "pending",
                ledger,
                token: tokenState.symbol,
                recipient: receiver.userId,
                amountE8s: tokenState.draftAmount,
                feeE8s: tokenState.transferFees,
                createdAtNanos: nowNanos(),
            },
        };

        sending = true;
        error = undefined;

        client
            .sendMessageWithContent(messageContext, content, false)
            .then((resp) => {
                if (resp.kind === "success" || resp.kind === "transfer_success") {
                    onClose();
                } else if ($pinNumberErrorMessageStore === undefined) {
                    error = "errorSendingMessage";
                }
            })
            .finally(() => (sending = false));
    }
</script>

<Sheet onDismiss={onClose}>
    <Container gap={"lg"} padding={["lg", "xl"]} direction={"vertical"}>
        <Row>
            <Body fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Send crypto")} />
            </Body>
            <IconButton onclick={onClose}>
                {#snippet icon(color)}
                    <Close {color} />
                {/snippet}
            </IconButton>
        </Row>
        <CryptoSelector
            showRefresh
            draftAmount={tokenState.draftAmount}
            filter={(t) => t.balance > 0}
            bind:ledger />

        {#if multiUserChat}
            <SingleUserSelector bind:selectedReceiver={receiver}>
                {#snippet subtext()}
                    <Translatable resourceKey={i18nKey("Choose a token recipient")} />
                {/snippet}
            </SingleUserSelector>
        {/if}
        <TokenInput
            {ledger}
            minAmount={tokenState.minAmount}
            disabled={sending}
            error={!validAmount}
            bind:valid={validAmount}
            maxAmount={tokenState.maxAmount}
            bind:amount={tokenState.draftAmount}>
            {#snippet subtext()}
                {`Minimum amount ${tokenState.minAmountLabel} ${tokenState.symbol}`}
            {/snippet}
        </TokenInput>

        <TextArea
            disabled={sending}
            maxlength={200}
            rows={3}
            placeholder={interpolate($_, i18nKey("tokenTransfer.messagePlaceholder"))}
            bind:value={message}>
            {#snippet subtext()}
                {"Recipient will receive this message as a DM"}
            {/snippet}
        </TextArea>

        {#if confirming}
            <StatusCard
                background={ColourVars.background2}
                title={"Warning"}
                body={interpolate(
                    $_,
                    i18nKey("tokenTransfer.warning", { token: tokenState.symbol }),
                )}
                mode={"warning"}></StatusCard>
        {/if}
        {#if errorMessage !== undefined}
            <div class="error">
                <ErrorMessage><Translatable resourceKey={errorMessage} /></ErrorMessage>
            </div>
        {/if}

        <Container mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"center"}>
            <TransferFeesMessage
                symbol={tokenState.symbol}
                tokenDecimals={tokenState.decimals}
                transferFees={tokenState.transferFees} />

            <CommonButton
                onClick={send}
                loading={sending}
                disabled={!valid || sending}
                mode={"active"}>
                {#snippet icon(color, size)}
                    <Chat {color} {size} />
                {/snippet}
                <Translatable
                    resourceKey={i18nKey(
                        confirming ? "tokenTransfer.confirm" : "tokenTransfer.send",
                    )} />
            </CommonButton>
        </Container>
    </Container>
</Sheet>

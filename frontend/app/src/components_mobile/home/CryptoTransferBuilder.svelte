<script lang="ts">
    import { Body, Column, CommonButton, Container, IconButton, Row, Sheet } from "component-lib";
    import type { ChatSummary, UserSummary } from "openchat-client";
    import {
        allUsersStore,
        enhancedCryptoLookup as cryptoLookup,
        currentUserIdStore,
        localUpdates,
    } from "openchat-client";
    import { type CryptocurrencyContent, type MessageContext, nowNanos } from "openchat-shared";
    import { onMount } from "svelte";
    import Chat from "svelte-material-icons/ChatPlusOutline.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../stores/pinNumber";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Translatable from "../Translatable.svelte";
    import CryptoSelector from "./CryptoSelector.svelte";
    import SingleUserSelector from "./SingleUserSelector.svelte";
    import TokenInput from "./TokenInput.svelte";
    import TransferFeesMessage from "./TransferFeesMessage.svelte";
    import { TokenState } from "./wallet/walletState.svelte";

    interface Props {
        ledger: string;
        chat: ChatSummary;
        defaultReceiver: string | undefined;
        messageContext: MessageContext;
        onClose: () => void;
    }

    let { ledger = $bindable(), chat, defaultReceiver, messageContext, onClose }: Props = $props();

    let error: string | undefined = $state(undefined);
    let receiver: UserSummary | undefined = $state(undefined);
    let validAmount: boolean = $state(false);
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
        if (receiver === undefined) return;

        const content: CryptocurrencyContent = {
            kind: "crypto_content",
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

        localUpdates.draftMessages.setAttachment(messageContext, content);

        onClose();
    }
</script>

<Sheet onDismiss={onClose}>
    <Container gap={"xl"} padding={["sm", "xl", "huge"]} direction={"vertical"}>
        <Row crossAxisAlignment="center" padding={["zero", "zero", "zero", "sm"]}>
            <Body fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Send crypto")} />
            </Body>
            <IconButton onclick={onClose}>
                {#snippet icon(color)}
                    <Close {color} />
                {/snippet}
            </IconButton>
        </Row>

        <!-- TODO "fix" the double sheet! -->
        <!-- Perhaps we just get the content of the crypto selector and replace current sheet (?) -->
        <CryptoSelector
            showRefresh
            draftAmount={tokenState.draftAmount}
            filter={(t) => t.balance > 0}
            bind:ledger />

        <Column gap={"md"}>
            {#if multiUserChat}
                <SingleUserSelector bind:selectedReceiver={receiver}>
                    {#snippet subtext()}
                        <Translatable resourceKey={i18nKey("Choose a token recipient")} />
                    {/snippet}
                </SingleUserSelector>
            {/if}

            <TokenInput
                {ledger}
                error={!validAmount}
                balance={tokenState.cryptoBalance}
                minAmount={tokenState.minAmount}
                maxAmount={tokenState.maxAmount}
                bind:valid={validAmount}
                bind:amount={tokenState.draftAmount}>
                {#snippet subtext()}
                    {`Minimum amount ${tokenState.minAmountLabel} ${tokenState.symbol}`}
                {/snippet}
            </TokenInput>
        </Column>

        {#if errorMessage !== undefined}
            <div class="error">
                <ErrorMessage><Translatable resourceKey={errorMessage} /></ErrorMessage>
            </div>
        {/if}

        <Container
            mainAxisAlignment={"spaceBetween"}
            crossAxisAlignment={"center"}
            padding={["zero", "sm"]}>
            <TransferFeesMessage
                symbol={tokenState.symbol}
                tokenDecimals={tokenState.decimals}
                transferFees={tokenState.transferFees} />

            <CommonButton
                onClick={send}
                disabled={!valid || !tokenState.draftAmount}
                mode={"active"}>
                {#snippet icon(color, size)}
                    <Chat {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("tokenTransfer.send")} />
            </CommonButton>
        </Container>
    </Container>
</Sheet>

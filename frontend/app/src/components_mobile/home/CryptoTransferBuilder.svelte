<script lang="ts">
    import { Body, Column, CommonButton, Container, IconButton, Row, Sheet } from "component-lib";
    import type { ChatSummary, SignerWallet, UserSummary } from "@client";
    import {
        allUsersStore,
        enhancedCryptoLookup as cryptoLookup,
        currentUserIdStore,
        localUpdates,
    } from "@client";
    import { type CryptocurrencyContent, type MessageContext, nowNanos } from "@shared";
    import { onMount } from "svelte";
    import Chat from "svelte-material-icons/ChatPlusOutline.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../stores/pinNumber";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Translatable from "../Translatable.svelte";
    import CryptoSelector from "./CryptoSelector.svelte";
    import ExternalWalletApproval from "./ExternalWalletApproval.svelte";
    import SingleUserSelector from "./SingleUserSelector.svelte";
    import SourceWalletSelector from "./SourceWalletSelector.svelte";
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
    // The external wallet the transfer will come from, or undefined for the user's own OpenChat
    // account. Paying from an external wallet spends that wallet's balance rather than the user's
    // OpenChat one, so none of the limits derived from the latter apply while one is selected.
    let sourceWallet = $state<SignerWallet | undefined>();
    let payFromWallet = $derived(sourceWallet !== undefined);
    let approval: ExternalWalletApproval | undefined = $state();
    let approving = $state(false);
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
        const to = receiver;
        if (to === undefined) return;

        if (approval !== undefined) {
            // The wallet has to approve us taking the transfer before we make it. Nothing may be
            // awaited before this call - the wallet opens in a popup, which the browser only
            // allows while it is still handling the tap. The attached draft is only sent when the
            // user sends the message, so the approval has to be granted here, while we still have
            // a tap to open the wallet from; if the draft is abandoned, or sits longer than the
            // approval's validity, the allowance expires unspent and the send fails cleanly.
            approving = true;
            approval
                .approve()
                .then((fromAccount) => {
                    if (fromAccount !== undefined) {
                        attach(to, fromAccount);
                    }
                })
                .finally(() => (approving = false));
        } else {
            attach(to);
        }
    }

    // `fromAccount` is an external wallet which has just approved the transfer. Without it the
    // funds come from the user's own OpenChat account, as they always have.
    function attach(to: UserSummary, fromAccount?: string) {
        const content: CryptocurrencyContent = {
            kind: "crypto_content",
            transfer: {
                kind: "pending",
                ledger,
                token: tokenState.symbol,
                recipient: to.userId,
                amountE8s: tokenState.draftAmount,
                feeE8s: tokenState.transferFees,
                createdAtNanos: nowNanos(),
                fromAccount,
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
        <!-- An external wallet's balance is its own business, so while one is selected the
             OpenChat balance is hidden and tokens the user holds none of stay available -->
        <CryptoSelector
            showRefresh
            hideBalance={payFromWallet}
            draftAmount={tokenState.draftAmount}
            filter={payFromWallet ? undefined : (t) => t.balance > 0}
            bind:ledger />

        <SourceWalletSelector bind:wallet={sourceWallet} />

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
                maxAmount={payFromWallet ? undefined : tokenState.maxAmount}
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

        {#if sourceWallet !== undefined}
            <ExternalWalletApproval
                bind:this={approval}
                wallet={sourceWallet}
                {ledger}
                amount={tokenState.draftAmount} />
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
                disabled={!valid || !tokenState.draftAmount || approving}
                loading={approving}
                mode={"active"}>
                {#snippet icon(color, size)}
                    <Chat {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("tokenTransfer.send")} />
            </CommonButton>
        </Container>
    </Container>
</Sheet>

<script lang="ts">
    import { Body, Column, CommonButton, Container, IconButton, Row, Sheet } from "component-lib";
    import type { ChatSummary, MessageContext, OpenChat } from "@client";
    import { getContext, untrack } from "svelte";
    import Chat from "svelte-material-icons/ChatPlusOutline.svelte";
    import Close from "svelte-material-icons/Close.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../stores/pinNumber";
    import { toastStore } from "../../stores/toast";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import { CryptoTransferForm } from "@src/logic/cryptoTransfer/cryptoTransferForm.svelte";
    import CryptoSelector from "./CryptoSelector.svelte";
    import SingleUserSelector from "./SingleUserSelector.svelte";
    import SourceWalletSelector from "./SourceWalletSelector.svelte";
    import TokenInput from "./TokenInput.svelte";
    import TransferFeesMessage from "./TransferFeesMessage.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        ledger: string;
        draftAmount: bigint;
        chat: ChatSummary;
        defaultReceiver: string | undefined;
        messageContext: MessageContext;
        onClose: () => void;
    }

    let { ledger, draftAmount, chat, defaultReceiver, messageContext, onClose }: Props = $props();

    const form = untrack(
        () =>
            new CryptoTransferForm(client, ledger, chat, defaultReceiver, draftAmount, {
                onRefreshFailed: (failure) => toastStore.showFailureToast(failure),
            }),
    );
    let tokenState = $derived(form.tokenState);

    // This only attaches a draft - the transfer is made when the user sends the message
    function send() {
        form.attach(messageContext);
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
            hideBalance={form.payFromWallet}
            draftAmount={tokenState.draftAmount}
            fees={tokenState.transferFees}
            filter={form.payFromWallet ? undefined : (t) => t.balance > 0}
            bind:ledger={() => form.ledger, (l) => (form.ledger = l)}
        />

        <SourceWalletSelector bind:wallet={form.sourceWallet} ledger={form.ledger} />

        <Column gap={"md"}>
            {#if form.multiUserChat}
                <SingleUserSelector bind:selectedReceiver={form.receiver}>
                    {#snippet subtext()}
                        <Translatable resourceKey={i18nKey("Choose a token recipient")} />
                    {/snippet}
                </SingleUserSelector>
            {/if}

            <TokenInput
                ledger={form.ledger}
                error={!form.validAmount}
                balance={tokenState.cryptoBalance}
                minAmount={tokenState.minAmount}
                maxAmount={form.spendingLimit}
                bind:amount={tokenState.draftAmount}
            >
                {#snippet subtext()}
                    {`Minimum amount ${tokenState.minAmountLabel} ${tokenState.symbol}`}
                {/snippet}
            </TokenInput>
        </Column>

        {#if $pinNumberErrorMessageStore !== undefined}
            <div class="error">
                <ErrorMessage
                    ><Translatable resourceKey={$pinNumberErrorMessageStore} /></ErrorMessage
                >
            </div>
        {/if}

        <Container
            mainAxisAlignment={"spaceBetween"}
            crossAxisAlignment={"center"}
            padding={["zero", "sm"]}
        >
            <TransferFeesMessage
                symbol={tokenState.symbol}
                tokenDecimals={tokenState.decimals}
                transferFees={tokenState.transferFees}
            />

            <CommonButton onClick={send} disabled={!form.valid} mode={"active"}>
                {#snippet icon(color, size)}
                    <Chat {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("tokenTransfer.send")} />
            </CommonButton>
        </Container>
    </Container>
</Sheet>

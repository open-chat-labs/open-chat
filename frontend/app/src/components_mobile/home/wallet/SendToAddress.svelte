<script lang="ts">
    import {
        Body,
        BodySmall,
        Button,
        ColourVars,
        CommonButton2,
        Container,
        Input,
        InputIconButton,
        Sheet,
    } from "component-lib";
    import { formatTokens, namedAccountsStore, type OpenChat, type ResourceKey } from "@client";
    import { publish } from "@shared";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import Account from "svelte-material-icons/AccountBoxOutline.svelte";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import QrcodeScan from "svelte-material-icons/QrcodeScan.svelte";
    import SendOutline from "svelte-material-icons/SendOutline.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../../stores/pinNumber";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import NetworkSelector from "../NetworkSelector.svelte";
    import TokenInput from "../TokenInput.svelte";
    import TransferFeesMessage from "../TransferFeesMessage.svelte";
    import AccountSelector from "./AccountSelector.svelte";
    import Scanner from "./Scanner.svelte";
    import SuccessIcon from "./SuccessIcon.svelte";
    import type { TokenState } from "@src/logic/wallet/walletState.svelte";
    import { WithdrawForm } from "@src/logic/wallet/withdrawForm.svelte";

    interface Props {
        tokenState: TokenState;
        onComplete: () => void;
    }

    let { tokenState, onComplete }: Props = $props();

    const client = getContext<OpenChat>("client");

    let status = $state<"idle" | "sending" | "sent" | "error">("idle");
    let busy = $derived(status === "sending");
    let error: ResourceKey | undefined = $state();
    let showAddressBook = $state(false);

    let scanner: Scanner;

    // The page is opened for one token
    const form = new WithdrawForm(client, untrack(() => tokenState));
    let namedAccount = $derived(
        $namedAccountsStore.find((a) => a.account === form.targetAccount),
    );
    // Only the saved addresses the send could reach are offered
    let fittingAccounts = $derived(
        $namedAccountsStore.filter((a) => form.acceptsAddress(a.account)),
    );
    let errorMessage = $derived(error !== undefined ? error : $pinNumberErrorMessageStore);

    function scan() {
        scanner?.scan();
    }

    async function send() {
        if (!form.canSend) return;

        status = "sending";
        error = undefined;
        const outcome = await form.send();

        switch (outcome.kind) {
            case "sent":
                status = "sent";
                break;
            case "cancelled":
                status = "idle";
                break;
            case "failed":
                error = outcome.message;
                status = "error";
                break;
            default:
                outcome satisfies never;
        }
    }

    function saveAddress() {
        publish("addRecipient", {
            account: { name: "", account: form.targetAccount },
            onComplete: () => publish("closeModalStack"),
        });
        tokenState.draftAmount = 0n;
        form.targetAccount = "";
        status = "idle";
    }
</script>

<Scanner onData={(data) => (form.targetAccount = data)} bind:this={scanner} />

{#if form.networks.length > 0 && form.selectedNetwork !== undefined}
    <NetworkSelector networks={form.networks} bind:selectedNetwork={form.selectedNetwork} />
{/if}

<Input
    bind:value={form.targetAccount}
    countdown={false}
    maxlength={100}
    disabled={busy}
    error={form.targetAccount.length > 0 && !form.targetAccountValid}
    placeholder={interpolate($_, i18nKey("cryptoAccount.sendTarget"))}>
    {#snippet iconButtons(color)}
        <!-- The target can't change mid-send, since the success sheet shows it as the recipient -->
        {#if !busy}
            {#if fittingAccounts.length > 0}
                <InputIconButton onClick={() => (showAddressBook = true)}>
                    <Account {color} />
                </InputIconButton>
            {/if}
            <InputIconButton onClick={scan}>
                <QrcodeScan {color} />
            </InputIconButton>
        {/if}
    {/snippet}
    {#snippet subtext()}
        <Translatable
            resourceKey={i18nKey(
                "Paste the address manually, chose from the list of saved addresses, or scan a QR code",
            )} />
    {/snippet}
</Input>

{#if form.targetIsUserIdAccount}
    <ErrorMessage
        ><Translatable resourceKey={i18nKey("cryptoAccount.sendToUserId")} /></ErrorMessage>
{/if}

<TokenInput
    balance={tokenState.cryptoBalance}
    ledger={tokenState.ledger}
    minAmount={form.minAmount}
    disabled={busy}
    error={!form.validAmount}
    bind:valid={form.validAmount}
    maxAmount={tokenState.maxAmount}
    bind:amount={tokenState.draftAmount}>
    {#snippet subtext()}
        {`Minimum amount ${tokenState.formatTokens(form.minAmount)} ${tokenState.symbol}`}
    {/snippet}
</TokenInput>

{#if showAddressBook}
    <AccountSelector
        accounts={fittingAccounts}
        onDismiss={() => (showAddressBook = false)}
        bind:targetAccount={form.targetAccount} />
{/if}

{#if errorMessage !== undefined}
    <ErrorMessage><Translatable resourceKey={errorMessage} /></ErrorMessage>
{/if}

<!-- TODO deduplicate, same in SendToUser.svelte -->
<Container mainAxisAlignment={"spaceBetween"} crossAxisAlignment={"center"} gap="lg">
    <Container direction={"vertical"} padding={["zero", "xs"]}>
        <TransferFeesMessage
            symbol={tokenState.symbol}
            tokenDecimals={tokenState.decimals}
            networkFee={form.networkFee}
            networkFeeIsEstimate={form.networkFeeIsEstimate}
            transferFees={tokenState.transferFees} />
    </Container>

    <CommonButton2
        onClick={send}
        loading={status === "sending"}
        disabled={!form.canSend}
        variant="primary"
        mode="regular">
        {#snippet icon(color, size)}
            <SendOutline {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey("Send")} />
    </CommonButton2>
</Container>

{#if status === "sent"}
    <Sheet>
        <Container gap={"xs"} direction={"vertical"} padding={"xl"}>
            <SuccessIcon tokenUrl={tokenState.logo} />

            <Container
                padding={"lg"}
                gap={"md"}
                direction={"vertical"}
                borderRadius={["lg", "lg", "zero", "zero"]}
                background={ColourVars.surface2}>
                <BodySmall colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("Recipient")} />
                    {#if namedAccount}
                        ({namedAccount.name})
                    {/if}
                </BodySmall>
                <Body fontWeight={"bold"}>
                    {form.targetAccount}
                </Body>
            </Container>
            <Container
                gap={"lg"}
                background={ColourVars.surface2}
                padding={["md", "lg", "md", "lg"]}
                borderRadius={["zero", "zero", "lg", "lg"]}
                direction={"vertical"}>
                <Container mainAxisAlignment={"spaceBetween"}>
                    <BodySmall colour={"textSecondary"}>
                        <Translatable resourceKey={i18nKey("Transfer amount")} />
                    </BodySmall>
                    <Body width={"hug"} colour={"primary"} fontWeight={"bold"}>
                        {formatTokens(tokenState.draftAmount, tokenState.decimals)}
                    </Body>
                </Container>
                <Container mainAxisAlignment={"spaceBetween"}>
                    <BodySmall colour={"textSecondary"}>
                        <Translatable resourceKey={i18nKey("Fee")} />
                    </BodySmall>
                    <Body width={"hug"} fontWeight={"bold"}>
                        {formatTokens(tokenState.transferFees, tokenState.decimals)}
                    </Body>
                </Container>
                {#if form.networkFeeFormatted !== undefined}
                    <Container mainAxisAlignment={"spaceBetween"}>
                        <BodySmall colour={"textSecondary"}>
                            <Translatable resourceKey={i18nKey("Network fee")} />
                        </BodySmall>
                        <Body width={"hug"} fontWeight={"bold"}>
                            <Translatable
                                resourceKey={i18nKey("cryptoAccount.networkFee", {
                                    amount: form.networkFeeFormatted,
                                    token: tokenState.symbol,
                                })} />
                        </Body>
                    </Container>
                {/if}
                <Container mainAxisAlignment={"spaceBetween"}>
                    <BodySmall colour={"textSecondary"}>
                        <Translatable resourceKey={i18nKey("Date & time")} />
                    </BodySmall>
                    <Body width={"hug"} fontWeight={"bold"}>
                        {new Date().toISOString()}
                    </Body>
                </Container>
                <Container mainAxisAlignment={"spaceBetween"}>
                    <BodySmall colour={"textSecondary"}>
                        <Translatable resourceKey={i18nKey("Transaction ID")} />
                    </BodySmall>
                    <Body width={"hug"} fontWeight={"bold"}>
                        {"XXXXXXXX"}
                    </Body>
                </Container>
            </Container>
        </Container>
        <Container gap={"sm"} direction={"vertical"} padding={["sm", "xl", "zero", "xl"]}>
            {#if namedAccount === undefined}
                <Button secondary onClick={saveAddress}>
                    {#snippet icon(color)}
                        <Account {color} />
                    {/snippet}
                    Save address
                </Button>
            {/if}
            <Button onClick={onComplete}>
                {#snippet icon(color)}
                    <ChevronRight {color} />
                {/snippet}
                Done
            </Button>
        </Container>
    </Sheet>
{/if}

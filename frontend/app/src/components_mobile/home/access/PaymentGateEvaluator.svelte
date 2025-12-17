<script lang="ts">
    import MulticolourText from "@src/components_mobile/MulticolourText.svelte";
    import { accessApprovalState } from "@src/utils/preview.svelte";
    import {
        Avatar,
        Body,
        BodySmall,
        Button,
        Caption,
        ColourVars,
        Column,
        CommonButton,
        H2,
        Row,
        StatusCard,
    } from "component-lib";
    import {
        type Level,
        type OpenChat,
        type PaymentGate,
        enhancedCryptoLookup,
        publish,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import QrCode from "svelte-material-icons/QrCode.svelte";
    import Refresh from "svelte-material-icons/Refresh.svelte";
    import Wallet from "svelte-material-icons/WalletOutline.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";
    import Markdown from "../Markdown.svelte";
    import { TokenState } from "../wallet/walletState.svelte";
    import AccessGateExpiry from "./AccessGateExpiry.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        gate: PaymentGate & { expiry: bigint | undefined };
        level: Level;
        onApprovePayment: (args: { ledger: string; amount: bigint; approvalFee: bigint }) => void;
        onClose: () => void;
    }

    let { gate, level, onApprovePayment, onClose }: Props = $props();

    let token = $derived($enhancedCryptoLookup.get(gate.ledgerCanister)!);
    let tokenState = $derived(new TokenState(token));
    let refreshingBalance = $state(false);
    let totalAmount = $derived(tokenState.formatTokens(gate.amount));
    let toOwner = $derived(tokenState.formatTokens(BigInt(Number(gate.amount) * 0.98)));
    let toOC = $derived(tokenState.formatTokens(BigInt(Number(gate.amount) * 0.02)));

    let cryptoBalance = $derived(
        accessApprovalState.balanceAfterCurrentCommitments(
            tokenState.ledger,
            tokenState.cryptoBalance,
        ),
    );

    let insufficientFunds = $derived(cryptoBalance < gate.amount);
    let approvalMessage = $derived(
        interpolate(
            $_,
            i18nKey(
                "access.paymentApprovalMessage",
                {
                    amount: tokenState.formatTokens(gate.amount),
                    token: token.symbol,
                },
                level,
                true,
            ),
        ),
    );
</script>

{#snippet tokenBalance()}
    <Row gap={"sm"}>
        <Row
            mainAxisAlignment={"spaceBetween"}
            crossAxisAlignment={"center"}
            borderRadius={"md"}
            minHeight={"4rem"}
            gap={"md"}
            background={ColourVars.background2}
            padding={["md", "lg"]}>
            <Avatar url={tokenState.logo} />
            <Column width={"fill"}>
                <Body fontWeight={"bold"} colour={"textPrimary"} width={"hug"}
                    >{tokenState.symbol}</Body>
                <Caption colour={"textSecondary"} fontWeight={"bold"}>
                    {tokenState.formatTokens(cryptoBalance)}
                </Caption>
            </Column>
        </Row>
        {#if insufficientFunds}
            <Column
                onClick={() => publish("receiveToken", tokenState)}
                mainAxisAlignment={"center"}
                crossAxisAlignment={"center"}
                width={{ size: "4rem" }}
                height={"fill"}
                borderRadius={"lg"}
                background={ColourVars.background2}
                padding={["sm", "md"]}>
                <QrCode size={"2rem"} color={ColourVars.textSecondary} />
            </Column>
        {/if}
    </Row>
{/snippet}

<Column gap={"lg"}>
    <Wallet size={"4.5rem"} color={ColourVars.primary} />
    <H2 fontWeight={"bold"}>
        <MulticolourText
            parts={[
                {
                    text: i18nKey(tokenState.symbol),
                    colour: "primary",
                },
                {
                    text: i18nKey(" payment gate"),
                    colour: "textPrimary",
                },
            ]} />
    </H2>
    <Body colour={"textSecondary"}>
        <Markdown text={approvalMessage} />
    </Body>

    <Column gap={"sm"}>
        {@render tokenBalance()}
        {#if insufficientFunds}
            <StatusCard
                borderColour={ColourVars.background2}
                background={ColourVars.background0}
                mode={"warning"}
                body={interpolate(
                    $_,
                    i18nKey(
                        `Top up your ${tokenState.symbol} token account. Tap the QR code button to get your receiving address.`,
                    ),
                )}
                title={interpolate($_, i18nKey("Insufficient funds"))}>
            </StatusCard>
        {/if}
        {#if gate.expiry !== undefined}
            <StatusCard
                background={ColourVars.background2}
                mode={"information"}
                title={interpolate($_, i18nKey("This is a recurring payment"))}>
                {#snippet body()}
                    <AccessGateExpiry expiry={gate.expiry} />
                {/snippet}
            </StatusCard>
        {/if}

        <Column borderRadius={"lg"} gap={"lg"} padding={"lg"} background={ColourVars.background2}>
            <Row mainAxisAlignment={"spaceBetween"}>
                <BodySmall colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("Payment amount")} />
                </BodySmall>
                <Body width={"hug"} colour={"primary"} fontWeight={"bold"}>
                    {totalAmount}
                    {tokenState.symbol}
                </Body>
            </Row>
            <Row mainAxisAlignment={"spaceBetween"}>
                <BodySmall colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("Owner receives (98%)")} />
                </BodySmall>
                <Body width={"hug"} colour={"textPrimary"} fontWeight={"bold"}>
                    {toOwner}
                    {tokenState.symbol}
                </Body>
            </Row>
            <Row mainAxisAlignment={"spaceBetween"}>
                <BodySmall colour={"textSecondary"}>
                    <Translatable resourceKey={i18nKey("OpenChat treasury receives (2%)")} />
                </BodySmall>
                <Body width={"hug"} colour={"textPrimary"} fontWeight={"bold"}>
                    {toOC}
                    {tokenState.symbol}
                </Body>
            </Row>
        </Column>
    </Column>
</Column>

{#if insufficientFunds}
    {@render refreshBalance()}
{:else}
    <Button
        width={"fill"}
        onClick={() =>
            onApprovePayment({
                ledger: token.ledger,
                amount: gate.amount,
                approvalFee: token.transferFee,
            })}>
        {#snippet icon(color)}
            <Wallet {color} />
        {/snippet}
        <Translatable resourceKey={i18nKey("Approve payment")} />
    </Button>
    <CommonButton width={"fill"} size={"small_text"} onClick={onClose}>
        <Translatable resourceKey={i18nKey("cancel")} />
    </CommonButton>
{/if}

{#snippet refreshBalance()}
    <CommonButton
        loading={refreshingBalance}
        width={"fill"}
        mode={"active"}
        size={"small_text"}
        onClick={() => tokenState.refreshBalance(client)}>
        {#snippet icon(color, size)}
            <Refresh {color} {size} />
        {/snippet}
        <Translatable resourceKey={i18nKey(`Refresh ${tokenState.symbol} balance`)} />
    </CommonButton>
{/snippet}

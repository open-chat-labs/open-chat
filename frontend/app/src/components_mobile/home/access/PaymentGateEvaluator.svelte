<script lang="ts">
    import {
        Body,
        BodySmall,
        Button,
        ColourVars,
        Column,
        CommonButton,
        H2,
        Row,
        Sheet,
        StatusCard,
    } from "component-lib";
    import {
        type Level,
        type OpenChat,
        type PaymentGate,
        type PaymentGateApprovals,
        type ResourceKey,
        enhancedCryptoLookup,
    } from "openchat-client";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import Bitcoin from "svelte-material-icons/Bitcoin.svelte";
    import Refresh from "svelte-material-icons/Refresh.svelte";
    import ShieldStar from "svelte-material-icons/ShieldStarOutline.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../../stores/pinNumber";
    import Translatable from "../../Translatable.svelte";
    import AccountInfo from "../AccountInfo.svelte";
    import Markdown from "../Markdown.svelte";
    import { TokenState } from "../wallet/walletState.svelte";
    import AccessGateExpiry from "./AccessGateExpiry.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        gate: PaymentGate & { expiry: bigint | undefined };
        level: Level;
        paymentApprovals: PaymentGateApprovals;
        onApprovePayment: (args: { ledger: string; amount: bigint; approvalFee: bigint }) => void;
        onClose: () => void;
    }

    let { gate, level, paymentApprovals, onApprovePayment, onClose }: Props = $props();

    let token = $derived($enhancedCryptoLookup.get(gate.ledgerCanister)!);
    let tokenState = $derived(new TokenState(token));
    let error: ResourceKey | undefined = $state(undefined);
    let refreshingBalance = $state(false);
    let totalAmount = $derived(tokenState.formatTokens(gate.amount));
    let toOwner = $derived(tokenState.formatTokens(BigInt(Number(gate.amount) * 0.98)));
    let toOC = $derived(tokenState.formatTokens(BigInt(Number(gate.amount) * 0.02)));

    function balanceAfterCurrentCommitments(
        ledger: string,
        approvals: PaymentGateApprovals,
        balance: bigint,
    ) {
        return balance - (approvals.get(ledger)?.amount ?? 0n);
    }

    let cryptoBalance = $derived(
        balanceAfterCurrentCommitments(token.ledger, paymentApprovals, tokenState.cryptoBalance),
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
    let errorMessage = $derived(error !== undefined ? error : $pinNumberErrorMessageStore);
</script>

<Column gap={"lg"}>
    <ShieldStar size={"4.5rem"} color={ColourVars.primary} />
    <H2 fontWeight={"bold"}>
        <Translatable resourceKey={i18nKey("Join via payment gate")} />
    </H2>
    <Body colour={"textSecondary"}>
        <Markdown text={approvalMessage} />
    </Body>
    {#if gate.expiry !== undefined}
        <StatusCard
            background={ColourVars.background2}
            mode={"warning"}
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
{#if insufficientFunds}
    <Sheet onDismiss={onClose}>
        <Column gap={"xs"} padding={"xl"}>
            <StatusCard
                background={ColourVars.background2}
                mode={"warning"}
                title={"Insufficient funds"}>
                {#snippet body()}
                    <Markdown text={approvalMessage} />
                {/snippet}
            </StatusCard>
            <AccountInfo
                background={ColourVars.background2}
                padding={"zero"}
                ledger={gate.ledgerCanister} />
            {@render refreshBalance()}
        </Column>
    </Sheet>
{/if}

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
            <Bitcoin {color} />
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

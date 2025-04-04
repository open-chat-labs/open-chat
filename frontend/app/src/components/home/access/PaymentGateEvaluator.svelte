<script lang="ts">
    import { _ } from "svelte-i18n";
    import {
        type PaymentGate,
        type OpenChat,
        type ResourceKey,
        type Level,
        type PaymentGateApprovals,
        currentUser as user,
        cryptoBalance as cryptoBalanceStore,
    } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import BalanceWithRefresh from "../BalanceWithRefresh.svelte";
    import { i18nKey, interpolate } from "../../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../../stores/pinNumber";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Button from "../../Button.svelte";
    import Translatable from "../../Translatable.svelte";
    import AccountInfo from "../AccountInfo.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Markdown from "../Markdown.svelte";
    import AlertBox from "../../AlertBox.svelte";
    import AccessGateExpiry from "./AccessGateExpiry.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let gate: PaymentGate & { expiry: bigint | undefined };
    export let level: Level;
    export let paymentApprovals: PaymentGateApprovals;

    let error: ResourceKey | undefined = undefined;
    let balanceWithRefresh: BalanceWithRefresh;
    let refreshingBalance = false;

    $: token = client.getTokenDetailsForAccessGate(gate)!;
    $: originalBalance = $cryptoBalanceStore[token.ledger] ?? BigInt(0);
    $: cryptoBalance = balanceAfterCurrentCommitments(
        token.ledger,
        paymentApprovals,
        originalBalance,
    );
    $: insufficientFunds = cryptoBalance < gate.amount;
    $: approvalMessage = interpolate(
        $_,
        i18nKey(
            "access.paymentApprovalMessage",
            {
                amount: client.formatTokens(gate.amount, token.decimals),
                token: token.symbol,
            },
            level,
            true,
        ),
    );
    $: distributionMessage = interpolate(
        $_,
        i18nKey("access.paymentDistributionMessage", undefined, level, true),
    );
    $: errorMessage = error !== undefined ? error : $pinNumberErrorMessageStore;

    function balanceAfterCurrentCommitments(
        ledger: string,
        approvals: PaymentGateApprovals,
        balance: bigint,
    ) {
        return balance - (approvals.get(ledger)?.amount ?? 0n);
    }

    function onStartRefreshingBalance() {
        refreshingBalance = true;
    }

    function onRefreshingBalanceSuccess() {
        error = insufficientFunds ? i18nKey("Insufficient funds") : undefined;
        refreshingBalance = false;
    }

    function onRefreshingBalanceFailed() {
        error = i18nKey("Failed to refresh balance");
        refreshingBalance = false;
    }

    function onClickPrimary() {
        if (insufficientFunds) {
            balanceWithRefresh.refresh();
        } else {
            dispatch("approvePayment", {
                ledger: token.ledger,
                amount: gate.amount,
                approvalFee: token.transferFee,
            });
        }
    }
</script>

<div class="header">
    <div class="title-and-icon">
        <div class="icon">🔒️</div>
        <div class="title">
            <Translatable resourceKey={i18nKey("access.approvePaymentTitle")} />
        </div>
    </div>
    <BalanceWithRefresh
        bind:this={balanceWithRefresh}
        ledger={gate.ledgerCanister}
        value={cryptoBalance}
        label={i18nKey("cryptoAccount.shortBalanceLabel")}
        bold
        on:click={onStartRefreshingBalance}
        on:refreshed={onRefreshingBalanceSuccess}
        on:error={onRefreshingBalanceFailed} />
</div>
<div>
    <p>
        <Markdown text={approvalMessage + " " + distributionMessage} />
    </p>
    {#if gate.expiry !== undefined}
        <AlertBox>
            <AccessGateExpiry expiry={gate.expiry} />
        </AlertBox>
    {/if}
    {#if errorMessage !== undefined}
        <div class="error">
            <ErrorMessage><Translatable resourceKey={errorMessage} /></ErrorMessage>
        </div>
    {/if}
    {#if insufficientFunds}
        <AccountInfo ledger={gate.ledgerCanister} user={$user} />
        <p><Translatable resourceKey={i18nKey("tokenTransfer.makeDeposit")} /></p>
    {/if}
</div>
<div>
    <ButtonGroup>
        <Button secondary onClick={() => dispatch("close")}>{$_("cancel")}</Button>
        <Button loading={refreshingBalance} onClick={onClickPrimary}
            ><Translatable
                resourceKey={i18nKey(insufficientFunds ? "Refresh" : "Approve payment")} /></Button>
    </ButtonGroup>
</div>

<style lang="scss">
    .header {
        @include font(bold, normal, fs-130, 29);
        margin-bottom: $sp4;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: $sp2;
    }

    .title-and-icon {
        display: flex;
        align-items: center;
        gap: $sp3;
    }

    .icon {
        @include font-size(fs-130);
    }

    p {
        margin-bottom: $sp4;
    }

    .error {
        margin-top: $sp4;
    }
</style>

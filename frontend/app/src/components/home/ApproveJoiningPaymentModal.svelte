<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { PaymentGate, OpenChat, MultiUserChat, CommunitySummary } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Button from "../Button.svelte";
    import { interpolateLevel } from "../../utils/i18n";
    import ButtonGroup from "../ButtonGroup.svelte";
    import BalanceWithRefresh from "./BalanceWithRefresh.svelte";
    import AccountInfo from "./AccountInfo.svelte";
    import Markdown from "./Markdown.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let group: MultiUserChat | CommunitySummary;
    export let gate: PaymentGate;

    let joining = false;
    let error: string | undefined = undefined;
    let balanceWithRefresh: BalanceWithRefresh;
    let refreshingBalance = false;

    $: user = client.user;
    $: token = client.getTokenDetailsForAccessGate(gate)!;
    $: cryptoBalanceStore = client.cryptoBalance;
    $: cryptoBalance = $cryptoBalanceStore[token.ledger] ?? BigInt(0);
    $: insufficientFunds = cryptoBalance < gate.amount;
    $: approvalMessage = interpolateLevel("access.paymentApprovalMessage", group.level, true, {
        amount: client.formatTokens(gate.amount, token.decimals),
        token: token.symbol,
    });
    $: distributionMessage = interpolateLevel(
        "access.paymentDistributionMessage",
        group.kind === "group_chat" ? "group" : "community",
        true,
    );

    function onStartRefreshingBalance() {
        refreshingBalance = true;
    }

    function onRefreshingBalanceSuccess() {
        error = insufficientFunds ? "Insufficient funds" : undefined;
        refreshingBalance = false;
    }

    function onRefreshingBalanceFailed() {
        error = "Failed to refresh balance";
        refreshingBalance = false;
    }

    function onClickPrimary() {
        if (insufficientFunds) {
            balanceWithRefresh.refresh();
        } else {
            doJoin();
        }
    }

    function doJoin() {
        joining = true;

        const promise =
            group.kind === "community" ? client.joinCommunity(group) : client.joinGroup(group);

        promise
            .then((result) => {
                switch (result) {
                    case "success":
                        error = undefined;
                        dispatch("joined");
                        break;
                    case "failure":
                        error = $_("communities.errors.joinFailed");
                        break;
                    case "gate_check_failed":
                        error = $_("access.paymentFailed");
                        break;
                    case "blocked":
                        error = $_("youreBlocked");
                        break;
                }
            })
            .catch((err) => {
                client.logError(`Failed to join ${group.level}: `, err);
                error = $_("communities.errors.joinFailed");
            })
            .finally(() => (joining = false));
    }
</script>

<ModalContent on:close>
    <div class="header" slot="header">
        <div class="title-and-icon">
            <div class="icon">🔒️</div>
            <div class="title">{$_("access.approvePaymentTitle")}</div>
        </div>
        <BalanceWithRefresh
            bind:this={balanceWithRefresh}
            ledger={gate.ledgerCanister}
            value={cryptoBalance}
            label={$_("cryptoAccount.shortBalanceLabel")}
            bold
            on:click={onStartRefreshingBalance}
            on:refreshed={onRefreshingBalanceSuccess}
            on:error={onRefreshingBalanceFailed} />
    </div>
    <div slot="body">
        <Markdown text={approvalMessage + " " + distributionMessage} />
        {#if error !== undefined}
            <ErrorMessage>{error}</ErrorMessage>
        {/if}
        {#if insufficientFunds}
            <AccountInfo ledger={gate.ledgerCanister} user={$user} />
            <p>{$_("tokenTransfer.makeDeposit")}</p>
            <a rel="noreferrer" class="how-to" href={token.howToBuyUrl} target="_blank">
                {$_("howToBuyToken", { values: { token: token.symbol } })}
            </a>
        {/if}
    </div>
    <div slot="footer">
        <ButtonGroup>
            <Button secondary on:click={() => dispatch("close")}>{$_("cancel")}</Button>
            <Button
                loading={joining || refreshingBalance}
                disabled={joining}
                on:click={onClickPrimary}
                >{insufficientFunds ? "Refresh" : $_("access.payAndJoin")}</Button>
        </ButtonGroup>
    </div>
</ModalContent>

<style lang="scss">
    .header {
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
</style>

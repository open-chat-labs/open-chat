<script lang="ts">
    import { _ } from "svelte-i18n";
    import type {
        PaymentGate,
        OpenChat,
        MultiUserChat,
        CommunitySummary,
        ResourceKey,
    } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import BalanceWithRefresh from "./BalanceWithRefresh.svelte";
    import AccountInfo from "./AccountInfo.svelte";
    import Markdown from "./Markdown.svelte";
    import { i18nKey, interpolate } from "../../i18n/i18n";
    import Translatable from "../Translatable.svelte";
    import { pinNumberErrorMessageStore } from "../../stores/pinNumber";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let group: MultiUserChat | CommunitySummary;
    export let gate: PaymentGate;

    let joining = false;
    let error: ResourceKey | undefined = undefined;
    let balanceWithRefresh: BalanceWithRefresh;
    let refreshingBalance = false;

    $: user = client.user;
    $: token = client.getTokenDetailsForAccessGate(gate)!;
    $: cryptoBalanceStore = client.cryptoBalance;
    $: cryptoBalance = $cryptoBalanceStore[token.ledger] ?? BigInt(0);
    $: insufficientFunds = cryptoBalance < gate.amount;
    $: approvalMessage = interpolate(
        $_,
        i18nKey(
            "access.paymentApprovalMessage",
            {
                amount: client.formatTokens(gate.amount, token.decimals),
                token: token.symbol,
            },
            group.level,
            true,
        ),
    );
    $: distributionMessage = interpolate(
        $_,
        i18nKey(
            "access.paymentDistributionMessage",
            undefined,
            group.kind === "group_chat" ? "group" : "community",
            true,
        ),
    );
    $: errorMessage = error !== undefined ? error : $pinNumberErrorMessageStore;

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
            doJoin();
        }
    }

    function doJoin() {
        joining = true;
        error = undefined;

        const promise =
            group.kind === "community"
                ? client.joinCommunity(group, undefined)
                : client.joinGroup(group, undefined);

        promise
            .then((result) => {
                switch (result.kind) {
                    case "success":
                        error = undefined;
                        dispatch("joined");
                        break;
                    case "failure":
                        error = i18nKey("communities.errors.joinFailed");
                        break;
                    case "gate_check_failed":
                        error = i18nKey("access.paymentFailed");
                        break;
                    case "blocked":
                        error = i18nKey("youreBlocked");
                        break;
                }
            })
            .catch((err) => {
                if (err !== "cancelled") {
                    client.logError(`Failed to join ${group.level}: `, err);
                    error = i18nKey("communities.errors.joinFailed");
                }
            })
            .finally(() => (joining = false));
    }
</script>

<ModalContent on:close>
    <div class="header" slot="header">
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
    <div slot="body">
        <Markdown text={approvalMessage + " " + distributionMessage} />
        {#if errorMessage !== undefined}
            <div class="error">
                <ErrorMessage><Translatable resourceKey={errorMessage} /></ErrorMessage>
            </div>
        {/if}
        {#if insufficientFunds}
            <AccountInfo ledger={gate.ledgerCanister} user={$user} />
            <p><Translatable resourceKey={i18nKey("tokenTransfer.makeDeposit")} /></p>
            <a rel="noreferrer" class="how-to" href={token.howToBuyUrl} target="_blank">
                <Translatable resourceKey={i18nKey("howToBuyToken", { token: token.symbol })} />
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
                ><Translatable
                    resourceKey={i18nKey(
                        insufficientFunds ? "Refresh" : "access.payAndJoin",
                    )} /></Button>
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

    .error {
        margin-top: $sp4;
    }
</style>

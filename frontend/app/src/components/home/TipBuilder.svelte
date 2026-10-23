<script lang="ts">
    import type { Message, MessageContext, OpenChat } from "@client";
    import { mobileWidth } from "@client";
    import { getContext, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { quadOut } from "svelte/easing";
    import { Tween } from "svelte/motion";
    import { fade } from "svelte/transition";
    import { i18nKey } from "../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../stores/pinNumber";
    import { toastStore } from "../../stores/toast";
    import Button from "../Button.svelte";
    import ButtonGroup from "../ButtonGroup.svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import ModalContent from "../ModalContent.svelte";
    import Overlay from "../Overlay.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import {
        TIP_INCREMENTS,
        TipForm,
        type TipIncrement,
    } from "@src/logic/tip/tipForm.svelte";
    import AccountInfo from "./AccountInfo.svelte";
    import BalanceWithRefresh from "./BalanceWithRefresh.svelte";
    import CryptoSelector from "./CryptoSelector.svelte";
    import ExternalWalletApproval from "./ExternalWalletApproval.svelte";
    import SourceWalletSelector from "./SourceWalletSelector.svelte";
    import TipButton from "./TipButton.svelte";
    import TokenInput from "./TokenInput.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        ledger: string;
        msg: Message;
        messageContext: MessageContext;
        // Who the tip goes to (see `tipRecipient`)
        recipient: string;
        onClose: () => void;
    }

    let { ledger, msg, messageContext, recipient, onClose }: Props = $props();

    const tweenOptions = {
        duration: 800,
        easing: quadOut,
    };

    // The balance is refreshed by BalanceWithRefresh, which tells the form when it has been
    const form = new TipForm(
        client,
        untrack(() => ledger),
        { refreshBalance: false },
    );
    let tokenState = $derived(form.tokenState);
    let refreshing = $state(false);
    // Why the balance couldn't be refreshed, if it couldn't
    let error: string | undefined = $state(undefined);
    let toppingUp = $state(false);
    let balanceWithRefresh: BalanceWithRefresh;
    let dollar = $state<HTMLElement | undefined>();
    const dollarTop = new Tween(-1000, tweenOptions);
    const dollarOpacity = new Tween(0, tweenOptions);
    const dollarScale = new Tween(0, tweenOptions);
    let showCustomTip = $state(false);
    let validAmount: boolean = $state(false);
    let approval: ExternalWalletApproval | undefined = $state();
    let approving = $state(false);

    onMount(() => {
        let d = document.getElementById("tip-dollar");
        if (!d) {
            d = document.createElement("div");
            d.id = "tip-dollar";
            d.className = "tip-dollar";
            const t = document.createTextNode("🤑");
            d.appendChild(t);
            document.body.appendChild(d);
        }
        dollar = d;
    });

    function amountLabel(n: TipIncrement): string {
        return `$${(n / 100).toFixed(2)}`;
    }

    function reset() {
        balanceWithRefresh?.refresh();
    }

    function cancel() {
        toppingUp = false;
        onClose();
    }

    function onBalanceRefreshed() {
        toppingUp = false;
        error = undefined;
        form.balanceChecked();
    }

    function onBalanceRefreshError(err: string) {
        toppingUp = false;
        error = err;
        form.balanceChecked();
    }

    function bounceMoneyMouthFrom(target: HTMLElement) {
        if (!dollar) return;
        const buttonRect = target.getBoundingClientRect();
        const hDiff = buttonRect.height - dollar.clientHeight;
        const wDiff = buttonRect.width - dollar.clientWidth;
        const top = buttonRect.top + hDiff / 2;
        const left = buttonRect.left + wDiff / 2;

        Promise.all([
            dollarTop.set(top, { duration: 0 }),
            dollarOpacity.set(1, { duration: 0 }),
            dollarScale.set(0, { duration: 0 }),
        ]).then(() => {
            dollarTop.target = top - 300;
            dollarOpacity.target = 0;
            dollarScale.target = 2;
            dollarOpacity.set(0);
        });
        dollar.style.left = `${left}px`;
    }

    function clickAmount(e: MouseEvent, increment: TipIncrement) {
        e.preventDefault();
        bounceMoneyMouthFrom(e.target as HTMLElement);
        form.add(increment);
    }

    function send(e: Event) {
        e.preventDefault();
        if (approval != null) {
            // The wallet has to approve us taking the tip before we take it. Nothing may be
            // awaited before this call - the wallet opens in a popup, which the browser only
            // allows while it is still handling the click
            approving = true;
            approval
                .approve()
                .then((fromAccount) => {
                    if (fromAccount !== undefined) {
                        tip(fromAccount);
                    }
                })
                .finally(() => (approving = false));
        } else {
            tip();
        }
    }

    function tip(fromAccount?: string) {
        form.tip(messageContext, msg, recipient, fromAccount).then((outcome) => {
            switch (outcome.kind) {
                case "tipped":
                case "cancelled":
                    break;
                case "pin_failed":
                    toastStore.showFailureToast(pinNumberErrorMessageStore);
                    break;
                case "failed":
                    toastStore.showFailureToast(outcome.message);
                    break;
                default:
                    outcome satisfies never;
            }
        });
        onClose();
    }

    let valid = $derived(form.valid && error === undefined);

    $effect(() => {
        if (dollar) {
            dollar.style.setProperty("top", `${dollarTop.current}px`);
            dollar.style.setProperty("opacity", `${dollarOpacity.current}`);
            dollar.style.setProperty(
                "transform",
                `scale(${dollarScale.current}) rotate(${dollarScale.current}turn)`,
            );
        }
    });
</script>

<Overlay dismissible>
    <ModalContent fill>
        {#snippet header()}
            <span class="header">
                <div class="left">
                    <div class="main-title">
                        <div><Translatable resourceKey={i18nKey("tip.title")} /></div>
                        <div>
                            <CryptoSelector bind:ledger={() => form.ledger, (l) => (form.ledger = l)} />
                        </div>
                    </div>
                </div>
                <SourceWalletSelector bind:wallet={form.sourceWallet} ledger={form.ledger} />
                <!-- The balance is the external wallet's business while one is selected, so only
                     show OpenChat's own - but keep its space so the selector does not move -->
                <div class="oc-balance" class:hidden={form.payFromWallet}>
                    <BalanceWithRefresh
                        bind:toppingUp
                        bind:this={balanceWithRefresh}
                        ledger={form.ledger}
                        value={tokenState.remainingBalance}
                        label={i18nKey("cryptoAccount.shortBalanceLabel")}
                        bold
                        showTopUp
                        bind:refreshing
                        onRefreshed={onBalanceRefreshed}
                        onError={onBalanceRefreshError} />
                </div>
            </span>
        {/snippet}
        {#snippet body()}
            <form onsubmit={send}>
                <div class="body" class:zero={form.zero || toppingUp}>
                    {#if form.zero || toppingUp}
                        <AccountInfo ledger={form.ledger} />
                        {#if form.zero}
                            <p>
                                <Translatable
                                    resourceKey={i18nKey("tokenTransfer.zeroBalance", {
                                        token: tokenState.symbol,
                                    })} />
                            </p>
                        {/if}
                        <p><Translatable resourceKey={i18nKey("tokenTransfer.makeDeposit")} /></p>
                    {:else}
                        {#if form.exchangeRate > 0}
                            <div class="amounts">
                                {#each TIP_INCREMENTS as increment}
                                    <TipButton
                                        label={i18nKey(amountLabel(increment))}
                                        onClick={(e) => clickAmount(e, increment)}
                                        disabled={!form.canAdd(increment)} />
                                {/each}
                            </div>
                            <div in:fade|local={{ duration: 300 }} class="message">
                                {#if tokenState.draftAmount > 0}
                                    <div class="summary">
                                        <div class="dollar-amount">
                                            ${(form.centAmount / 100).toFixed(2)}
                                        </div>
                                        <div class="token-amount">
                                            {form.displayDraftAmount}
                                            {tokenState.symbol}
                                        </div>
                                        <div class="fee">
                                            <Translatable
                                                resourceKey={i18nKey("tip.plusFee", {
                                                    fee: form.displayFee,
                                                    token: tokenState.symbol,
                                                })} />
                                        </div>
                                    </div>
                                {:else}
                                    <div class="summary">
                                        <Translatable resourceKey={i18nKey("tip.advice")} />
                                    </div>
                                {/if}
                            </div>
                        {/if}
                        <div class="custom-tip">
                            {#if !showCustomTip && form.exchangeRate > 0}
                                <!-- svelte-ignore a11y_click_events_have_key_events -->
                                <!-- svelte-ignore a11y_missing_attribute -->
                                <a
                                    role="button"
                                    tabindex="0"
                                    onclick={() => (showCustomTip = true)}
                                    class="options"
                                    in:fade|local={{ duration: 500 }}
                                    class:expanded={showCustomTip}>
                                    <Translatable resourceKey={i18nKey("tip.showCustom")} />
                                </a>
                            {/if}

                            {#if showCustomTip || form.exchangeRate <= 0}
                                <div in:fade|local={{ duration: 500 }} class="custom-tip-amount">
                                    <TokenInput
                                        ledger={form.ledger}
                                        transferFees={tokenState.transferFees}
                                        bind:valid={validAmount}
                                        maxAmount={form.spendingLimit}
                                        bind:amount={tokenState.draftAmount} />
                                </div>
                            {/if}
                        </div>
                        {#if error !== undefined}
                            <div class="error">
                                <ErrorMessage>{$_(error)}</ErrorMessage>
                            </div>
                        {/if}
                    {/if}
                    {#if form.sourceWallet !== undefined}
                        <div class="funding">
                            <ExternalWalletApproval
                                bind:this={approval}
                                wallet={form.sourceWallet}
                                ledger={form.ledger}
                                amount={tokenState.draftAmount}
                                chatId={messageContext.chatId} />
                        </div>
                    {/if}
                </div>
            </form>
        {/snippet}
        {#snippet footer()}
            <span>
                <ButtonGroup>
                    <Button small={!$mobileWidth} tiny={$mobileWidth} secondary onClick={cancel}
                        ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                    {#if toppingUp || form.zero}
                        <Button
                            small={!$mobileWidth}
                            disabled={refreshing}
                            loading={refreshing}
                            tiny={$mobileWidth}
                            onClick={reset}
                            ><Translatable resourceKey={i18nKey("refresh")} /></Button>
                    {:else}
                        <Button
                            small={!$mobileWidth}
                            disabled={!valid || approving}
                            loading={approving}
                            tiny={$mobileWidth}
                            onClick={send}
                            ><Translatable resourceKey={i18nKey("tokenTransfer.send")} /></Button>
                    {/if}
                </ButtonGroup>
            </span>
        {/snippet}
    </ModalContent>
</Overlay>

<style lang="scss">
    .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: $sp2;

        .left {
            flex: auto;
            display: flex;
            align-items: center;
            gap: $sp4;

            .main-title {
                flex: auto;
                display: flex;
                align-items: baseline;
                gap: 10px;
                @include font(bold, normal, fs-120);
            }
        }
    }

    .body {
        transition: background-color 100ms ease-in-out;
        @include font(book, normal, fs-100, 28);
        position: relative;

        &.zero {
            padding: 0 $sp4;
        }
    }

    .oc-balance.hidden {
        visibility: hidden;
    }

    .message {
        text-align: center;
        margin-bottom: $sp4;
    }

    .error {
        text-align: center;
    }

    .summary {
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--txt);

        .dollar-amount,
        .fee,
        .token-amount {
            padding: 0 $sp4;
        }

        .dollar-amount,
        .token-amount {
            border-right: 1px solid var(--txt-light);
        }

        .fee {
            color: var(--txt-light);
            @include font(light, normal, fs-70);
        }
    }

    .amounts {
        display: flex;
        justify-content: space-evenly;
        gap: $sp2;
        padding: $sp6 0;
    }

    .how-to {
        margin-top: $sp4;
    }

    .custom-tip {
        text-align: center;
        @include font(light, normal, fs-80);

        .custom-tip-amount {
            padding: $sp4 $sp5;
        }
    }

    .funding {
        padding: 0 $sp5;
        text-align: center;
        @include font(light, normal, fs-80);
    }
</style>

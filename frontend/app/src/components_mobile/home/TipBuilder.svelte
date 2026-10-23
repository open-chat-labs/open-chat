<script lang="ts">
    import { Body, BodySmall, Button, ColourVars, Column, Row, Sheet, StatusCard } from "component-lib";
    import type { Message, MessageContext, OpenChat } from "@client";
    import { getContext, onMount, untrack } from "svelte";
    import { quadOut } from "svelte/easing";
    import { Tween } from "svelte/motion";
    import { fade } from "svelte/transition";
    import { i18nKey } from "../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../stores/pinNumber";
    import { toastStore } from "../../stores/toast";
    import Translatable from "@shared_components/Translatable.svelte";
    import {
        TIP_INCREMENTS,
        TipForm,
        type TipIncrement,
    } from "@src/logic/tip/tipForm.svelte";
    import AccountInfo from "./AccountInfo.svelte";
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

    const form = new TipForm(
        client,
        untrack(() => ledger),
        { onRefreshFailed: (failure) => toastStore.showFailureToast(failure) },
    );
    let tokenState = $derived(form.tokenState);
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
            // allows while it is still handling the tap
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

<Sheet onDismiss={onClose}>
    <Column gap={"xl"} padding={["xl", "lg"]}>
        <CryptoSelector
            showRefresh
            hideBalance={form.payFromWallet}
            draftAmount={tokenState.draftAmount}
            fees={tokenState.transferFees}
            bind:ledger={() => form.ledger, (l) => (form.ledger = l)} />
        <SourceWalletSelector bind:wallet={form.sourceWallet} ledger={form.ledger} />
        {#if form.zero}
            <AccountInfo background={ColourVars.surface0} ledger={form.ledger} />
            {#if form.zero}
                <StatusCard
                    background={ColourVars.surface0}
                    mode={"warning"}
                    title={"Insufficient funds"}>
                    {#snippet body()}
                        <Column gap={"sm"}>
                            <Translatable
                                resourceKey={i18nKey("tokenTransfer.zeroBalance", {
                                    token: tokenState.symbol,
                                })} />
                            <Translatable resourceKey={i18nKey("tokenTransfer.makeDeposit")} />
                        </Column>
                    {/snippet}
                </StatusCard>
            {/if}
        {:else}
            {#if form.exchangeRate > 0}
                <Row overflow={"visible"} mainAxisAlignment={"spaceAround"}>
                    {#each TIP_INCREMENTS as increment}
                        <TipButton
                            label={i18nKey(amountLabel(increment))}
                            onClick={(e) => clickAmount(e, increment)}
                            disabled={!form.canAdd(increment)} />
                    {/each}
                </Row>
                {#if tokenState.draftAmount > 0}
                    <Row crossAxisAlignment={"center"} mainAxisAlignment={"center"} gap={"md"}>
                        <Body fontWeight={"bold"} width={"hug"}>
                            ${(form.centAmount / 100).toFixed(2)}
                        </Body>
                        <div class="separator"></div>
                        <Body fontWeight={"bold"} width={"hug"}>
                            {form.displayDraftAmount}
                            {tokenState.symbol}
                        </Body>
                        <div class="separator"></div>
                        <BodySmall colour={"textSecondary"} fontWeight={"bold"} width={"hug"}>
                            <Translatable
                                resourceKey={i18nKey("tip.plusFee", {
                                    fee: form.displayFee,
                                    token: tokenState.symbol,
                                })} />
                        </BodySmall>
                    </Row>
                {:else}
                    <BodySmall align={"center"} colour={"textSecondary"}>
                        <Translatable resourceKey={i18nKey("tip.advice")} />
                    </BodySmall>
                {/if}
            {/if}

            {#if !showCustomTip && form.exchangeRate > 0}
                <Row
                    mainAxisAlignment={"center"}
                    crossAxisAlignment={"center"}
                    onClick={() => (showCustomTip = true)}>
                    <Body width={"hug"} colour={"secondary"}>
                        <Translatable resourceKey={i18nKey("tip.showCustom")} />
                    </Body>
                </Row>
            {/if}

            {#if showCustomTip || form.exchangeRate <= 0}
                <div in:fade|local={{ duration: 500 }} class="custom-tip-amount">
                    <TokenInput
                        balance={form.payFromWallet ? undefined : tokenState.cryptoBalance}
                        ledger={form.ledger}
                        bind:valid={validAmount}
                        maxAmount={form.spendingLimit}
                        bind:amount={tokenState.draftAmount} />
                </div>
            {/if}
        {/if}
        {#if form.sourceWallet !== undefined}
            <ExternalWalletApproval
                bind:this={approval}
                wallet={form.sourceWallet}
                ledger={form.ledger}
                amount={tokenState.draftAmount}
                chatId={messageContext.chatId} />
        {/if}
        <Column gap={"md"}>
            <Button disabled={!form.valid || approving} loading={approving} onClick={send}
                ><Translatable resourceKey={i18nKey("tokenTransfer.send")} /></Button>
            <Button secondary onClick={onClose}
                ><Translatable resourceKey={i18nKey("cancel")} /></Button>
        </Column>
    </Column>
</Sheet>

<style lang="scss">
    .custom-tip-amount {
        width: 100%;
    }

    .separator {
        width: 2px;
        height: 100%;
        border-radius: var(--rad-circle);
        background-color: var(--text-secondary);
    }
</style>

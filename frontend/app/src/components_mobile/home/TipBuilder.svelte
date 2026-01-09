<script lang="ts">
    import {
        Body,
        BodySmall,
        Button,
        ColourVars,
        Column,
        Row,
        Sheet,
        StatusCard,
    } from "component-lib";
    import type {
        Message,
        MessageContext,
        OpenChat,
        PendingCryptocurrencyTransfer,
    } from "openchat-client";
    import {
        enhancedCryptoLookup as cryptoLookup,
        currentUserIdStore,
        exchangeRatesLookupStore as exchangeRatesLookup,
        lastCryptoSent,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import { quadOut } from "svelte/easing";
    import { Tween } from "svelte/motion";
    import { fade } from "svelte/transition";
    import { i18nKey } from "../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../stores/pinNumber";
    import { toastStore } from "../../stores/toast";
    import ErrorMessage from "../ErrorMessage.svelte";
    import Translatable from "../Translatable.svelte";
    import AccountInfo from "./AccountInfo.svelte";
    import CryptoSelector from "./CryptoSelector.svelte";
    import TipButton from "./TipButton.svelte";
    import TokenInput from "./TokenInput.svelte";
    import { TokenState } from "./wallet/walletState.svelte";

    const client = getContext<OpenChat>("client");
    const increments: Increment[] = [1, 10, 100];
    type Increment = 1 | 10 | 100;

    interface Props {
        ledger: string;
        msg: Message;
        messageContext: MessageContext;
        onClose: () => void;
    }

    let { ledger = $bindable(), msg, messageContext, onClose }: Props = $props();

    const tweenOptions = {
        duration: 800,
        easing: quadOut,
    };

    let error: string | undefined = $state(undefined);
    let toppingUp = $state(false);
    let tokenChanging = $state(true);
    let dollar = $state<HTMLElement | undefined>();
    let dollarTop = new Tween(-1000, tweenOptions);
    let dollarOpacity = new Tween(0, tweenOptions);
    let dollarScale = new Tween(0, tweenOptions);
    let centAmount = $state(0);
    let showCustomTip = $state(false);
    let validAmount: boolean = $state(false);

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

    function amountLabel(n: Increment): string {
        return `$${(n / 100).toFixed(2)}`;
    }

    function calculateCentAmount(e8s: bigint, exchangeRate: number): number {
        const tokens = Number(e8s) / Math.pow(10, tokenDetails.decimals);
        const dollar = tokens * exchangeRate;
        const cents = dollar * 100;
        return Math.round(cents);
    }

    function to2SigFigs(num: number): number {
        return parseFloat(num.toPrecision(2));
    }

    function calculateAmount(centAmount: number, exchangeRate: number): bigint {
        const e8s = ((centAmount / 100) * Math.pow(10, tokenDetails.decimals)) / exchangeRate;
        return BigInt(Math.round(e8s));
    }

    function cancel() {
        toppingUp = false;
        onClose();
    }

    function onBalanceRefreshFinished() {
        toppingUp = false;
        tokenChanging = false;
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

    function clickAmount(e: MouseEvent, increment: Increment) {
        e.preventDefault();
        bounceMoneyMouthFrom(e.target as HTMLElement);
        centAmount += increment;
        tokenState.draftAmount = calculateAmount(centAmount, exchangeRate);
    }

    function send(e: Event) {
        e.preventDefault();
        const transfer: PendingCryptocurrencyTransfer = {
            kind: "pending",
            ledger,
            token: tokenDetails.symbol,
            recipient: msg.sender,
            amountE8s: tokenState.draftAmount,
            feeE8s: tokenDetails.transferFee,
            createdAtNanos: BigInt(Date.now()) * 1_000_000n,
        };
        lastCryptoSent.set(ledger);

        const currentTip = (msg.tips[transfer.ledger] ?? {})[$currentUserIdStore] ?? 0n;

        client.tipMessage(messageContext, msg.messageId, transfer, currentTip).then((resp) => {
            if (resp.kind === "failure") {
                toastStore.showFailureToast(i18nKey("tip.failure"));
            } else if (resp.kind !== "success") {
                toastStore.showFailureToast(pinNumberErrorMessageStore);
            }
        });

        onClose();
    }
    let tokenDetails = $derived($cryptoLookup.get(ledger)!);
    let tokenState = $derived.by(() => {
        const s = new TokenState(tokenDetails);
        s.refreshBalance(client).then(onBalanceRefreshFinished);
        return s;
    });
    let exchangeRate = $derived(
        to2SigFigs($exchangeRatesLookup.get(tokenDetails.symbol.toLowerCase())?.toUSD ?? 0),
    );
    $effect(() => {
        if (ledger !== undefined) {
            // reset when ledger changes
            centAmount = 0;
            tokenChanging = true;
            tokenState.draftAmount = 0n;
        }
    });
    let displayDraftAmount = $derived(
        client.formatTokens(tokenState.draftAmount, tokenDetails.decimals),
    );
    let displayFee = $derived(client.formatTokens(tokenDetails.transferFee, tokenDetails.decimals));
    let valid = $derived(
        tokenState.draftAmount > 0n &&
            tokenState.remainingBalance >= 0n &&
            error === undefined &&
            !tokenChanging,
    );
    let zero = $derived(tokenState.cryptoBalance <= tokenDetails.transferFee && !tokenChanging);
    $effect(() => {
        centAmount = calculateCentAmount(tokenState.draftAmount, exchangeRate);
    });
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
        <CryptoSelector showRefresh draftAmount={tokenState.draftAmount} bind:ledger />
        {#if zero || toppingUp}
            <AccountInfo background={ColourVars.background0} {ledger} />
            {#if zero}
                <StatusCard
                    background={ColourVars.background0}
                    mode={"warning"}
                    title={"Insufficient funds"}>
                    {#snippet body()}
                        <Column gap={"sm"}>
                            <Translatable
                                resourceKey={i18nKey("tokenTransfer.zeroBalance", {
                                    token: tokenDetails.symbol,
                                })} />
                            <Translatable resourceKey={i18nKey("tokenTransfer.makeDeposit")} />
                        </Column>
                    {/snippet}
                </StatusCard>
            {/if}
        {:else}
            {#if exchangeRate > 0}
                <Row overflow={"visible"} mainAxisAlignment={"spaceAround"}>
                    {#each increments as increment}
                        <TipButton
                            label={i18nKey(amountLabel(increment))}
                            onClick={(e) => clickAmount(e, increment)}
                            disabled={exchangeRate === 0 ||
                                calculateAmount(centAmount + increment, exchangeRate) >
                                    tokenState.cryptoBalance - tokenDetails.transferFee} />
                    {/each}
                </Row>
                {#if tokenState.draftAmount > 0}
                    <Row crossAxisAlignment={"center"} mainAxisAlignment={"center"} gap={"md"}>
                        <Body fontWeight={"bold"} width={"hug"}>
                            ${(centAmount / 100).toFixed(2)}
                        </Body>
                        <div class="separator"></div>
                        <Body fontWeight={"bold"} width={"hug"}>
                            {displayDraftAmount}
                            {tokenDetails.symbol}
                        </Body>
                        <div class="separator"></div>
                        <BodySmall colour={"textSecondary"} fontWeight={"bold"} width={"hug"}>
                            <Translatable
                                resourceKey={i18nKey("tip.plusFee", {
                                    fee: displayFee,
                                    token: tokenDetails.symbol,
                                })} />
                        </BodySmall>
                    </Row>
                {:else}
                    <BodySmall align={"center"} colour={"textSecondary"}>
                        <Translatable resourceKey={i18nKey("tip.advice")} />
                    </BodySmall>
                {/if}
            {/if}

            {#if !showCustomTip && exchangeRate > 0}
                <Row
                    mainAxisAlignment={"center"}
                    crossAxisAlignment={"center"}
                    onClick={() => (showCustomTip = true)}>
                    <Body width={"hug"} colour={"secondary"}>
                        <Translatable resourceKey={i18nKey("tip.showCustom")} />
                    </Body>
                </Row>
            {/if}

            {#if showCustomTip || exchangeRate <= 0}
                <div in:fade|local={{ duration: 500 }} class="custom-tip-amount">
                    <TokenInput
                        {ledger}
                        bind:valid={validAmount}
                        maxAmount={tokenState.maxAmount}
                        bind:amount={tokenState.draftAmount} />
                </div>
            {/if}
            {#if error !== undefined}
                <div class="error">
                    <ErrorMessage>{$_(error)}</ErrorMessage>
                </div>
            {/if}
        {/if}
        <Column gap={"md"}>
            <Button disabled={!valid} onClick={send}
                ><Translatable resourceKey={i18nKey("tokenTransfer.send")} /></Button>
            <Button secondary onClick={cancel}
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

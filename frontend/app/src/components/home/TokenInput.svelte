<script lang="ts">
    import {
        cryptoLookup,
        exchangeRatesLookupStore as exchangeRatesLookup,
        type OpenChat,
    } from "openchat-client";
    import { getContext, onMount, untrack } from "svelte";
    import Alert from "svelte-material-icons/Alert.svelte";
    import { i18nKey } from "../../i18n/i18n";
    import { calculateDollarAmount } from "../../utils/exchange";
    import Legend from "../Legend.svelte";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        amount?: bigint;
        autofocus?: boolean;
        minAmount?: bigint;
        maxAmount?: bigint | undefined;
        ledger: string;
        valid?: boolean;
        status?: "ok" | "zero" | "too_low" | "too_high";
        label?: string;
        transferFees?: bigint | undefined;
        showDollarAmount?: boolean;
    }

    let {
        amount = $bindable(BigInt(0)),
        autofocus = false,
        minAmount = BigInt(0),
        maxAmount = undefined,
        ledger,
        valid = $bindable(false),
        status = $bindable("zero"),
        label = "tokenTransfer.amount",
        transferFees = undefined,
        showDollarAmount = false,
    }: Props = $props();

    valid;

    let inputElement: HTMLInputElement | undefined = $state();

    onMount(() => {
        if (amount > BigInt(0) && inputElement) {
            inputElement.value = client.formatTokens(amount, tokenDecimals, ".", true);
        }
    });

    function onKeyup() {
        trimDecimals();
        const value = inputElement?.value ?? "";
        const inputAmount = Math.round(Number(value) * Math.pow(10, tokenDecimals));
        if (!isNaN(inputAmount)) {
            const [integral, fractional] = value.split(".");
            let units = BigInt(integral) * BigInt(10) ** BigInt(tokenDecimals);

            if (fractional !== undefined) {
                units += BigInt(fractional.padEnd(tokenDecimals, "0"));
            }

            amount = units;
        }
    }

    function max() {
        if (maxAmount !== undefined) {
            amount = maxAmount;
        }
        validate();
    }

    function validate() {
        untrack(() => {
            if (amount === BigInt(0)) {
                status = "zero";
            } else if (amount < minAmount) {
                status = "too_low";
            } else if (maxAmount !== undefined && amount > maxAmount) {
                status = "too_high";
            } else {
                status = "ok";
            }
            valid = status === "ok";
        });
    }

    function trimDecimals() {
        const value = inputElement?.value ?? "";
        const fractional = value.split(".")[1];
        if (fractional !== undefined) {
            const toTrim = fractional.length - tokenDecimals;
            if (toTrim > 0 && inputElement) {
                inputElement.value = value.substring(0, value.length - toTrim);
            }
        }
    }
    let tokenDetails = $derived($cryptoLookup[ledger]);
    let symbol = $derived(tokenDetails?.symbol);
    let tokenDecimals = $derived(tokenDetails?.decimals ?? 0);
    let amountInUsd = $derived(
        tokenDetails !== undefined && showDollarAmount
            ? calculateDollarAmount(
                  amount,
                  $exchangeRatesLookup[tokenDetails.symbol.toLowerCase()]?.toUSD,
                  tokenDetails.decimals,
              )
            : "???",
    );
    let minAmountFormatted = $derived(`${client.formatTokens(minAmount, tokenDecimals)} ${symbol}`);
    $effect(() => {
        // TODO - worry about this
        if (inputElement !== undefined) {
            trimDecimals();
            const validateResult = client.validateTokenInput(inputElement.value, tokenDecimals);
            if (validateResult.amount !== amount) {
                inputElement.value = client.formatTokens(amount, tokenDecimals, ".", true);
            }
            validate();
        }
    });
    $effect(() => {
        // Re-validate whenever minAmount or maxAmount changes
        if (minAmount || maxAmount) {
            validate();
        }
    });
</script>

<div class="label">
    <Legend label={i18nKey(label)} rules={i18nKey(symbol)} />
    {#if maxAmount !== undefined}
        <div onclick={max} class="max">
            <Translatable resourceKey={i18nKey("tokenTransfer.max")} />
        </div>
    {/if}
    {#if showDollarAmount && amount > 0}
        <div class="usd">({amountInUsd} USD)</div>
    {:else if minAmount > BigInt(0)}
        <div class="min">
            <Translatable
                resourceKey={i18nKey("tokenTransfer.min", { amount: minAmountFormatted })} />
        </div>
    {/if}
</div>
<div class="wrapper">
    {#if transferFees !== undefined && transferFees > 0n}
        <div class="fee">
            <Alert size={$iconSize} color={"var(--warn)"} />
            <span>
                <Translatable
                    resourceKey={i18nKey("tokenTransfer.fee", {
                        fee: client.formatTokens(transferFees, tokenDecimals),
                        token: symbol,
                    })} />
            </span>
        </div>
    {/if}
    <input
        {autofocus}
        class="amount-val"
        min={Number(minAmount) / Math.pow(10, tokenDecimals)}
        max={maxAmount !== undefined ? Number(maxAmount) / Math.pow(10, tokenDecimals) : undefined}
        type="number"
        step="0.00000001"
        bind:this={inputElement}
        onkeyup={onKeyup}
        placeholder="0" />
</div>

<style lang="scss">
    .wrapper {
        position: relative;
    }

    .label {
        display: flex;
        align-items: center;
        gap: $sp3;

        .max {
            transition: background ease-in-out 200ms;
            background: var(--button-bg);
            color: var(--button-txt);
            padding: 0 $sp3;
            border-radius: var(--rd);
            cursor: pointer;
            border: none;
            @include font(book, normal, fs-50, 20);

            @media (hover: hover) {
                &:hover {
                    background: var(--button-hv);
                }
            }
        }

        .usd,
        .min {
            @include font(light, normal, fs-60);
            color: var(--txt-light);
            flex: 1;
            text-align: right;
        }
    }

    .amount-val {
        width: 100%;
        display: block;
        text-align: start;

        @include input();

        &::placeholder {
            color: var(--placeholder);
        }
    }

    .fee {
        position: absolute;
        right: $sp3;
        top: 12px;
        display: flex;
        gap: $sp3;
        align-items: center;
        @include font(book, normal, fs-60);
    }

    /* Chrome, Safari, Edge, Opera */
    input::-webkit-outer-spin-button,
    input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    /* Firefox */
    input[type="number"] {
        -moz-appearance: textfield;
    }
</style>

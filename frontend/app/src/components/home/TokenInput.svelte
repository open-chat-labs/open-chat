<script lang="ts">
    import { getContext, onMount } from "svelte";
    import { cryptoLookup, E8S_PER_TOKEN, OpenChat } from "openchat-client";
    import Alert from "svelte-material-icons/Alert.svelte";
    import { iconSize } from "stores/iconSize";
    import { _ } from "svelte-i18n";
    import Legend from "../Legend.svelte";

    const client = getContext<OpenChat>("client");

    export let amountE8s: bigint = BigInt(0);
    export let autofocus: boolean = false;
    export let maxAmountE8s: bigint;
    export let token: string;
    export let valid: boolean = false;

    let inputElement: HTMLInputElement;

    $: transferFees = cryptoLookup[token].transferFeesE8s;

    onMount(() => {
        if (amountE8s > BigInt(0)) {
            inputElement.value = client.formatTokens(amountE8s, 0, ".");
        }
    });

    $: {
        if (inputElement !== undefined) {
            const e8s = client.validateTokenInput(inputElement.value).e8s;
            if (e8s !== amountE8s) {
                inputElement.value = client.formatTokens(amountE8s, 0, ".");
            }
        }
    }

    function onKeyup() {
        const e8s = Math.round(Number(inputElement.value) * E8S_PER_TOKEN);
        if (isNaN(e8s) || e8s <= 0 || e8s > maxAmountE8s) {
            valid = false;
        } else {
            valid = true;
        }
        if (!isNaN(e8s)) {
            amountE8s = BigInt(e8s);
        }
    }

    function max() {
        amountE8s = maxAmountE8s;
        valid = true;
        inputElement.value = client.formatTokens(maxAmountE8s, 0, ".");
    }
</script>

<div class="label">
    <Legend label={$_("tokenTransfer.amount")} rules={token} />
    <div on:click={max} class="max">{$_("tokenTransfer.max")}</div>
</div>
<div class="wrapper">
    <div class="fee">
        <Alert size={$iconSize} color={"var(--warn)"} />
        <span>
            {$_("tokenTransfer.fee", {
                values: {
                    fee: client.formatTokens(transferFees, 0),
                    token,
                },
            })}
        </span>
    </div>
    <input
        {autofocus}
        class="amount-val"
        min={0}
        max={Number(maxAmountE8s) / E8S_PER_TOKEN}
        type="number"
        step="0.00000001"
        bind:this={inputElement}
        on:keyup={onKeyup}
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
            border-radius: $sp2;
            cursor: pointer;
            border: none;
            @include font(book, normal, fs-50, 20);

            &:hover {
                background: var(--button-hv);
            }
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

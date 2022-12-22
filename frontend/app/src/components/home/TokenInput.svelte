<script lang="ts">
    import { getContext, onMount } from "svelte";
    import { Cryptocurrency, cryptoLookup, E8S_PER_TOKEN, OpenChat } from "openchat-client";
    import Alert from "svelte-material-icons/Alert.svelte";
    import { iconSize } from "stores/iconSize";
    import { _ } from "svelte-i18n";

    const client = getContext<OpenChat>("client");

    export let amountE8s: bigint = BigInt(0);
    export let autofocus: boolean = false;
    export let maxAmountE8s: bigint;
    export let token: Cryptocurrency;

    let inputElement: HTMLInputElement;

    $: symbol = cryptoLookup[token].symbol;
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

    function onInput(ev: Event) {
        const inputValue = (ev.target as HTMLInputElement).value;

        let { replacementText, e8s } = client.validateTokenInput(inputValue);

        if (e8s > maxAmountE8s) {
            e8s = maxAmountE8s;
            inputElement.value = client.formatTokens(maxAmountE8s, 0, ".");
        } else if (replacementText !== undefined) {
            inputElement.value = replacementText;
        }

        amountE8s = e8s;
    }
</script>

<div class="wrapper">
    <div class="fee">
        <Alert size={$iconSize} color={"var(--warn)"} />
        <span>
            {$_("tokenTransfer.fee", {
                values: {
                    fee: client.formatTokens(transferFees, 0),
                    token: symbol,
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
        bind:this={inputElement}
        placeholder="0"
        on:input={onInput} />
</div>

<style type="text/scss">
    .wrapper {
        position: relative;
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

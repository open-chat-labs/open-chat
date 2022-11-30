<script lang="ts">
    import { getContext, onMount } from "svelte";
    import { E8S_PER_TOKEN, OpenChat } from "openchat-client";

    const client = getContext<OpenChat>("client");

    export let amountE8s: bigint = BigInt(0);
    export let autofocus: boolean = false;
    export let maxAmountE8s: bigint;

    let inputElement: HTMLInputElement;

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

<input
    {autofocus}
    class="amount-val"
    min={0}
    max={Number(maxAmountE8s) / E8S_PER_TOKEN}
    type="number"
    bind:this={inputElement}
    placeholder="0"
    on:input={onInput} />

<style type="text/scss">
    .amount-val {
        height: 40px;
        @include font(book, normal, fs-140);
        color: var(--txt);
        background-color: var(--input-bg);
        border: 1px solid var(--bd);
        line-height: 24px;
        width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        border-radius: $sp2;
        text-align: right;
        display: block;
        outline: none;
        padding: 0 $sp3;
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

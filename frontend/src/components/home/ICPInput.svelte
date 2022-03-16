<script lang="ts">
    import { formatICPs, validateICPInput } from "../../utils/cryptoFormatter";
    import { E8S_PER_ICP } from "../../domain/user/user";
    import { onMount } from "svelte";

    export let amountE8s: bigint = BigInt(0);
    export let autofocus: boolean = false;
    export let maxAmountE8s: bigint;

    let inputElement: HTMLInputElement;

    onMount(() => inputElement.value = formatICPs(amountE8s, 0));

    $: {
        if (inputElement !== undefined) {
            inputElement.value = formatICPs(amountE8s, 0);
        }
    }

    function onInput(ev: Event) {
        const inputValue = (ev.target as HTMLInputElement).value;

        let { text, e8s } = validateICPInput(inputValue);

        if (e8s > maxAmountE8s) {
            e8s = maxAmountE8s;
            text = formatICPs(amountE8s, 0);
        } else if (e8s < BigInt(0)) {
            e8s = BigInt(0);
            text = "0";
        } else {
            e8s = e8s;
            text = text;
        }

        amountE8s = e8s;
        inputElement.value = text;
    }
</script>

<input
    {autofocus}
    class="amount-val"
    min={0}
    max={Number(maxAmountE8s) / E8S_PER_ICP}
    type="number"
    bind:this={inputElement}
    on:input={onInput} />

<style type="text/scss">
    .amount-val {
        height: 40px;
        @include font(book, normal, fs-140);
        color: var(--input-txt);
        background-color: var(--input-bg);
        border: 1px solid var(--input-bd);
        line-height: 24px;
        width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        border-radius: $sp2;
        text-align: right;
        display: block;
        outline: none;
    }
</style>

<script lang="ts">
    import { onMount } from "svelte";
    let inp: HTMLTextAreaElement;
    export let disabled: boolean = false;
    export let invalid: boolean = false;
    export let value: string = "";
    export let autofocus: boolean = false;
    export let placeholder: string = "";
    export let minlength: number = 0;
    export let maxlength: number = Number.MAX_VALUE;
    export let rows: number = 4;

    onMount(() => {
        if (autofocus) {
            inp.focus();
        }
    });

    $: remaining = typeof value === "string" ? maxlength - value.length : 0;
</script>

<div class="outer-wrapper">
    <div class="input-wrapper">
        <textarea
            {rows}
            class:invalid
            spellcheck="false"
            {disabled}
            {minlength}
            {maxlength}
            {placeholder}
            bind:value
            class={"textbox"} />
        {#if maxlength < Number.MAX_VALUE}
            <div class:near-max={remaining <= 5} class="countdown">{remaining}</div>
        {/if}
    </div>
    <slot />
</div>

<style type="text/scss">
    .outer-wrapper {
        margin-bottom: $sp3;
        @include mobile() {
            margin-bottom: $sp3;
        }
    }

    .input-wrapper {
        position: relative;
    }

    .countdown {
        position: absolute;
        right: 10px;
        bottom: 11px;
        @include font(light, normal, fs-80);

        &.near-max {
            color: darkred;
        }
    }

    .textbox {
        transition: border ease-in-out 300ms;
        display: block;
        width: 100%;
        padding: $sp4;
        @include font(book, normal, fs-100);
        color: var(--txt);
        background-color: var(--input-bg);
        border: 1px solid var(--bd);
        outline: none;
        border-radius: $sp2;
        resize: vertical;
        box-shadow: var(--input-sh);

        &.invalid {
            border: 1px solid var(--error);
            box-shadow: 0 0 5px 1px var(--error);
        }

        &::placeholder {
            color: var(--placeholder);
        }
    }
</style>

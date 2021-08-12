<script lang="ts">
    import { onMount } from "svelte";
    let inp: HTMLInputElement;
    export let disabled: boolean = false;
    export let invalid: boolean = false;
    export let value: string | number = "";
    export let autofocus: boolean = false;
    export let placeholder: string = "";
    export let type: "text" | "number" = "text";
    export let minlength: number = 0;
    export let maxlength: number = Number.MAX_VALUE;
    export let fontSize: "small" | "normal" | "large" | "huge" = "normal";
    export let align: "left" | "right" | "center" = "left";

    onMount(() => {
        if (autofocus) {
            inp.focus();
        }
    });
    const handleInput = (e: { currentTarget: { value: string } }) => {
        if (type === "text") {
            value = e.currentTarget.value;
        }
        if (type === "number") {
            value = parseInt(e.currentTarget.value, 10);
        }
    };

    $: remaining = typeof value === "string" ? maxlength - value.length : 0;
</script>

<div class="input-wrapper">
    <input
        class:invalid
        spellcheck="false"
        {disabled}
        {type}
        {minlength}
        {maxlength}
        {placeholder}
        on:input={handleInput}
        bind:this={inp}
        {value}
        class={`textbox ${fontSize} ${align}`} />
    {#if maxlength < Number.MAX_VALUE && type === "text" && typeof value === "string"}
        <div class:near-max={remaining <= 5} class="countdown">{remaining}</div>
    {/if}
</div>

<style type="text/scss">
    .input-wrapper {
        position: relative;
    }

    .countdown {
        position: absolute;
        right: 10px;
        top: 11px;
        @include font(light, normal, fs-80);

        &.near-max {
            color: darkred;
        }
    }

    .textbox {
        transition: border ease-in-out 300ms;
        display: block;
        width: 100%;
        height: 40px;
        line-height: 24px;
        padding: $sp4 $sp5;
        @include font(book, normal, fs-100);
        color: var(--input-txt);
        background-color: var(--input-bg);
        border: 1px solid var(--input-bd);
        outline: none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        border-radius: $sp2;

        margin-bottom: $sp4;

        &.small {
            @include font(book, normal, fs-80);
        }

        &.large {
            @include font(book, normal, fs-160);
        }

        &.huge {
            @include font(book, normal, fs-220);
        }

        &.left {
            text-align: left;
        }

        &.right {
            text-align: right;
        }

        &.center {
            text-align: center;
        }

        &.invalid {
            border: 1px solid var(--error);
            box-shadow: 0 0 5px 1px var(--error);
        }
    }
</style>

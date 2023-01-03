<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { onMount } from "svelte";

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
    export let countdown: boolean = false;

    const dispatch = createEventDispatcher();

    let inp: HTMLInputElement;

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
        dispatch("change", value);
    };

    export function setValue(text: string) {
        value = text;
    }

    function keyDown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            dispatch("enter");
        }
    }

    $: remaining = typeof value === "string" ? maxlength - value.length : 0;
</script>

<div class="input-wrapper">
    <input
        class:invalid
        class:hasCountdown={countdown}
        spellcheck="false"
        {disabled}
        {type}
        {minlength}
        {maxlength}
        {placeholder}
        on:input={handleInput}
        on:keydown={keyDown}
        bind:this={inp}
        {value}
        class={`textbox ${fontSize} ${align}`} />
    {#if countdown && maxlength < Number.MAX_VALUE && type === "text" && typeof value === "string"}
        <div class:near-max={remaining <= 5} class="countdown">{remaining}</div>
    {/if}
    <slot />
</div>

<style type="text/scss">
    .input-wrapper {
        position: relative;
        margin-bottom: $sp3;

        @include mobile() {
            margin-bottom: $sp3;
        }
    }

    .countdown {
        position: absolute;
        right: 10px;
        top: 11px;
        @include font(light, normal, fs-80);
        color: var(--txt-light);

        &.near-max {
            color: var(--warn);
        }
    }

    .textbox {
        transition: border ease-in-out 300ms;
        display: block;
        width: 100%;

        @include input();

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

        &::placeholder {
            color: var(--placeholder);
        }

        &.hasCountdown {
            padding-right: 40px;
        }
    }
</style>

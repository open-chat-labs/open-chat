<script lang="ts">
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, onMount, tick } from "svelte";
    import { translatable } from "../actions/translatable";
    import { interpolate } from "../i18n/i18n";
    import type { ResourceKey } from "openchat-client";

    export let disabled: boolean = false;
    export let invalid: boolean = false;
    export let value: string | number = "";
    export let autofocus: boolean = false;
    export let placeholder: ResourceKey | undefined = undefined;
    export let type: "text" | "number" | "password" = "text";
    export let minlength: number = 0;
    export let maxlength: number = 10000;
    export let fontSize: "small" | "normal" | "large" | "huge" = "normal";
    export let align: "left" | "right" | "center" = "left";
    export let countdown: boolean = false;
    export let pattern: string | undefined = undefined;

    const dispatch = createEventDispatcher();

    let inp: HTMLInputElement;

    onMount(() => {
        if (autofocus) {
            tick().then(() => inp.focus());
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
    $: warn = remaining <= 5;
</script>

<div class="input-wrapper">
    <input
        data-gram="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        data-lpignore="true"
        class:invalid
        class:hasCountdown={countdown}
        spellcheck="false"
        {disabled}
        {type}
        {minlength}
        {maxlength}
        placeholder={placeholder !== undefined ? interpolate($_, placeholder) : ""}
        use:translatable={{ key: placeholder, position: "absolute", right: 30, top: 12 }}
        on:input={handleInput}
        on:keydown={keyDown}
        on:blur
        bind:this={inp}
        {pattern}
        {value}
        class={`textbox ${fontSize} ${align}`} />

    {#if !disabled && countdown && maxlength < Number.MAX_VALUE && type === "text" && typeof value === "string"}
        <div class:warn class="countdown">{remaining}</div>
    {/if}

    <slot />
</div>

<style lang="scss">
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

        &.warn {
            color: var(--menu-warn);
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
            border: var(--bw) solid var(--error);
        }

        &::placeholder {
            color: var(--placeholder);
        }

        &.hasCountdown {
            padding-right: 40px;
        }
    }
</style>

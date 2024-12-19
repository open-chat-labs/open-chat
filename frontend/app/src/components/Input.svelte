<script module lang="ts">
    export interface InputProps {
        disabled?: boolean;
        invalid?: boolean;
        value?: string | number;
        autofocus?: boolean;
        placeholder?: ResourceKey | undefined;
        type?: "text" | "number" | "password";
        minlength?: number;
        maxlength?: number;
        fontSize?: "small" | "normal" | "large" | "huge";
        align?: "left" | "right" | "center";
        countdown?: boolean;
        pattern?: string | undefined;
        children?: Snippet;
        onblur?: () => void;
        onfocus?: () => void;
        oninput?: () => void;
        onenter?: () => void;
    }
</script>

<script lang="ts">
    import { _ } from "svelte-i18n";
    import { createEventDispatcher, onMount, tick, type Snippet } from "svelte";
    import { translatable } from "../actions/translatable";
    import { interpolate } from "../i18n/i18n";
    import type { ResourceKey } from "openchat-client";

    let {
        disabled = false,
        invalid = false,
        value = $bindable(""),
        autofocus = false,
        placeholder = undefined,
        type = "text",
        minlength = 0,
        maxlength = 10000,
        fontSize = "normal",
        align = "left",
        countdown = false,
        pattern = undefined,
        onblur = undefined,
        onfocus = undefined,
        oninput = undefined,
        onenter = undefined,
        children,
    }: InputProps = $props();

    const dispatch = createEventDispatcher();

    let inp: HTMLInputElement | undefined = $state();

    onMount(() => {
        if (autofocus) {
            tick().then(() => inp?.focus());
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
        oninput?.();
    };

    export function setValue(text: string) {
        value = text;
    }

    function keyDown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            dispatch("enter");
            onenter?.();
        }
    }

    let remaining = $derived(typeof value === "string" ? maxlength - value.length : 0);
    let warn = $derived(remaining <= 5);
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
        oninput={handleInput}
        onkeydown={keyDown}
        {onblur}
        {onfocus}
        bind:this={inp}
        {pattern}
        {value}
        class={`textbox ${fontSize} ${align}`} />

    {#if !disabled && countdown && maxlength < Number.MAX_VALUE && type === "text" && typeof value === "string"}
        <div class:warn class="countdown">{remaining}</div>
    {/if}

    {@render children?.()}
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

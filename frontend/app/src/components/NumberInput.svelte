<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { ResourceKey } from "openchat-client";
    import { createEventDispatcher } from "svelte";
    import { onMount } from "svelte";
    import { interpolate } from "../i18n/i18n";

    export let disabled: boolean = false;
    export let autofocus: boolean = false;
    export let placeholder: ResourceKey | undefined = undefined;
    export let min: number = 0;
    export let max: number = Number.MAX_VALUE;
    export let defaultValue = Math.round(max - min / 2);
    export let value: number | null = min;
    export let align: "left" | "right" | "center" = "left";
    export let shouldClamp = true;

    const dispatch = createEventDispatcher();

    let inp: HTMLInputElement;

    onMount(() => {
        if (autofocus) {
            inp.focus();
        }
    });

    function clamp(val: number): number {
        if (isNaN(val)) return defaultValue;
        if (val > max) return max;
        if (val < min) return min;
        return val;
    }

    function handleInput(e: { currentTarget: { value: string } }) {
        if (shouldClamp) {
            value = clamp(parseInt(e.currentTarget.value, 10));
            inp.value = value.toString();
        }
        dispatch("change", inp.value);
    }

    function keyDown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            dispatch("enter");
        }
    }
</script>

<div class="input-wrapper">
    <input
        data-gram="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        spellcheck="false"
        {disabled}
        type="number"
        {min}
        {max}
        placeholder={placeholder !== undefined ? interpolate($_, placeholder) : ""}
        on:keydown={keyDown}
        on:input={handleInput}
        on:blur
        bind:this={inp}
        bind:value
        class={`textbox ${align}`} />
</div>

<style lang="scss">
    .input-wrapper {
        position: relative;
        margin-bottom: $sp3;

        @include mobile() {
            margin-bottom: $sp3;
        }
    }

    input[type="number"] {
        -moz-appearance: textfield;
        appearance: textfield;
        margin: 0;
    }

    input[type="number"]::-webkit-inner-spin-button,
    input[type="number"]::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    .textbox {
        transition: border ease-in-out 300ms;
        display: block;
        width: 100%;

        @include input();

        &.left {
            text-align: left;
        }

        &.right {
            text-align: right;
        }

        &.center {
            text-align: center;
        }

        &::placeholder {
            color: var(--placeholder);
        }
    }
</style>

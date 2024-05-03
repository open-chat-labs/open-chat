<script lang="ts">
    import { onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import { interpolate } from "../i18n/i18n";
    import { translatable } from "../actions/translatable";
    import type { ResourceKey } from "openchat-client";

    let inp: HTMLTextAreaElement;
    export let disabled: boolean = false;
    export let invalid: boolean = false;
    export let value: string = "";
    export let autofocus: boolean = false;
    export let placeholder: ResourceKey | undefined = undefined;
    export let minlength: number = 0;
    export let maxlength: number = Number.MAX_VALUE;
    export let rows: number = 4;
    export let margin: boolean = true;
    export let scroll: boolean = false;
    export let outerHeight: number = 0;
    export let innerHeight: number = 0;

    onMount(() => {
        if (autofocus) {
            inp.focus();
        }
    });

    $: remaining = typeof value === "string" ? maxlength - value.length : 0;
    $: warn = remaining <= 5;
</script>

<div class="outer-wrapper" class:margin bind:clientHeight={outerHeight}>
    <div class="input-wrapper" bind:clientHeight={innerHeight}>
        <textarea
            data-gram="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            bind:this={inp}
            {rows}
            class:invalid
            spellcheck="false"
            {disabled}
            {minlength}
            {maxlength}
            placeholder={placeholder !== undefined ? interpolate($_, placeholder) : ""}
            use:translatable={{ key: placeholder, position: "absolute", right: 12, top: 12 }}
            bind:value
            class="textbox"
            class:scroll />
    </div>
    {#if !disabled && maxlength < Number.MAX_VALUE}
        <div class:warn class="countdown">{value.length}/{maxlength}</div>
    {/if}
    <slot />
</div>

<style lang="scss">
    .outer-wrapper {
        margin: 0;

        &.margin {
            margin-bottom: $sp3;
        }
    }

    .input-wrapper {
        position: relative;
    }

    .countdown {
        text-align: end;
        @include font(light, normal, fs-80);
        color: var(--txt-light);

        &.warn {
            color: var(--warn);
        }
    }

    .textbox {
        transition: border ease-in-out 300ms;
        display: block;
        width: 100%;
        resize: vertical;
        margin-bottom: $sp2;

        @include input(normal);

        &.scroll {
            resize: none;
            @include nice-scrollbar();
        }

        &.invalid {
            border: 1px solid var(--error);
            box-shadow: 0 0 5px 1px var(--error);
        }

        &::placeholder {
            color: var(--placeholder);
        }
    }
</style>

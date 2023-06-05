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
    $: warn = remaining <= 5;
</script>

<div class="outer-wrapper">
    <div class="input-wrapper">
        <textarea
            bind:this={inp}
            {rows}
            class:invalid
            spellcheck="false"
            {disabled}
            {minlength}
            {maxlength}
            {placeholder}
            bind:value
            class={"textbox"} />
    </div>
    {#if maxlength < Number.MAX_VALUE}
        <div class:warn class="countdown">{value.length}/{maxlength}</div>
    {/if}
    <slot />
</div>

<style lang="scss">
    .outer-wrapper {
        margin-bottom: $sp3;
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

        &.invalid {
            border: 1px solid var(--error);
            box-shadow: 0 0 5px 1px var(--error);
        }

        &::placeholder {
            color: var(--placeholder);
        }
    }
</style>

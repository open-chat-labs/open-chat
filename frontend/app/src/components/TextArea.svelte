<script lang="ts">
    import { onMount, type Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import { interpolate } from "../i18n/i18n";
    import { translatable } from "../actions/translatable";
    import type { ResourceKey } from "openchat-client";

    let inp: HTMLTextAreaElement;

    interface Props {
        disabled?: boolean;
        invalid?: boolean;
        value?: string;
        autofocus?: boolean;
        placeholder?: ResourceKey | undefined;
        minlength?: number;
        maxlength?: number;
        rows?: number;
        margin?: boolean;
        scroll?: boolean;
        outerHeight?: number;
        innerHeight?: number;
        children?: Snippet;
        onchange?: () => void;
    }

    let {
        disabled = false,
        invalid = false,
        value = $bindable(""),
        autofocus = false,
        placeholder = undefined,
        minlength = 0,
        maxlength = Number.MAX_VALUE,
        rows = 4,
        margin = true,
        scroll = false,
        outerHeight = $bindable(0),
        innerHeight = $bindable(0),
        children,
        onchange,
    }: Props = $props();

    outerHeight;
    innerHeight;

    onMount(() => {
        if (autofocus) {
            inp.focus();
        }
    });

    let remaining = $derived(typeof value === "string" ? maxlength - value.length : 0);
    let warn = $derived(remaining <= 5);
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
            oninput={onchange}
            class="textbox"
            class:scroll></textarea>
    </div>
    {#if !disabled && maxlength < Number.MAX_VALUE}
        <div class:warn class="countdown">{value.length}/{maxlength}</div>
    {/if}
    {@render children?.()}
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

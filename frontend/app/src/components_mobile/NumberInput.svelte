<script lang="ts">
    import { Caption, ColourVars, Container } from "component-lib";
    import type { ResourceKey } from "openchat-client";
    import { onMount, type Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import { interpolate } from "../i18n/i18n";

    interface Props {
        disabled?: boolean;
        autofocus?: boolean;
        placeholder?: ResourceKey | undefined;
        min?: number;
        max?: number;
        defaultValue?: any;
        value?: number | null;
        align?: "left" | "right" | "center";
        shouldClamp?: boolean;
        onChange?: () => void;
        onEnter?: () => void;
        subtext?: Snippet;
        error?: boolean;
    }

    let {
        disabled = false,
        autofocus = false,
        placeholder = undefined,
        min = 0,
        max = Number.MAX_VALUE,
        defaultValue = Math.round(max - min / 2),
        value = $bindable(min),
        align = "left",
        shouldClamp = true,
        onChange,
        onEnter,
        subtext,
        error,
    }: Props = $props();

    let inp: HTMLInputElement | undefined = $state();

    onMount(() => {
        if (autofocus) {
            inp?.focus();
        }
    });

    function clamp(val: number): number {
        if (isNaN(val)) return defaultValue;
        if (val > max) return max;
        if (val < min) return min;
        return val;
    }

    function handleInput(e: { currentTarget: { value: string } }) {
        if (inp) {
            if (shouldClamp) {
                value = clamp(parseInt(e.currentTarget.value, 10));
                if (value != null) {
                    inp.value = value.toString();
                }
            }
            onChange?.();
        }
    }

    function keyDown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            onEnter?.();
        }
    }
</script>

<Container direction={"vertical"} gap={"xs"}>
    <Container
        background={ColourVars.textTertiary}
        height={{ size: "3rem" }}
        padding={["xs", "xl"]}
        borderRadius={"circle"}
        gap={"sm"}
        crossAxisAlignment={"center"}>
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
            onkeydown={keyDown}
            oninput={handleInput}
            bind:this={inp}
            bind:value
            class={`textbox ${align}`} />
    </Container>
    {#if subtext}
        <div class="subtext">
            <Caption colour={error ? "error" : "textSecondary"}>
                {@render subtext()}
            </Caption>
        </div>
    {/if}
</Container>

<style lang="scss">
    .subtext {
        padding-inline-start: var(--sp-xl);
        padding-inline-end: var(--sp-xl);
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
        padding: 0;

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

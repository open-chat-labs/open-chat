<script lang="ts">
    import type { ResourceKey } from "openchat-client";
    import { rtlStore } from "../stores/rtl";
    import Translatable from "./Translatable.svelte";
    import type { Snippet } from "svelte";

    interface Props {
        checked?: boolean;
        disabled?: boolean;
        waiting?: boolean;
        id: string;
        label: ResourceKey | undefined;
        toggle?: boolean;
        small?: boolean; // only applies to toggles
        align?: "center" | "start";
        children?: Snippet;
        onChange?: () => void;
    }

    let {
        checked = $bindable(false),
        disabled = false,
        waiting = false,
        id,
        label,
        toggle = false,
        small = false,
        align = "center",
        children,
        onChange,
    }: Props = $props();
</script>

<div
    class="checkbox"
    class:toggle
    class:waiting
    class:disabled
    class:rtl={$rtlStore}
    class:align-start={align === "start"}>
    <input {id} type="checkbox" bind:checked {disabled} onchange={onChange} />
    <label class:small for={id}>
        {#if children}{@render children()}{:else if label !== undefined}
            <Translatable resourceKey={label} />
        {/if}
    </label>
</div>

<style lang="scss">
    $size: 32px;
    $size-small: 21px;

    :root {
        --color: var(--input-accent);
    }

    // todo - this will have rtl issues at the moment

    input {
        margin: 0;
        margin-right: toRem(12);
        width: 1.5em;
        height: 1.5rem;
        accent-color: var(--color);
        appearance: none;
        background-color: transparent;
        margin: 0;
        cursor: pointer;

        font: inherit;
        color: currentColor;
        width: 1.15em;
        height: 1.15em;
        border: 1px solid currentColor;
        transform: translateY(-0.075em);

        display: grid;
        place-content: center;
    }

    input[type="checkbox"]::before {
        content: "";
        width: 0.65em;
        height: 0.65em;
        transform: scale(0);
        transition: 120ms transform ease-in-out;
        box-shadow: inset 1em 1em var(--color);
        transform-origin: bottom left;
        clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
    }

    input[type="checkbox"]:checked::before {
        transform: scale(1);
    }

    input[type="checkbox"]:disabled {
        --color: var(--txt-light);
        color: var(--txt-light);
        cursor: not-allowed;
    }

    .checkbox {
        display: flex;
        align-items: center;
        cursor: pointer;
        gap: $sp4;

        &.align-start {
            align-items: flex-start;

            input {
                margin-top: 3px;
            }
        }

        &.rtl input {
            margin-left: toRem(12);
            margin-right: unset;
        }
    }

    label {
        flex: 1;
        user-select: none;
        cursor: pointer;
    }

    .toggle {
        input {
            display: none;
        }

        label {
            transition: background-color 200ms ease-in-out;
            cursor: pointer;
            text-indent: -9999px;
            width: 80px;
            height: 36px;
            background: var(--toggle-bg);
            display: block;
            border-radius: var(--toggle-rd-track);
            position: relative;

            &.small {
                width: 50px;
                height: 25px;
            }
        }

        label:after {
            content: "";
            position: absolute;
            top: 2px;
            left: 2px;
            width: $size !important;
            height: $size;
            background: #fff;
            border-radius: var(--toggle-rd-thumb);
            transition: 150ms ease-in-out;
        }

        label.small:after {
            width: $size-small !important;
            height: $size-small;
        }

        input:checked + label {
            background-color: var(--button-bg);
        }

        input:checked + label:after {
            left: calc(100% - 2px);
            transform: translateX(-100%);
        }

        label:active:after {
            width: 60px;
        }
    }

    .toggle {
        &.disabled {
            label {
                cursor: default;
            }
        }
        &.waiting {
            label {
                cursor: wait;
            }
        }
    }
</style>

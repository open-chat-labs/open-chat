<script lang="ts">
    import { rtlStore } from "../stores/rtl";
    import MenuDown from "svelte-material-icons/MenuDown.svelte";

    interface Props {
        value: unknown;
        invalid?: boolean;
        disabled?: boolean;
        margin?: boolean;
        children?: import('svelte').Snippet;
        onchange?: () => void;
    }

    let {
        value = $bindable(),
        invalid = false,
        disabled = false,
        margin = true,
        children,
        onchange,
    }: Props = $props();
</script>

<div class:rtl={$rtlStore} class="wrapper">
    <select class:invalid class:margin {disabled} bind:value class={`select`} {onchange} >
        {@render children?.()}
    </select>
    {#if !disabled}
        <div class="icon">
            <MenuDown color={"var(--primary)"} size="1.8em" />
        </div>
    {/if}
</div>

<style lang="scss">
    :global(option) {
        color: var(--txt);
        font-weight: normal;
    }

    .wrapper {
        position: relative;
        .icon {
            position: absolute;
            right: 0.7em;
            top: 0.35em;
            pointer-events: none;
        }

        &.rtl {
            .icon {
                right: unset;
                left: 0.7em;
            }
        }
    }

    .select {
        transition: border ease-in-out 300ms;
        display: block;
        @include font(book, normal, fs-100);
        color: var(--txt);
        line-height: 24px;
        padding: $sp3 $sp4;
        width: 100%;
        max-width: 100%;
        margin: 0;
        border: none;
        box-shadow: var(--input-sh);
        border-radius: var(--rd);
        -moz-appearance: none;
        -webkit-appearance: none;
        appearance: none;
        background-color: var(--input-bg);
        border: var(--bw) solid var(--input-bd);

        &.margin {
            margin-bottom: $sp4;
        }

        &.invalid {
            border: var(--bw) solid var(--error);
        }
    }

    .select::-ms-expand {
        display: none;
    }

    .select:focus {
        border-color: var(--bd);
        outline: none;
    }
</style>

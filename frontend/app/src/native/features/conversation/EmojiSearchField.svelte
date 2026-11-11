<!-- The emoji panel's search field (native plan 07 "Top row"), and the reaction sheet's: 40px, 12px
     corners on --overlay-1, the search icon, and a clear × once there's text, which keeps the
     keyboard. What else the input takes (focus, blur, an attachment) is passed on to it. -->
<script lang="ts">
    import { SEARCH_INPUT_ATTRIBUTES } from "@openchat/ui/src/lib/searchInput";
    import type { HTMLInputAttributes } from "svelte/elements";
    import { _ } from "svelte-i18n";

    type Props = Omit<HTMLInputAttributes, "value" | "oninput"> & {
        value: string;
        /** The input, for the host to focus or blur. */
        field?: HTMLInputElement;
        onInput: (value: string) => void;
        onClear: () => void;
    };

    let { value, field = $bindable(), onInput, onClear, ...input }: Props = $props();
</script>

<label class="search">
    <span class="search-icon" aria-hidden="true"></span>
    <input
        bind:this={field}
        {...SEARCH_INPUT_ATTRIBUTES}
        {value}
        {...input}
        oninput={(e) => onInput(e.currentTarget.value)}
    />
    {#if value !== ""}
        <button
            type="button"
            class="clear"
            aria-label={$_("native.composer.emoji.clearSearch")}
            onpointerdown={(e) => e.preventDefault()}
            onclick={onClear}
        >
            <span class="clear-icon"></span>
        </button>
    {/if}
</label>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .search {
        flex: 1;
        min-width: 0;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        gap: var(--space-8);
        height: 40px;
        padding: 0 var(--space-6) 0 var(--space-12);
        border-radius: var(--radius-md);
        background: var(--overlay-1);
    }

    .search-icon {
        @include icon(search, 16px, var(--ink-4));
    }

    input {
        flex: 1;
        min-width: 0;
        height: 100%;
        padding: 0;
        border: 0;
        outline: none;
        background: transparent;
        font: var(--weight-medium) text-size(14.5px) / 1 var(--font-sans);
        color: var(--ink);
        appearance: none;

        &::placeholder {
            color: var(--ink-4);
        }

        &::-webkit-search-cancel-button {
            display: none;
        }
    }

    .clear {
        flex: none;
        width: 28px;
        height: 28px;
        display: grid;
        place-items: center;
        padding: 0;
        border: 0;
        border-radius: var(--radius-circle);
        background: none;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-2);
        }
    }

    .clear-icon {
        @include icon(close, 14px, var(--ink-3), $flex: null);
    }
</style>

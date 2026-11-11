<!-- The conversation's header while searching in the chat (native design notes §3.3): back closes the
     search, the field with "2 of 5" (or "No results", in the warning colour) at its end, then up
     (an older match) and down (a newer one), dimmed where there's none. Enter searches at once. -->
<script lang="ts">
    import { SEARCH_INPUT_ATTRIBUTES } from "@openchat/ui/src/lib/searchInput";
    import { onMount } from "svelte";

    type Props = {
        query: string;
        /** What the field's end says: "2 of 5", "No results", or nothing. */
        count: string;
        /** The count is "No results". */
        none: boolean;
        searching: boolean;
        canOlder: boolean;
        canNewer: boolean;
        text: { placeholder: string; close: string; older: string; newer: string };
        onQuery: (query: string) => void;
        onSubmit: () => void;
        onOlder: () => void;
        onNewer: () => void;
        onClose: () => void;
    };

    let {
        query,
        count,
        none,
        searching,
        canOlder,
        canNewer,
        text,
        onQuery,
        onSubmit,
        onOlder,
        onNewer,
        onClose,
    }: Props = $props();

    let input = $state<HTMLInputElement>();
    onMount(() => input?.focus());

    function keydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            onSubmit();
        } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
        }
    }
</script>

<header class="search" data-tab-swipe="off">
    <button type="button" class="cell" aria-label={text.close} onclick={onClose}>
        <span class="back-icon"></span>
    </button>
    <div class="field">
        <span class="search-icon"></span>
        <!-- a search, not a sign-in field: password managers leave it alone -->
        <input
            bind:this={input}
            {...SEARCH_INPUT_ATTRIBUTES}
            value={query}
            placeholder={text.placeholder}
            aria-label={text.placeholder}
            spellcheck="false"
            maxlength="30"
            oninput={(e) => onQuery(e.currentTarget.value)}
            onkeydown={keydown} />
        {#if searching}
            <span class="spinner" aria-hidden="true"></span>
        {:else if count !== ""}
            <span class="count" class:none aria-live="polite">{count}</span>
        {/if}
    </div>
    <button
        type="button"
        class="cell"
        class:dim={!canOlder}
        aria-label={text.older}
        aria-disabled={!canOlder}
        onclick={() => canOlder && onOlder()}>
        <span class="arrow up"></span>
    </button>
    <button
        type="button"
        class="cell"
        class:dim={!canNewer}
        aria-label={text.newer}
        aria-disabled={!canNewer}
        onclick={() => canNewer && onNewer()}>
        <span class="arrow"></span>
    </button>
</header>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .search {
        flex: none;
        display: flex;
        align-items: center;
        gap: 2px;
        padding: var(--safe-top) var(--space-4) var(--space-8);
        box-shadow: inset 0 -1px 0 var(--line-1);
        color: var(--ink);
    }

    .cell {
        flex: none;
        width: var(--touch-target);
        height: var(--touch-target);
        @include flex-center;
        padding: 0;
        border: 0;
        border-radius: var(--radius-circle);
        background: none;
        color: var(--ink);
        cursor: pointer;
        transition: opacity 0.15s ease;
        -webkit-tap-highlight-color: transparent;

        &.dim {
            opacity: 0.35;
            cursor: default;
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    // the kit's back: a chevron on iOS, an arrow on Android
    .back-icon {
        @include icon(chevron-right, 22px);
        transform: rotate(180deg);

        &:dir(rtl) {
            transform: none;
        }

        :global([data-os="android"]) & {
            mask: var(--icon-back) center/contain no-repeat;
            transform: none;

            &:dir(rtl) {
                transform: scaleX(-1);
            }
        }
    }

    .field {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: var(--space-8);
        height: 40px;
        padding-inline: var(--space-12) var(--space-10);
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
        outline: 0;
        background: transparent;
        color: var(--ink);
        font: var(--weight-medium) text-size(15px) / 1 var(--font-sans);
        appearance: none;

        &::placeholder {
            color: var(--ink-4);
        }

        // type="search"'s own clear button: the count and the arrows are the field's end
        &::-webkit-search-cancel-button,
        &::-webkit-search-decoration {
            display: none;
        }
    }

    .count {
        flex: none;
        font: var(--weight-medium) text-size(12px) / 1 var(--font-mono);
        color: var(--ink-4);
        white-space: nowrap;

        &.none {
            color: var(--status-warning);
        }
    }

    .spinner {
        flex: none;
        width: 14px;
        height: 14px;
        border: 2px solid var(--overlay-3);
        border-top-color: var(--ink-3);
        border-radius: var(--radius-circle);
        animation: spin 0.8s linear infinite;
    }

    .arrow {
        @include icon(chevron-down, 18px);

        &.up {
            mask: var(--icon-chevron-up) center/contain no-repeat;
        }
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    @include reduced-motion {
        .spinner {
            animation: none;
        }
    }
</style>

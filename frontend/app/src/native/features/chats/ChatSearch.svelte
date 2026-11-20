<!-- The Chats tab's search (native design notes §3.2): tapping the list's field lifts it into the title
     row, Cancel slides in beside it as the field narrows from the list's full width to make room
     (its width animates, user's request 2026-11-20) and the results fade in; Cancel reverses it.
     It has the whole window, the tab bar out of the way (ChatsScreen). Empty, it says what
     it searches; then the results in sections (Chats, People), each its first few with Show all. A
     layer over the Chats root, which swipes between tabs leave alone. Reduced motion: no slide or
     fade. -->
<script lang="ts" module>
    import type { ResultRow } from "./chats.adapter";

    /** How long the search takes to close (the field moving back down). */
    export const SEARCH_LEAVE_MS = 320;

    export type SearchSection = {
        id: string;
        /** Its heading, with the count. */
        label: string;
        rows: ResultRow[];
        /** More than it shows: Show all (or Show less, `expanded`). */
        more: boolean;
        expanded: boolean;
    };
</script>

<script lang="ts">
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { SEARCH_INPUT_ATTRIBUTES } from "@openchat/ui/src/lib/searchInput";
    import { Presence } from "@openchat/ui/src/native/presence.svelte";
    import { onDestroy, tick, untrack } from "svelte";
    import ResultRowView from "./ResultRow.svelte";


    type Props = {
        open: boolean;
        query: string;
        sections: SearchSection[];
        /** An answer is on its way (people). */
        searching: boolean;
        /** The app's words, translated. */
        text: {
            placeholder: string;
            cancel: string;
            clear: string;
            searchFor: string;
            kinds: { label: string; icon: string }[];
            showAll: string;
            showLess: string;
            noResults: string;
            noResultsHint: string;
        };
        onQuery: (query: string) => void;
        onCancel: () => void;
        onToggle: (sectionId: string) => void;
        onSelect: (sectionId: string, rowId: string) => void;
    };

    let {
        open,
        query,
        sections,
        searching,
        text,
        onQuery,
        onCancel,
        onToggle,
        onSelect,
    }: Props = $props();

    const presence = new Presence(SEARCH_LEAVE_MS);
    $effect.pre(() => {
        const now = open;
        untrack(() => presence.set(now));
    });
    onDestroy(() => presence.dispose());

    let input = $state<HTMLInputElement>();

    // the field takes the focus as it opens (the keyboard comes up with it)
    $effect(() => {
        if (open && input) void focus(input);
    });

    async function focus(el: HTMLInputElement) {
        await tick();
        el.focus({ preventScroll: true });
    }

    function clear() {
        onQuery("");
        input?.focus({ preventScroll: true });
    }

    const empty = $derived(query.trim() === "");
</script>

{#if presence.mounted}
    <div
        class="search"
        class:leaving={presence.leaving}
        role="dialog"
        aria-label={text.placeholder}
        data-tab-swipe="off">
        <div class="bg"></div>
        <div class="bar">
            <label class="field">
                <span class="search-icon"></span>
                <!-- a search, not a sign-in field: password managers leave it alone -->
                <input
                    bind:this={input}
                    {...SEARCH_INPUT_ATTRIBUTES}
                    value={query}
                    oninput={(e) => onQuery(e.currentTarget.value)}
                    placeholder={text.placeholder}
                    aria-label={text.placeholder} />
                {#if query !== ""}
                    <button type="button" class="clear" aria-label={text.clear} onclick={clear}>
                        <span class="clear-icon"></span>
                    </button>
                {/if}
            </label>
            <!-- it opens up beside the field, which narrows as it does -->
            <div class="cancel-slot">
                <button type="button" class="cancel" onclick={onCancel}>
                    <span class="cancel-label">{text.cancel}</span>
                </button>
            </div>
        </div>

        <div class="results">
            {#if empty}
                <div class="kinds">
                    <span class="label">{text.searchFor}</span>
                    <div class="pills">
                        {#each text.kinds as kind (kind.label)}
                            <span class="pill">
                                <span
                                    class="pill-icon"
                                    style:mask="var(--icon-{kind.icon}) center/contain no-repeat"
                                ></span>{kind.label}
                            </span>
                        {/each}
                    </div>
                </div>
            {:else}
                {#each sections as section (section.id)}
                    <section class="section">
                        <div class="heading">
                            <span class="label">{section.label}</span>
                            {#if section.more}
                                <button
                                    type="button"
                                    class="more"
                                    onclick={() => onToggle(section.id)}>
                                    {section.expanded ? text.showLess : text.showAll}
                                </button>
                            {/if}
                        </div>
                        {#each section.rows as row (row.id)}
                            <ResultRowView {row} onSelect={() => onSelect(section.id, row.id)} />
                        {/each}
                    </section>
                {/each}
                {#if searching}
                    <div class="searching"><Spinner /></div>
                {:else if sections.length === 0}
                    <div class="none">
                        <span class="none-title">{text.noResults}</span>
                        <span class="none-body">{text.noResultsHint}</span>
                    </div>
                {/if}
            {/if}
        </div>
    </div>
{/if}

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    // where the list's field sits under the title row: the field starts there and lifts into it
    $lift: calc(var(--touch-target) + 10px);

    .search {
        position: absolute;
        inset: 0;
        z-index: 8;
        display: flex;
        flex-direction: column;

        &.leaving {
            pointer-events: none;
        }
    }

    // the page fades in behind the field, which moves rather than fades
    .bg {
        position: absolute;
        inset: 0;
        background: var(--surface-0);
        animation: fade-in 0.26s ease-out;

        .leaving & {
            opacity: 0;
            transition: opacity 0.26s ease-out;
        }
    }

    // The field starts where the list's is, its full width (16px from both sides), and narrows as
    // Cancel's slot opens up beside it, while it lifts; closing, it widens back as it settles. The
    // slot's width goes 0fr → 1fr (Cancel's own width, whatever its language), and the bar's end
    // padding 16px → 8px (Cancel's hit area reaches nearer the edge), all on the lift's .32s
    // --ease-out
    .bar {
        position: relative;
        flex: none;
        display: flex;
        align-items: center;
        padding: calc(var(--safe-top) + 8px) var(--space-8) 0 var(--space-16);
        animation: lift 0.32s var(--ease-out);

        .leaving & {
            transform: translateY($lift);
            padding-inline-end: var(--space-16);
            transition:
                transform 0.32s var(--ease-out),
                padding-inline-end 0.32s var(--ease-out);
        }
    }

    .cancel-slot {
        flex: none;
        display: grid;
        grid-template-columns: 1fr;
        animation: cancel-in 0.32s var(--ease-out);

        .leaving & {
            grid-template-columns: 0fr;
            opacity: 0;
            transition:
                grid-template-columns 0.32s var(--ease-out),
                opacity 0.2s ease-out;
        }
    }

    .field {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: var(--space-10);
        height: 44px;
        padding: 0 var(--space-6) 0 var(--space-14);
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

        // type="search"'s own clear button: the field draws its own
        &::-webkit-search-cancel-button,
        &::-webkit-search-decoration {
            display: none;
        }
    }

    .clear {
        flex: none;
        width: 32px;
        height: 32px;
        @include flex-center;
        padding: 0;
        border: 0;
        background: none;
        cursor: pointer;
    }

    .clear-icon {
        width: 18px;
        height: 18px;
        border-radius: var(--radius-circle);
        background: var(--ink-4);
        @include flex-center;

        &::after {
            content: "";
            @include icon(close, 9px, var(--surface-0));
        }
    }

    // clipped to the slot as it opens: its word comes in from the inline end, as the slot's end is
    .cancel {
        min-width: 0;
        display: flex;
        align-items: center;
        justify-content: flex-end;
        overflow: hidden;
        height: 44px;
        padding: 0;
        border: 0;
        background: none;
        color: var(--accent-bright);
        font: var(--weight-semibold) text-size(15px) / 1 var(--font-sans);
        white-space: nowrap;
        cursor: pointer;
        // a tap draws nothing (the highlight showed at the slot's edge as it closed)
        -webkit-tap-highlight-color: transparent;

        &:focus-visible {
            @include focus-ring;
        }
    }

    // 6px from the field: its start padding, inside the button, so the slot at 0 leaves none
    .cancel-label {
        flex: none;
        padding: 0 var(--space-8) 0 calc(var(--space-6) + var(--space-8));
    }

    .results {
        position: relative;
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        // to the window's bottom, the tab bar out of the way: clear of the safe area
        padding: var(--space-16) var(--space-6) calc(var(--space-24) + var(--safe-bottom));
        // after the field has lifted
        animation: fade-in 0.2s ease-out 0.12s backwards;

        .leaving & {
            opacity: 0;
            transition: opacity 0.2s ease-out;
        }
    }

    .label {
        font: var(--weight-semibold) text-size(11.5px) / 1 var(--font-mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-4);
    }

    .kinds {
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
        padding: var(--space-8) var(--space-10);
    }

    .pills {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-8);
    }

    .pill {
        display: flex;
        align-items: center;
        gap: 7px;
        height: 34px;
        padding: 0 var(--space-12);
        border-radius: 17px;
        background: var(--overlay-1);
        color: var(--ink-2);
        font: var(--weight-semibold) text-size(13px) / 1 var(--font-sans);
    }

    .pill-icon {
        width: 14px;
        height: 14px;
        background: var(--ink-3);
    }

    .section {
        display: flex;
        flex-direction: column;
        gap: var(--space-2);
        padding: 0 var(--space-4);

        & + & {
            margin-top: var(--space-18);
        }
    }

    .heading {
        display: flex;
        align-items: center;
        padding: var(--space-4) var(--space-10) var(--space-6);

        .label {
            flex: 1;
        }
    }

    .more {
        height: 28px;
        padding: 0;
        border: 0;
        background: none;
        color: var(--accent-bright);
        font: var(--weight-semibold) text-size(13px) / 1 var(--font-sans);
        cursor: pointer;
    }

    .searching {
        display: grid;
        place-items: center;
        padding: var(--space-24);
    }

    .none {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-6);
        padding: 40px 20px;
        text-align: center;
    }

    .none-title {
        font: var(--weight-semibold) text-size(15px) / 1.3 var(--font-sans);
        overflow-wrap: anywhere;
    }

    .none-body {
        font: var(--weight-regular) text-size(13.5px) / 1.45 var(--font-sans);
        color: var(--ink-4);
    }

    @keyframes lift {
        from {
            transform: translateY($lift);
            padding-inline-end: var(--space-16);
        }
    }

    @keyframes cancel-in {
        from {
            opacity: 0;
            grid-template-columns: 0fr;
        }
    }

    @keyframes fade-in {
        from {
            opacity: 0;
        }
    }

    @include reduced-motion {
        .bg,
        .bar,
        .cancel-slot,
        .results {
            animation: none;
            transition: none;
        }

        // no width change either: closing, the bar keeps its shape and fades with the rest
        .leaving .bar {
            transform: none;
            padding-inline-end: var(--space-8);
            opacity: 0;
        }

        .leaving .cancel-slot {
            grid-template-columns: 1fr;
        }
    }
</style>

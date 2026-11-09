<!-- The emoji and GIF panel (native plan 07), in the keyboard-area slot (KeyboardPanel): the Emoji /
     GIF switch and a search field, then the emoji by section (Recent first, then every emoji the
     phone draws, by category) in eight columns, with the category bar and backspace pinned at the
     bottom; or the GIFs in two columns. A tap types the emoji at the caret without the keyboard
     (the panel stays); backspace deletes the character before it. Searching emoji, the panel is a
     strip over the keyboard (the user's, over the plan's full height): the field across it and the
     emoji found in one line under it, the composer above. Searching GIFs, the panel grows (to 90%)
     before the keyboard comes up for the field, so it never covers the results. Either search
     ending (the panel back at rest, or the keyboard down) puts the field's keyboard away. A GIF
     sends as it's tapped. The emoji are EmojiGrid's (the reaction sheet's too), the field
     EmojiSearchField. -->
<script lang="ts">
    import type { GiphyContent, KlipyObject } from "@client";
    import SegmentedTabs from "@openchat/ui/src/lib/components/SegmentedTabs.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { GifFeed } from "@src/logic/composer/gifFeed.svelte";
    import { gifContent } from "@src/logic/composer/gifs";
    import type { PickerEmoji } from "@src/utils/emojiCategories";
    import { countEmojiPicked } from "@src/utils/emojis";
    import { klipyApiKey } from "@src/utils/features";
    import { onDestroy, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import EmojiGrid from "./EmojiGrid.svelte";
    import { EMOJI_SEARCH_DELAY_MS, EmojiSections } from "./emojiSections.svelte";
    import EmojiSearchField from "./EmojiSearchField.svelte";
    import { panelContentPull } from "./panelDragHandle";
    import type { Search } from "./keyboardSlot";
    import { GIF_PULL_HIDES_KEYBOARD } from "./panelDrag";
    import type { KeyboardPanelState, SearchLeave } from "./panelState.svelte";

    type Props = {
        panel: KeyboardPanelState;
        /** Whose Recent it is. */
        userId: string;
        /** GIFs may be sent here. */
        gifs: boolean;
        /** The search field has the keyboard, and how the panel shows it (the slot's). */
        search: Search;
        /** Types into the draft at the caret ("\b" deletes). */
        onInsert: (text: string) => void;
        onGif: (content: GiphyContent) => void;
        /** The search field took the keyboard (as the emoji strip, or the grown GIFs), or gave it up. */
        onSearch: (search: Search) => void;
    };

    let { panel, userId, gifs, search: searchMode, onInsert, onGif, onSearch }: Props = $props();
    const searching = $derived(searchMode !== "none");
    const strip = $derived(searchMode === "strip");

    const apiKey = klipyApiKey;
    const offersGifs = $derived(gifs && apiKey !== undefined);
    let tab = $state<"emoji" | "gif">("emoji");
    let query = $state("");
    let field = $state<HTMLInputElement>();

    // ---- emoji: Recent as kept on the device for this user (07: "persist per user"), read as the
    // panel opens (it's made again each time)

    const storage = (() => {
        try {
            return window.localStorage;
        } catch {
            return undefined;
        }
    })();
    const emoji = new EmojiSections(untrack(() => userId), storage);
    onMount(() => void emoji.load());
    onDestroy(() => emoji.dispose());

    function pick(picked: PickerEmoji) {
        onInsert(picked.char);
        emoji.picked(picked.char);
        countEmojiPicked(picked.base);
    }

    // ---- search: the emoji matching (names and keywords; EmojiSections'), or the GIFs

    let searchTimer: ReturnType<typeof setTimeout> | undefined;
    onDestroy(() => clearTimeout(searchTimer));

    function typed(next: string) {
        query = next;
        clearTimeout(searchTimer);
        if (tab === "gif") {
            searchTimer = setTimeout(() => void feed?.search(next), EMOJI_SEARCH_DELAY_MS);
        } else {
            emoji.search(next);
        }
    }

    function clearSearch() {
        clearTimeout(searchTimer);
        emoji.clearSearch();
        query = "";
        if (tab === "gif") void feed?.search("");
        field?.focus();
    }

    // searching GIFs, the panel grows before the keyboard comes up for the field (07 "Search"): a
    // press on the field while it's at rest grows it, and the field takes the focus once it's grown
    // (the press itself doesn't: the field moves up under the finger). Pressed with the focus in it
    // already, nothing changes.
    const GROW_MS = 340;
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    onDestroy(() => clearTimeout(focusTimer));

    function growFirst(el: HTMLInputElement) {
        function pressed(e: Event) {
            if (tab !== "gif" || panel.open || document.activeElement === el) return;
            e.preventDefault();
            panel.expand();
            clearTimeout(focusTimer);
            focusTimer = setTimeout(() => el.focus(), GROW_MS);
        }
        el.addEventListener("touchstart", pressed, { passive: false });
        el.addEventListener("mousedown", pressed);
        return () => {
            el.removeEventListener("touchstart", pressed);
            el.removeEventListener("mousedown", pressed);
        };
    }

    // switching tabs blurs the field, clears the query and leaves any search, the sheet keeping
    // its size (07 "Top row")
    function switchTo(next: "emoji" | "gif") {
        if (next === tab) return;
        if (document.activeElement === field) leaveSearch("keep");
        tab = next;
        query = "";
        emoji.clearSearch();
        clearTimeout(searchTimer);
        if (next === "gif") void feed?.search("");
    }

    // the size the sheet had as the emoji search started, for when it's over
    let beforeSearch: "rest" | "open" = "rest";
    // the emoji search's strip is up (the slot's search may already have ended with the keyboard)
    let inStrip = false;
    // how the search is being left (set before the field's blurred), else by the keyboard going
    type Leave = SearchLeave | "keep" | "keyboard";
    let leaving: Leave | undefined;

    // the field has the keyboard: emoji, the compact strip on top of it (from rest or grown, the
    // sheet not growing meanwhile); GIFs, the sheet grown to 90%
    function searchStarted() {
        if (tab === "gif") {
            panel.setExpandable(true);
            panel.expand();
            onSearch("grown");
        } else {
            beforeSearch = panel.open ? "open" : "rest";
            inStrip = true;
            panel.setExpandable(false);
            onSearch("strip");
        }
    }

    /** Leaves the search: hides its keyboard, the sheet going where `how` says. */
    function leaveSearch(how: Leave) {
        leaving = how;
        if (how === "close") {
            clearTimeout(searchTimer);
            emoji.clearSearch();
            query = "";
        }
        if (document.activeElement === field) field?.blur();
        else searchEnded();
    }

    // the field's keyboard gone: the sheet as the way out says (07 "Leave"): the backdrop, to
    // rest; pulled up, grown; the emoji search closed or its keyboard hidden, the size it had
    // before; the GIF search's keyboard hidden, as it is (90%)
    function searchEnded() {
        if (gone) return;
        const how = leaving ?? "keyboard";
        leaving = undefined;
        const strip = inStrip;
        inStrip = false;
        panel.setExpandable(true);
        onSearch("none");
        if (how === "rest") panel.rest();
        else if (how === "expand") panel.expand();
        else if (strip && (how === "close" || how === "keyboard")) {
            if (beforeSearch === "open") panel.expand();
            else panel.rest();
        }
    }

    // a search left from the sheet (the backdrop, the strip's handle pulled)
    $effect(() => {
        const sheet = panel;
        sheet.onLeaveSearch = (how) => leaveSearch(how);
        return () => (sheet.onLeaveSearch = undefined);
    });

    // the keyboard put away (its hide key): the field lets go of the focus, the search is over
    $effect(() => {
        if (searchMode === "none" && document.activeElement === field) {
            untrack(() => field?.blur());
        }
    });

    // the grown GIF search pulled down (the handle, or the grid at its top): past 12px the
    // keyboard goes, and the pull goes on as the sheet's drag
    $effect(() => {
        if (searchMode === "grown" && panel.dragging && panel.dragDown > GIF_PULL_HIDES_KEYBOARD) {
            untrack(() => {
                if (document.activeElement === field) field?.blur();
            });
        }
    });

    // going (the panel closed): the field's keyboard goes with it, and nothing else is left to do
    let gone = false;
    onDestroy(() => {
        gone = true;
        if (document.activeElement === field) field?.blur();
    });

    // ---- GIFs

    const feed = apiKey === undefined ? undefined : new GifFeed(apiKey);

    function more(e: Event) {
        const el = e.currentTarget as HTMLElement;
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 400) void feed?.more();
    }

    // a related term tapped: its search, in the field
    function searchTerm(term: string) {
        clearTimeout(searchTimer);
        query = term;
        void feed?.search(term);
    }

    function gifTitle(gif: KlipyObject): string {
        return gif.title || gif.content_description;
    }
</script>

<div class="emoji" role="group" aria-label={$_("ui.messageComposer.emojiAndGifs")}>
    <div class="top">
        {#if offersGifs && !strip}
            <div class="switch">
                <SegmentedTabs
                    size="sm"
                    labels={[$_("ui.messageComposer.emoji"), $_("ui.messageComposer.gif")]}
                    selectedIndex={tab === "emoji" ? 0 : 1}
                    dotOnLast={false}
                    onSelect={(i) => switchTo(i === 0 ? "emoji" : "gif")}
                />
            </div>
        {/if}
        <EmojiSearchField
            bind:field
            value={query}
            placeholder={$_(tab === "gif" ? "ui.messageComposer.searchGifs" : "ui.emojiPicker.search")}
            aria-label={$_(tab === "gif" ? "ui.messageComposer.searchGifs" : "ui.emojiPicker.search")}
            onInput={typed}
            onClear={clearSearch}
            onfocus={searchStarted}
            onblur={() => searchEnded()}
            {@attach growFirst}
        />
    </div>

    {#if tab === "emoji"}
        <EmojiGrid
            {emoji}
            bind:query
            {strip}
            overSafeArea={!searching}
            scrollAttach={panelContentPull(panel)}
            onPick={pick}
        >
            {#snippet barEnd()}
                <button
                    type="button"
                    class="backspace"
                    aria-label={$_("native.composer.emoji.backspace")}
                    onclick={() => onInsert("\b")}
                >
                    <span class="backspace-icon"></span>
                </button>
            {/snippet}
        </EmojiGrid>
    {:else if feed !== undefined}
        <div
            class="scroll gifs"
            class:raised={searching}
            onscroll={more}
            {@attach panelContentPull(panel)}
        >
            {#if feed.notFound !== undefined}
                <!-- none found: related terms to search for, else the trending GIFs under it -->
                <p class="none gif-none">
                    {$_("native.composer.gif.noMatch", { values: { query: feed.notFound.query } })}
                </p>
                {#if feed.notFound.kind === "suggestions"}
                    <div class="terms">
                        {#each feed.notFound.terms as term (term)}
                            <button type="button" class="term" onclick={() => searchTerm(term)}>
                                {term}
                            </button>
                        {/each}
                    </div>
                {/if}
            {/if}
            {#if feed.gifs.length === 0 && !feed.loading && feed.notFound === undefined}
                <p class="none">
                    {$_(feed.failed ? "native.composer.gif.unavailable" : "native.composer.gif.none")}
                </p>
            {:else if feed.gifs.length > 0}
                <div class="gif-grid">
                    {#each feed.gifs as gif (gif.id)}
                        <button
                            type="button"
                            class="gif"
                            aria-label={gifTitle(gif)}
                            onclick={() => onGif(gifContent(gif))}
                        >
                            <img src={gif.media_formats.tinygif.url} alt="" loading="lazy" />
                            <span class="gif-badge" aria-hidden="true">GIF</span>
                        </button>
                    {/each}
                </div>
            {/if}
            {#if feed.loading}
                <div class="loading"><Spinner size={20} /></div>
            {/if}
        </div>
    {/if}
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .emoji {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
    }

    // 07: the switch (136px, compact) and the search field filling the rest
    .top {
        flex: none;
        display: flex;
        align-items: center;
        gap: var(--space-8);
        padding: 0 var(--space-12) var(--space-8);
    }

    .switch {
        flex: none;
        width: 136px;
    }

    .scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        // a pull down at its top drags the panel (panelContentPull, 06)
        overscroll-behavior: contain;
        padding: 2px var(--space-8) var(--space-8);
        scrollbar-width: none;

        &::-webkit-scrollbar {
            display: none;
        }
    }

    .none {
        margin: 0;
        padding: var(--space-24) var(--space-16);
        text-align: center;
        font: var(--weight-regular) text-size(14px) / 1.4 var(--font-sans);
        color: var(--ink-4);
    }

    .loading {
        display: flex;
        justify-content: center;
        padding: var(--space-16);
    }

    // the bar's end (EmojiGrid's): backspace, 44px wide
    .backspace {
        flex: none;
        width: 44px;
        height: 40px;
        display: grid;
        place-items: center;
        padding: 0;
        border: 0;
        border-radius: var(--radius-md);
        background: none;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-2);
        }
    }

    .backspace-icon {
        @include icon(backspace, 22px, var(--ink-2), $flex: null);
    }

    // 07: two columns of 3:2 tiles, 6px apart; no bar under them, so clear of the safe area
    .gifs {
        padding: 2px var(--space-10) calc(var(--space-8) + var(--safe-bottom));

        // the keyboard over the grid's bottom (the panel's padding): the last row 10px above it
        &.raised {
            padding-block-end: var(--space-10);
        }
    }

    .gif-none {
        padding: var(--space-16) var(--space-16) var(--space-12);
    }

    // the related terms, as chips
    .terms {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: var(--space-8);
        padding: 0 var(--space-8) var(--space-16);
    }

    .term {
        height: 32px;
        padding: 0 var(--space-12);
        border: 0;
        border-radius: var(--radius-pill);
        background: var(--overlay-1);
        font: var(--weight-semibold) text-size(13px) / 1 var(--font-sans);
        color: var(--ink-2);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-2);
        }
    }

    .gif-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: var(--space-6);
    }

    .gif {
        position: relative;
        display: block;
        aspect-ratio: 3 / 2;
        padding: 0;
        border: 0;
        border-radius: var(--radius-md);
        overflow: hidden;
        background: var(--overlay-1);
        cursor: pointer;

        img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
    }

    // 07: a small "GIF" in the top corner
    .gif-badge {
        position: absolute;
        top: var(--space-6);
        right: var(--space-6);
        height: 16px;
        padding: 0 var(--space-4);
        display: grid;
        place-items: center;
        border-radius: 5px;
        background: var(--on-media-badge);
        font: var(--weight-bold) text-size(9px) / 1 var(--font-mono);
        color: var(--on-media-ink);
    }
</style>

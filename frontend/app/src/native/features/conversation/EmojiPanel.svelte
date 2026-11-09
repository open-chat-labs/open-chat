<!-- The emoji and GIF panel (native plan 07), in the keyboard-area slot (KeyboardPanel): the Emoji /
     GIF switch and a search field, then the emoji by section (Recent first, then every emoji the
     phone draws, by category) in eight columns, with the category bar and backspace pinned at the
     bottom; or the GIFs in two columns. A tap types the emoji at the caret without the keyboard
     (the panel stays); backspace deletes the character before it. Searching emoji, the panel is a
     strip over the keyboard (the user's, over the plan's full height): the field across it and the
     emoji found in one line under it, the composer above. Searching GIFs, the panel grows (to 90%)
     before the keyboard comes up for the field, so it never covers the results. Either search
     ending (the panel back at rest, or the keyboard down) puts the field's keyboard away. A GIF
     sends as it's tapped. -->
<script lang="ts">
    import type { GiphyContent, KlipyObject } from "@client";
    import SegmentedTabs from "@openchat/ui/src/lib/components/SegmentedTabs.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { GifFeed } from "@src/logic/composer/gifFeed.svelte";
    import { gifContent } from "@src/logic/composer/gifs";
    import { pickedRecently, storedRecent, storeRecent } from "@src/logic/composer/recentEmoji";
    import { EMOJI_CATEGORIES, type PickerEmoji } from "@src/utils/emojiCategories";
    import { countEmojiPicked, emojiInCategory, emojiMatching } from "@src/utils/emojis";
    import { klipyApiKey } from "@src/utils/features";
    import { onDestroy, onMount, untrack } from "svelte";
    import { _ } from "svelte-i18n";
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

    const SEARCH_DELAY_MS = 250;

    const apiKey = klipyApiKey;
    const offersGifs = $derived(gifs && apiKey !== undefined);
    let tab = $state<"emoji" | "gif">("emoji");
    let query = $state("");
    let field = $state<HTMLInputElement>();

    // ---- emoji

    type Section = { id: string; label: string; icon: string; emoji: PickerEmoji[] };

    // Recent: as kept on the device for this user (07: "persist per user")
    const storage = (() => {
        try {
            return window.localStorage;
        } catch {
            return undefined;
        }
    })();
    // read as the panel opens (it's made again each time)
    let recent = $state.raw<string[]>(
        storage === undefined ? [] : storedRecent(storage, untrack(() => userId)),
    );

    let categories = $state.raw<(PickerEmoji[] | undefined)[]>(EMOJI_CATEGORIES.map(() => undefined));
    let matches = $state.raw<PickerEmoji[] | undefined>();
    let failed = $state(false);

    onMount(async () => {
        try {
            categories = await Promise.all(EMOJI_CATEGORIES.map((c) => emojiInCategory(c.group)));
        } catch (err) {
            // the emoji data comes from a CDN the first time: offline, there's none
            console.warn("Couldn't load the emoji", err);
            failed = true;
        }
    });

    const sections = $derived.by((): Section[] => [
        {
            id: "recent",
            label: $_("native.composer.emoji.recent"),
            icon: "🕘",
            emoji: recent.map((char) => ({ char, base: char, name: char })),
        },
        ...EMOJI_CATEGORIES.map((category, i) => ({
            id: category.name,
            label: $_(`native.composer.emoji.${category.name}`),
            icon: category.icon,
            emoji: categories[i] ?? [],
        })),
    ]);

    const loading = $derived(categories.every((c) => c === undefined) && !failed);

    function pick(emoji: PickerEmoji) {
        onInsert(emoji.char);
        recent = pickedRecently(recent, emoji.char);
        if (storage !== undefined) storeRecent(storage, userId, recent);
        countEmojiPicked(emoji.base);
    }

    // one listener for the grid's thousands of cells
    function picked(e: MouseEvent, emoji: PickerEmoji[]) {
        const cell = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-i]");
        const found = cell === null || cell === undefined ? undefined : emoji[Number(cell.dataset.i)];
        if (found !== undefined) pick(found);
    }

    // ---- search: the emoji matching (names and keywords), or the GIFs

    let searchTimer: ReturnType<typeof setTimeout> | undefined;
    let searchRun = 0;
    onDestroy(() => clearTimeout(searchTimer));

    function typed(next: string) {
        query = next;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => void search(next), SEARCH_DELAY_MS);
    }

    async function search(next: string) {
        const run = ++searchRun;
        if (tab === "gif") {
            void feed?.search(next);
            return;
        }
        if (next.trim() === "") {
            matches = undefined;
            return;
        }
        try {
            const found = await emojiMatching(next.trim());
            if (run === searchRun) matches = found;
        } catch (err) {
            console.warn("Couldn't search the emoji", err);
        }
    }

    function clearSearch() {
        clearTimeout(searchTimer);
        searchRun += 1;
        query = "";
        matches = undefined;
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
        matches = undefined;
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
            searchRun += 1;
            query = "";
            matches = undefined;
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

    // ---- the category bar: the one in view, and going to one

    let scroller = $state<HTMLElement>();
    let shown = $state("recent");
    let frame = 0;
    onDestroy(() => cancelAnimationFrame(frame));

    function followScroll() {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
            const el = scroller;
            if (el === undefined) return;
            let current = sections[0]?.id ?? "";
            for (const section of el.querySelectorAll<HTMLElement>("[data-section]")) {
                if (section.offsetTop - el.offsetTop <= el.scrollTop + 8) {
                    current = section.dataset.section ?? current;
                }
            }
            shown = current;
        });
    }

    function goTo(id: string) {
        // out of the results, to the section
        if (matches !== undefined || query !== "") {
            clearTimeout(searchTimer);
            searchRun += 1;
            query = "";
            matches = undefined;
        }
        requestAnimationFrame(() => {
            const el = scroller;
            const section = el?.querySelector<HTMLElement>(`[data-section="${id}"]`);
            if (el === undefined || section === null || section === undefined) return;
            const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            el.scrollTo({ top: section.offsetTop - el.offsetTop, behavior: smooth ? "smooth" : "auto" });
        });
        shown = id;
    }
</script>

{#snippet grid(emoji: PickerEmoji[])}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <div class="grid" role="group" onclick={(e) => picked(e, emoji)}>
        {#each emoji as e, i}
            <span class="cell" data-i={i} role="button" tabindex="0" aria-label={e.name}>{e.char}</span>
        {/each}
    </div>
{/snippet}

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
        <label class="search">
            <span class="search-icon" aria-hidden="true"></span>
            <input
                bind:this={field}
                type="search"
                value={query}
                placeholder={$_(
                    tab === "gif" ? "ui.messageComposer.searchGifs" : "ui.emojiPicker.search",
                )}
                aria-label={$_(
                    tab === "gif" ? "ui.messageComposer.searchGifs" : "ui.emojiPicker.search",
                )}
                autocomplete="off"
                enterkeyhint="search"
                {@attach growFirst}
                oninput={(e) => typed(e.currentTarget.value)}
                onfocus={searchStarted}
                onblur={() => searchEnded()}
            />
            {#if query !== ""}
                <button
                    type="button"
                    class="clear"
                    aria-label={$_("native.composer.emoji.clearSearch")}
                    onpointerdown={(e) => e.preventDefault()}
                    onclick={clearSearch}
                >
                    <span class="clear-icon"></span>
                </button>
            {/if}
        </label>
    </div>

    {#if strip}
        <!-- the emoji found in one line (Recent before anything's typed); a tap keeps the field's
             keyboard -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div class="line" onmousedown={(e) => e.preventDefault()}>
            {#if matches !== undefined && matches.length === 0}
                <p class="none line-none">
                    {$_("native.composer.emoji.noMatch", { values: { query: query.trim() } })}
                </p>
            {:else}
                {@render grid(matches ?? sections[0].emoji)}
            {/if}
        </div>
    {:else if tab === "emoji"}
        <div
            class="scroll"
            bind:this={scroller}
            onscroll={followScroll}
            {@attach panelContentPull(panel)}
        >
            {#if matches !== undefined}
                {#if matches.length === 0}
                    <p class="none">
                        {$_("native.composer.emoji.noMatch", { values: { query: query.trim() } })}
                    </p>
                {:else}
                    <section class="section">
                        <h3 class="label">{$_("native.composer.emoji.results")}</h3>
                        {@render grid(matches)}
                    </section>
                {/if}
            {:else}
                {#each sections as section (section.id)}
                    <section class="section" class:lazy={section.id !== "recent"} data-section={section.id}>
                        <h3 class="label">{section.label}</h3>
                        {#if section.id === "recent" || section.emoji.length > 0}
                            {@render grid(section.emoji)}
                        {:else if failed}
                            <p class="none">{$_("native.composer.emoji.unavailable")}</p>
                        {:else if loading}
                            <div class="loading"><Spinner size={20} /></div>
                        {/if}
                    </section>
                {/each}
            {/if}
        </div>
        <div
            class="bar"
            class:raised={searching}
            role="toolbar"
            aria-label={$_("native.composer.emoji.categories")}
        >
            {#each sections as section (section.id)}
                <button
                    type="button"
                    class="category"
                    class:on={shown === section.id && matches === undefined}
                    aria-label={section.label}
                    onclick={() => goTo(section.id)}>{section.icon}</button
                >
            {/each}
            <button
                type="button"
                class="backspace"
                aria-label={$_("native.composer.emoji.backspace")}
                onclick={() => onInsert("\b")}
            >
                <span class="backspace-icon"></span>
            </button>
        </div>
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

    // the emoji search's strip: one line, scrolled sideways
    .line {
        flex: none;
        height: 52px;
        box-sizing: border-box;
        padding: 0 var(--space-8) var(--space-8);
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: none;

        &::-webkit-scrollbar {
            display: none;
        }

        .grid {
            display: flex;
            gap: 2px;
        }

        .cell {
            flex: none;
            width: 44px;
        }
    }

    .line-none {
        padding: var(--space-12) var(--space-8);
        text-align: start;
    }

    .section + .section {
        margin-block-start: var(--space-10);
    }

    // a category off screen isn't laid out, so thousands of emoji scroll smoothly
    .section.lazy {
        content-visibility: auto;
        contain-intrinsic-size: auto 400px;
    }

    // 07: mono 600 11px, uppercase, .08em
    .label {
        margin: 0;
        padding: var(--space-6) var(--space-6) var(--space-4);
        font: var(--weight-semibold) text-size(11px) / 1.2 var(--font-mono);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-4);
    }

    // 07: eight columns of 44px cells, 10px corners, the glyph at 27px
    .grid {
        display: grid;
        grid-template-columns: repeat(8, minmax(0, 1fr));
    }

    .cell {
        height: 44px;
        display: grid;
        place-items: center;
        border-radius: 10px;
        font-size: 27px;
        line-height: 1;
        cursor: pointer;
        user-select: none;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-2);
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

    // 07: the categories and backspace pinned at the bottom, over the safe area (above the
    // keyboard while searching)
    .bar {
        flex: none;
        display: flex;
        align-items: center;
        padding: var(--space-4) var(--space-8) calc(var(--space-4) + var(--safe-bottom));
        box-shadow: inset 0 1px 0 var(--line-1);

        &.raised {
            padding-block-end: var(--space-4);
        }
    }

    .category,
    .backspace {
        height: 40px;
        display: grid;
        place-items: center;
        padding: 0;
        border: 0;
        border-radius: var(--radius-md);
        background: none;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
    }

    .category {
        flex: 1;
        min-width: 0;
        font-size: 18px;
        line-height: 1;
        opacity: 0.55;
        filter: grayscale(0.6);

        &.on {
            opacity: 1;
            filter: none;
        }
    }

    .backspace {
        flex: none;
        width: 44px;

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

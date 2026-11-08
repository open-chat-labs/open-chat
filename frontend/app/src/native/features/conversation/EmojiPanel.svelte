<!-- The emoji panel, in the keyboard's place under the composer (native design notes §3.3): the
     Emoji / GIF switch and a search field, then every emoji the phone draws in an 8-column grid by
     category (the ones picked most first), the category bar with backspace at the bottom. A tap
     types the emoji into the draft without the keyboard; backspace deletes the character before
     the caret. Searching, the panel grows above the keyboard so the results stay in sight (the
     host's slot, `covered` being what the keyboard hides). GIFs (Klipy's) send as they're tapped. -->
<script lang="ts">
    import type { GiphyContent, KlipyObject } from "@client";
    import SegmentedTabs from "@openchat/ui/src/lib/components/SegmentedTabs.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { GifFeed } from "@src/logic/composer/gifFeed.svelte";
    import { gifContent } from "@src/logic/composer/gifs";
    import { EMOJI_CATEGORIES, type PickerEmoji } from "@src/utils/emojiCategories";
    import {
        countEmojiPicked,
        emojiInCategory,
        emojiMatching,
        frequentEmoji,
    } from "@src/utils/emojis";
    import { klipyApiKey } from "@src/utils/features";
    import { onDestroy, onMount } from "svelte";
    import { _ } from "svelte-i18n";

    type Props = {
        /** GIFs may be sent here. */
        gifs: boolean;
        /** How much of the panel's bottom the keyboard covers (while searching). */
        covered: number;
        /** The search field has the keyboard. */
        searching: boolean;
        /** Types into the draft ("\b" deletes). */
        onInsert: (text: string) => void;
        onGif: (content: GiphyContent) => void;
        /** The search field took the keyboard, or gave it up. */
        onSearch: (searching: boolean) => void;
    };

    let { gifs, covered, searching, onInsert, onGif, onSearch }: Props = $props();

    // as the old pickers' "frequently used"
    const FREQUENT = 16;
    const SEARCH_DELAY_MS = 250;

    const apiKey = klipyApiKey;
    const offersGifs = $derived(gifs && apiKey !== undefined);
    let tab = $state<"emoji" | "gif">("emoji");
    let query = $state("");

    // ---- emoji

    type Section = { id: string; label: string; icon: string; emoji: PickerEmoji[] };

    let frequent = $state.raw<PickerEmoji[]>([]);
    let categories = $state.raw<(PickerEmoji[] | undefined)[]>(EMOJI_CATEGORIES.map(() => undefined));
    let matches = $state.raw<PickerEmoji[] | undefined>();
    let failed = $state(false);

    onMount(async () => {
        try {
            const [top, ...all] = await Promise.all([
                frequentEmoji(FREQUENT),
                ...EMOJI_CATEGORIES.map((c) => emojiInCategory(c.group)),
            ]);
            frequent = top;
            categories = all;
        } catch (err) {
            // the emoji data comes from a CDN the first time: offline, there's none
            console.warn("Couldn't load the emoji", err);
            failed = true;
        }
    });

    const sections = $derived.by((): Section[] => {
        const list: Section[] = [];
        if (frequent.length > 0) {
            list.push({
                id: "frequent",
                label: $_("native.composer.emoji.frequent"),
                icon: "🕘",
                emoji: frequent,
            });
        }
        EMOJI_CATEGORIES.forEach((category, i) => {
            list.push({
                id: category.name,
                label: $_(`native.composer.emoji.${category.name}`),
                icon: category.icon,
                emoji: categories[i] ?? [],
            });
        });
        return list;
    });

    const loading = $derived(categories.every((c) => c === undefined) && !failed);

    function pick(emoji: PickerEmoji) {
        onInsert(emoji.char);
        countEmojiPicked(emoji.base);
    }

    // one listener for the grid's thousands of cells
    function picked(e: MouseEvent, emoji: PickerEmoji[]) {
        const cell = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-i]");
        const found = cell === null || cell === undefined ? undefined : emoji[Number(cell.dataset.i)];
        if (found !== undefined) pick(found);
    }

    // ---- search: the emoji matching, or the GIFs

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

    function switchTo(next: "emoji" | "gif") {
        if (next === tab) return;
        tab = next;
        query = "";
        matches = undefined;
        clearTimeout(searchTimer);
        if (next === "gif") void feed?.search("");
    }

    // ---- GIFs

    const feed = apiKey === undefined ? undefined : new GifFeed(apiKey);

    function more(e: Event) {
        const el = e.currentTarget as HTMLElement;
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 400) void feed?.more();
    }

    // two columns, each GIF going to the shorter one (by its height for the column's width)
    const columns = $derived.by(() => {
        const cols: { gifs: KlipyObject[]; height: number }[] = [
            { gifs: [], height: 0 },
            { gifs: [], height: 0 },
        ];
        for (const gif of feed?.gifs ?? []) {
            const [w, h] = gif.media_formats.tinygif.dims;
            const col = cols[0].height <= cols[1].height ? cols[0] : cols[1];
            col.gifs.push(gif);
            col.height += w > 0 ? h / w : 1;
        }
        return cols;
    });

    // ---- the category bar: the one in view, and going to one

    let scroller = $state<HTMLElement>();
    let shown = $state("frequent");
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
        const el = scroller;
        const section = el?.querySelector<HTMLElement>(`[data-section="${id}"]`);
        if (el === undefined || section === null || section === undefined) return;
        el.scrollTo({ top: section.offsetTop - el.offsetTop });
        shown = id;
    }
</script>

<div
    class="panel"
    style:padding-block-end="{covered}px"
    role="group"
    aria-label={$_("ui.messageComposer.emojiAndGifs")}
>
    <div class="top">
        {#if offersGifs}
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
                oninput={(e) => typed(e.currentTarget.value)}
                onfocus={() => onSearch(true)}
                onblur={() => onSearch(false)}
            />
        </label>
    </div>

    {#if tab === "emoji"}
        <div class="scroll" bind:this={scroller} onscroll={followScroll}>
            {#if matches !== undefined}
                {#if matches.length === 0}
                    <p class="none">{$_("ui.emojiPicker.noMatch", { values: { query } })}</p>
                {:else}
                    <!-- svelte-ignore a11y_click_events_have_key_events -->
                    <div class="grid" role="group" onclick={(e) => picked(e, matches ?? [])}>
                        {#each matches as emoji, i}
                            <span class="cell" data-i={i} role="button" tabindex="0" aria-label={emoji.name}
                                >{emoji.char}</span
                            >
                        {/each}
                    </div>
                {/if}
            {:else if failed}
                <p class="none">{$_("native.composer.emoji.unavailable")}</p>
            {:else if loading}
                <div class="loading"><Spinner size={20} /></div>
            {:else}
                {#each sections as section (section.id)}
                    <section class="section" data-section={section.id}>
                        <h3 class="label">{section.label}</h3>
                        <!-- svelte-ignore a11y_click_events_have_key_events -->
                        <div class="grid" role="group" onclick={(e) => picked(e, section.emoji)}>
                            {#each section.emoji as emoji, i}
                                <span
                                    class="cell"
                                    data-i={i}
                                    role="button"
                                    tabindex="0"
                                    aria-label={emoji.name}>{emoji.char}</span
                                >
                            {/each}
                        </div>
                    </section>
                {/each}
            {/if}
        </div>
        {#if !searching}
            <div class="bar" role="toolbar" aria-label={$_("native.composer.emoji.categories")}>
                <div class="categories">
                    {#each sections as section (section.id)}
                        <button
                            type="button"
                            class="category"
                            class:on={shown === section.id && matches === undefined}
                            aria-label={section.label}
                            onclick={() => goTo(section.id)}>{section.icon}</button
                        >
                    {/each}
                </div>
                <button
                    type="button"
                    class="backspace"
                    aria-label={$_("native.composer.emoji.backspace")}
                    onclick={() => onInsert("\b")}
                >
                    <span class="backspace-icon"></span>
                </button>
            </div>
        {/if}
    {:else if feed !== undefined}
        <div class="scroll gifs" onscroll={more}>
            {#if feed.gifs.length === 0 && !feed.loading}
                <p class="none">
                    {$_(feed.failed ? "native.composer.gif.unavailable" : "native.composer.gif.none")}
                </p>
            {:else}
                <div class="columns">
                    {#each columns as column, c (c)}
                        <div class="column">
                            {#each column.gifs as gif (gif.id)}
                                {@const [w, h] = gif.media_formats.tinygif.dims}
                                <button
                                    type="button"
                                    class="gif"
                                    style:aspect-ratio="{w} / {h}"
                                    aria-label={gif.title || gif.content_description}
                                    onclick={() => onGif(gifContent(gif))}
                                >
                                    <img src={gif.media_formats.tinygif.url} alt="" loading="lazy" />
                                </button>
                            {/each}
                        </div>
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

    .panel {
        box-sizing: border-box;
        height: 100%;
        display: flex;
        flex-direction: column;
        background: var(--surface-0);
        box-shadow: inset 0 1px 0 var(--line-1);
        animation: oc-veil-in 0.18s ease-out;

        @include reduced-motion {
            animation: none;
        }
    }

    .top {
        flex: none;
        display: flex;
        align-items: center;
        gap: var(--space-8);
        padding: var(--space-10) var(--space-12) var(--space-6);
    }

    .switch {
        flex: none;
        width: 128px;
    }

    .search {
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: var(--space-8);
        height: 40px;
        padding: 0 var(--space-12);
        border-radius: var(--radius-pill);
        background: var(--overlay-1);
    }

    .search-icon {
        @include icon(search, 15px, var(--ink-4));
    }

    input {
        flex: 1;
        min-width: 0;
        height: 100%;
        padding: 0;
        border: 0;
        outline: none;
        background: transparent;
        // 16px, so iOS doesn't zoom into it
        font: var(--weight-regular) 16px / 1 var(--font-sans);
        color: var(--ink);
        appearance: none;

        &::-webkit-search-cancel-button {
            display: none;
        }
    }

    .scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 0 var(--space-8) var(--space-8);
        scrollbar-width: none;
    }

    .section {
        // a category off screen isn't laid out, so thousands of emoji scroll smoothly
        content-visibility: auto;
        contain-intrinsic-size: auto 400px;
    }

    .label {
        margin: 0;
        padding: var(--space-10) var(--space-6) var(--space-4);
        font: var(--weight-semibold) text-size(12px) / 1 var(--font-sans);
        color: var(--ink-4);
    }

    // 8 columns (notes §3.3)
    .grid {
        display: grid;
        grid-template-columns: repeat(8, minmax(0, 1fr));
    }

    .cell {
        aspect-ratio: 1;
        display: grid;
        place-items: center;
        border-radius: var(--radius-sm);
        font-size: 28px;
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
        font: var(--weight-regular) var(--text-sm) / 1.4 var(--font-sans);
        color: var(--ink-4);
    }

    .loading {
        display: flex;
        justify-content: center;
        padding: var(--space-16);
    }

    // the categories and backspace, over the safe area
    .bar {
        flex: none;
        display: flex;
        align-items: center;
        gap: var(--space-4);
        padding: var(--space-4) var(--space-8) max(var(--safe-bottom), var(--space-6));
        box-shadow: inset 0 1px 0 var(--line-1);
    }

    .categories {
        flex: 1;
        min-width: 0;
        display: flex;
        justify-content: space-between;
    }

    .category,
    .backspace {
        flex: none;
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        padding: 0;
        border: 0;
        border-radius: var(--radius-circle);
        background: none;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
    }

    .category {
        font-size: 18px;
        line-height: 1;
        filter: grayscale(1);
        opacity: 0.55;

        &.on {
            background: var(--overlay-2);
            filter: none;
            opacity: 1;
        }
    }

    .backspace {
        width: var(--touch-target);
        height: var(--touch-target);
    }

    .backspace-icon {
        @include icon(backspace, 22px, var(--ink-2), $flex: null);
    }

    // GIFs: no bar under them, so clear of the safe area
    .gifs {
        padding-block-end: max(var(--safe-bottom), var(--space-8));
    }

    // two columns, the shorter one taking the next
    .columns {
        display: flex;
        gap: var(--space-6);
        padding-block-start: var(--space-4);
    }

    .column {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
    }

    .gif {
        display: block;
        width: 100%;
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
</style>

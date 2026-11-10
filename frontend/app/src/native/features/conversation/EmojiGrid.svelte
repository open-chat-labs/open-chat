<!-- The emoji a picker offers (native plan 07 "Emoji tab"), the composer's emoji panel's and the
     reaction sheet's: by section (Recent first, then every emoji the phone draws, by category) in
     eight columns, or what the search found, with the category bar pinned under them; or, for the
     composer's search strip, what the search found (Recent before anything's typed) in one line. A
     category tapped scrolls to it, out of the search's results. Picking is the host's: what it does,
     and whether it counts towards Recent (EmojiSections). -->
<script lang="ts">
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { EMOJI_CATEGORIES, type PickerEmoji } from "@src/utils/emojiCategories";
    import { onDestroy, type Snippet } from "svelte";
    import type { Attachment } from "svelte/attachments";
    import { _ } from "svelte-i18n";
    import type { EmojiSections } from "./emojiSections.svelte";

    type Props = {
        emoji: EmojiSections;
        /** What's searched for (the host's field): going to a category clears it. */
        query: string;
        /** The search's one line (the composer's strip over the keyboard), with no bar. */
        strip?: boolean;
        /** The bar keeps clear of the safe area under it (not over the keyboard, or in a sheet that does). */
        overSafeArea?: boolean;
        /** Marked as picked already (the reactions the user has on the message). */
        selected?: readonly string[];
        /** On the scroller (the panel's pull at its top, 06). */
        scrollAttach?: Attachment<HTMLElement>;
        /** At the bar's end (the composer's backspace). */
        barEnd?: Snippet;
        onPick: (emoji: PickerEmoji) => void;
    };

    let {
        emoji,
        query = $bindable(),
        strip = false,
        overSafeArea = true,
        selected = [],
        scrollAttach,
        barEnd,
        onPick,
    }: Props = $props();

    type Section = { id: string; label: string; icon: string; emoji: PickerEmoji[] };

    const sections = $derived.by((): Section[] => [
        {
            id: "recent",
            label: $_("native.composer.emoji.recent"),
            icon: "🕘",
            emoji: emoji.recent.map((char) => ({ char, base: char, name: char })),
        },
        ...EMOJI_CATEGORIES.map((category, i) => ({
            id: category.name,
            label: $_(`native.composer.emoji.${category.name}`),
            icon: category.icon,
            emoji: emoji.categories[i] ?? [],
        })),
    ]);

    // one listener for the grid's thousands of cells
    function picked(e: MouseEvent, shown: PickerEmoji[]) {
        const cell = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-i]");
        const found =
            cell === null || cell === undefined ? undefined : shown[Number(cell.dataset.i)];
        if (found !== undefined) onPick(found);
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
        if (emoji.matches !== undefined || query !== "") {
            emoji.clearSearch();
            query = "";
        }
        requestAnimationFrame(() => {
            const el = scroller;
            const section = el?.querySelector<HTMLElement>(`[data-section="${id}"]`);
            if (el === undefined || section === null || section === undefined) return;
            const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            el.scrollTo({
                top: section.offsetTop - el.offsetTop,
                behavior: smooth ? "smooth" : "auto",
            });
        });
        shown = id;
    }
</script>

{#snippet grid(shown: PickerEmoji[])}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <div class="grid" role="group" onclick={(e) => picked(e, shown)}>
        {#each shown as e, i}
            <span
                class="cell"
                class:on={selected.includes(e.char)}
                data-i={i}
                role="button"
                tabindex="0"
                aria-label={e.name}
                aria-pressed={selected.length > 0 ? selected.includes(e.char) : undefined}
                >{e.char}</span
            >
        {/each}
    </div>
{/snippet}

{#if strip}
    <!-- a tap keeps the field's keyboard -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="line" onmousedown={(e) => e.preventDefault()}>
        {#if emoji.matches !== undefined && emoji.matches.length === 0}
            <p class="none line-none">
                {$_("native.composer.emoji.noMatch", { values: { query: query.trim() } })}
            </p>
        {:else}
            {@render grid(emoji.matches ?? sections[0].emoji)}
        {/if}
    </div>
{:else}
    <div class="scroll" bind:this={scroller} onscroll={followScroll} {@attach scrollAttach}>
        {#if emoji.matches !== undefined}
            {#if emoji.matches.length === 0}
                <p class="none">
                    {$_("native.composer.emoji.noMatch", { values: { query: query.trim() } })}
                </p>
            {:else}
                <section class="section">
                    <h3 class="label">{$_("native.composer.emoji.results")}</h3>
                    {@render grid(emoji.matches)}
                </section>
            {/if}
        {:else}
            {#each sections as section (section.id)}
                <section
                    class="section"
                    class:lazy={section.id !== "recent"}
                    data-section={section.id}
                >
                    <h3 class="label">{section.label}</h3>
                    {#if section.id === "recent" || section.emoji.length > 0}
                        {@render grid(section.emoji)}
                    {:else if emoji.failed}
                        <p class="none">{$_("native.composer.emoji.unavailable")}</p>
                    {:else if emoji.loading}
                        <div class="loading"><Spinner size={20} /></div>
                    {/if}
                </section>
            {/each}
        {/if}
    </div>
    <div
        class="bar"
        class:safe={overSafeArea}
        role="toolbar"
        aria-label={$_("native.composer.emoji.categories")}
    >
        {#each sections as section (section.id)}
            <button
                type="button"
                class="category"
                class:on={shown === section.id && emoji.matches === undefined}
                aria-label={section.label}
                onclick={() => goTo(section.id)}>{section.icon}</button
            >
        {/each}
        {@render barEnd?.()}
    </div>
{/if}

<style lang="scss">
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

        // a reaction the user has on the message already (picking it takes it off)
        &.on {
            background: var(--accent-soft);
            box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--accent) 50%, transparent);
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

    // 07: the categories (and the composer's backspace) pinned at the bottom, over the safe area
    // where there's nothing else under them
    .bar {
        flex: none;
        display: flex;
        align-items: center;
        padding: var(--space-4) var(--space-8);
        box-shadow: inset 0 1px 0 var(--line-1);

        &.safe {
            padding-block-end: calc(var(--space-4) + var(--safe-bottom));
        }
    }

    .category {
        flex: 1;
        min-width: 0;
        height: 40px;
        display: grid;
        place-items: center;
        padding: 0;
        border: 0;
        border-radius: var(--radius-md);
        background: none;
        font-size: 18px;
        line-height: 1;
        opacity: 0.55;
        filter: grayscale(0.6);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &.on {
            opacity: 1;
            filter: none;
        }
    }
</style>

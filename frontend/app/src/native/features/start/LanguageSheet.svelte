<!-- The app's languages with search (native design notes §3.1, §3.8), each row its flag, own name, English name and
     code. One language (Welcome's: the one in use ticked; picking one switches to it, setLocale, and closes the
     sheet) or several (Explore's: each a checkbox, with the sheet's buttons under them, `footer`). -->
<script lang="ts">
    import Field from "@openchat/ui/src/lib/components/Field.svelte";
    import BottomSheet from "@openchat/ui/src/native/BottomSheet.svelte";
    import { supportedLanguages } from "@i18n/i18n";
    import type { Snippet } from "svelte";
    import { _ } from "svelte-i18n";
    import { languageRows } from "./start.adapter";

    type Props = {
        open: boolean;
        onClose: () => void;
        /** Translated. */
        title: string;
        /** Those ticked. */
        selected: (code: string) => boolean;
        onPick: (code: string) => void;
        /** Several can be ticked, as checkboxes. */
        multiple?: boolean;
        /** Under the languages (Explore's Clear and Show). */
        footer?: Snippet;
    };

    let { open, onClose, title, selected, onPick, multiple = false, footer }: Props = $props();

    let query = $state("");

    const english = (() => {
        try {
            const names = new Intl.DisplayNames(["en"], { type: "language" });
            return (code: string) => names.of(code);
        } catch {
            return () => undefined;
        }
    })();

    const rows = $derived(languageRows(supportedLanguages, selected, query, english));

    // the search starts empty the next time
    $effect(() => {
        if (!open) query = "";
    });
</script>

<BottomSheet {open} {onClose} {title} height="72%">
    {#snippet header()}
        <div class="search">
            <Field
                placeholder={$_("native.start.language.search")}
                value={query}
                onInput={(e) => (query = e.currentTarget.value)}
                onClear={() => (query = "")}
                showShortcut={false} />
        </div>
    {/snippet}
    <div class="rows" role={multiple ? "group" : "radiogroup"} aria-label={title}>
        {#each rows as row (row.code)}
            <button
                type="button"
                class="row"
                class:selected={row.selected}
                role={multiple ? "checkbox" : "radio"}
                aria-checked={row.selected}
                onclick={() => onPick(row.code)}>
                <span class="flag" aria-hidden="true">{row.flag}</span>
                <span class="names">
                    <span class="name">{row.name}</span>
                    {#if row.english}<span class="english">{row.english}</span>{/if}
                </span>
                <span class="code">{row.code.toUpperCase()}</span>
                {#if multiple}
                    <span class="box" class:on={row.selected}><span class="tick"></span></span>
                {:else}
                    <span class="check" class:on={row.selected}></span>
                {/if}
            </button>
        {:else}
            <p class="none">{$_("native.start.language.none")}</p>
        {/each}
    </div>
    {#if footer}
        <div class="footer">{@render footer()}</div>
    {/if}
</BottomSheet>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .search {
        padding: 0 var(--space-16) var(--space-10);
    }

    // the languages scroll under the search, which stays put (the sheet's body doesn't scroll)
    .rows {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        padding: 0 var(--space-16) var(--scroll-end);
    }

    .row {
        display: flex;
        align-items: center;
        gap: var(--space-12);
        min-height: 56px;
        padding: 0 var(--space-12);
        border: 0;
        border-radius: var(--radius-md);
        background: none;
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &.selected {
            background: var(--overlay-1);
        }

        &:active {
            background: var(--overlay-1);
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .flag {
        flex: none;
        width: 28px;
        text-align: center;
        font: var(--weight-regular) text-size(22px) / 1 var(--font-sans);
    }

    .names {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .name {
        font: var(--weight-semibold) text-size(15px) / 1.2 var(--font-sans);
        @include truncate;
    }

    .english {
        font: var(--weight-medium) text-size(12.5px) / 1 var(--font-sans);
        color: var(--ink-4);
    }

    .code {
        flex: none;
        font: var(--weight-bold) text-size(12px) / 1 var(--font-mono);
        color: var(--ink-4);
    }

    .check {
        @include icon(check, 18px, var(--accent));
        opacity: 0;

        &.on {
            opacity: 1;
        }
    }

    // Explore's: a 24px box, filled with the accent once ticked (the design's)
    .box {
        flex: none;
        width: 24px;
        height: 24px;
        border-radius: 7px;
        box-sizing: border-box;
        @include flex-center;
        box-shadow: inset 0 0 0 1.5px var(--ink-4);

        &.on {
            background: var(--accent);
            box-shadow: none;
        }
    }

    .tick {
        @include icon(check, 12px, var(--on-accent));
        opacity: 0;

        .on & {
            opacity: 1;
        }
    }

    .footer {
        flex: none;
        padding: var(--space-12) var(--space-16) calc(var(--safe-bottom) + var(--space-12));
        box-shadow: inset 0 1px 0 var(--line-1);
    }

    .none {
        margin: 0;
        padding: 28px var(--space-16);
        text-align: center;
        font: var(--weight-regular) text-size(14px) / 1.5 var(--font-sans);
        color: var(--ink-4);
    }
</style>

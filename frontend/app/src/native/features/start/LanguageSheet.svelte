<!-- Welcome's language (native design notes §3.1): the app's languages with search, each row its
     flag, own name, English name and code, the one in use ticked; picking one switches to it
     (setLocale, kept in this browser) and closes the sheet. -->
<script lang="ts">
    import Field from "@openchat/ui/src/lib/components/Field.svelte";
    import BottomSheet from "@openchat/ui/src/native/BottomSheet.svelte";
    import { languageCode, setLocale, supportedLanguages } from "@i18n/i18n";
    import { _, locale } from "svelte-i18n";
    import { languageRows } from "./start.adapter";

    type Props = { open: boolean; onClose: () => void };

    let { open, onClose }: Props = $props();

    let query = $state("");

    const english = (() => {
        try {
            const names = new Intl.DisplayNames(["en"], { type: "language" });
            return (code: string) => names.of(code);
        } catch {
            return () => undefined;
        }
    })();

    const rows = $derived(
        languageRows(supportedLanguages, languageCode($locale), query, english),
    );

    // the search starts empty the next time
    function close() {
        query = "";
        onClose();
    }

    function pick(code: string) {
        void setLocale(code);
        close();
    }
</script>

<BottomSheet {open} onClose={close} title={$_("native.start.language.title")} height="72%">
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
    <div class="rows" role="radiogroup" aria-label={$_("native.start.language.title")}>
        {#each rows as row (row.code)}
            <button
                type="button"
                class="row"
                class:selected={row.selected}
                role="radio"
                aria-checked={row.selected}
                onclick={() => pick(row.code)}>
                <span class="flag" aria-hidden="true">{row.flag}</span>
                <span class="names">
                    <span class="name">{row.name}</span>
                    {#if row.english}<span class="english">{row.english}</span>{/if}
                </span>
                <span class="code">{row.code.toUpperCase()}</span>
                <span class="check" class:on={row.selected}></span>
            </button>
        {:else}
            <p class="none">{$_("native.start.language.none")}</p>
        {/each}
    </div>
</BottomSheet>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .search {
        padding: 0 var(--space-16) var(--space-10);
    }

    .rows {
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

    .none {
        margin: 0;
        padding: 28px var(--space-16);
        text-align: center;
        font: var(--weight-regular) text-size(14px) / 1.5 var(--font-sans);
        color: var(--ink-4);
    }
</style>

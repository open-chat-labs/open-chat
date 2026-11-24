<!-- The Supported tokens sheet (native plan's 13 Root, Empty wallet; the prototype's token sheet with
     its "browse" target): a search, the tokens held ("Your tokens", amount and value), then the rest
     of the catalogue ("All tokens", their price). A token picked opens its page. One fixed height, as
     a sheet whose content changes (notes §1 Sheets). -->
<script lang="ts">
    import Field from "@openchat/ui/src/lib/components/Field.svelte";
    import ListSectionLabel from "@openchat/ui/src/lib/components/ListSectionLabel.svelte";
    import TokenAvatar from "@openchat/ui/src/lib/components/TokenAvatar.svelte";
    import BottomSheet from "@openchat/ui/src/native/BottomSheet.svelte";
    import { softKeyboard } from "../../aboveKeyboard.svelte";
    import { _ } from "svelte-i18n";
    import { supportedSheet, type SheetRow, type WalletFigures } from "./wallet.adapter";

    type Props = {
        open: boolean;
        figures: WalletFigures;
        onClose: () => void;
        /** A token picked, by its id. */
        onPick: (id: string) => void;
    };

    let { open, figures, onClose, onPick }: Props = $props();

    let query = $state("");
    const sheet = $derived(supportedSheet(figures, query));

    // the search starts empty the next time
    $effect(() => {
        if (!open) query = "";
    });
</script>

{#snippet rows(list: SheetRow[])}
    {#each list as t (t.id)}
        <button type="button" class="row" onclick={() => onPick(t.id)}>
            <TokenAvatar size={40} symbol={t.symbol} mark={t.mark} gradient={t.grad} logo={t.logo} />
            <span class="names">
                <span class="symbol">{t.symbol}</span>
                <span class="name">{t.name}</span>
            </span>
            <span class="right">
                <span class="main">{t.right}</span>
                {#if t.rightSub !== undefined}<span class="sub">{t.rightSub}</span>{/if}
            </span>
        </button>
    {/each}
{/snippet}

<BottomSheet {open} {onClose} title={$_("native.wallet.supportedTokens")} height="82%" keyboard={softKeyboard.covering}>
    {#snippet header()}
        <div class="search">
            <Field
                placeholder={$_("native.wallet.searchTokens")}
                value={query}
                onInput={(e) => (query = e.currentTarget.value)}
                onClear={() => (query = "")}
                showShortcut={false} />
        </div>
    {/snippet}
    <div class="list">
        {#if sheet.yours.length > 0}
            <div class="label first"><ListSectionLabel label={$_("native.wallet.yourTokens")} /></div>
            {@render rows(sheet.yours)}
        {/if}
        {#if sheet.others.length > 0}
            <div class="label" class:first={sheet.yours.length === 0}>
                <ListSectionLabel label={$_("native.wallet.allTokens")} />
            </div>
            {@render rows(sheet.others)}
        {/if}
        {#if sheet.yours.length === 0 && sheet.others.length === 0}
            <p class="none">{$_("native.wallet.noMatch")}</p>
        {/if}
    </div>
</BottomSheet>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .search {
        padding: 0 var(--space-16) var(--space-10);
    }

    // the tokens scroll under the search, which stays put
    .list {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        display: flex;
        flex-direction: column;
        gap: var(--space-6);
        padding: 0 var(--space-16) var(--scroll-end);
    }

    // a section label has 16px above it, 8px when it's first under the search (notes §1 Spacing)
    .label {
        padding: var(--space-16) 0 0 var(--space-4);

        &.first {
            padding-top: var(--space-8);
        }
    }

    .row {
        display: flex;
        align-items: center;
        gap: var(--space-12);
        min-height: 60px;
        padding: 0 var(--space-12);
        border: 0;
        border-radius: var(--radius-md);
        background: none;
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-1);
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .names {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 5px;
    }

    .symbol {
        font: var(--weight-bold) text-size(15px) / 1.2 var(--font-sans);
        @include truncate;
    }

    .name {
        font: var(--weight-medium) text-size(12.5px) / 1 var(--font-sans);
        color: var(--ink-4);
        @include truncate;
    }

    .right {
        flex: none;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 5px;
    }

    .main {
        font: var(--weight-semibold) text-size(14px) / 1.2 var(--font-mono);
    }

    .sub {
        font: var(--weight-medium) text-size(12px) / 1 var(--font-mono);
        color: var(--ink-4);
    }

    .none {
        margin: 0;
        padding: var(--space-24) var(--space-8);
        text-align: center;
        font: var(--weight-regular) text-size(13.5px) / 1.5 var(--font-sans);
        color: var(--ink-4);
    }
</style>

<!-- Explore (N8b PR 4, native plan 12 "Explore", Design Notes §3.8): from the Communities tab, or its root with no
     communities. The search and the language button (a count on it once any are picked; the picked ones as pills
     under it, each removed with a tap, Clear with more than one); browsing, Featured and the shelves (View all pushes
     the shelf's list), or one plain list where that leaves no shelf; searching, the results. Pages come from the shared
     search (communitySearchState), filtered by the languages picked (saved on this device, `communityFiltersStore`,
     as the web's) and the viewer's moderation flags, one more as the list nears its end. A community the user is in
     opens; any other is previewed, whose Back comes back here. -->
<script lang="ts">
    import {
        communitiesStore,
        communityFiltersStore,
        exploreCommunitiesFiltersStore,
        isCommunityMember,
        type OpenChat,
    } from "@client";
    import { supportedLanguagesByCode } from "@i18n/i18n";
    import Avatar from "@openchat/ui/src/lib/components/Avatar.svelte";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import Field from "@openchat/ui/src/lib/components/Field.svelte";
    import ListSectionLabel from "@openchat/ui/src/lib/components/ListSectionLabel.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import {
        exploreFlags,
        exploreNeedsSearch,
        exploreSearchKey,
        languageToggles,
    } from "@src/logic/explore/exploreSearch";
    import { communitySearchState, heldCommunitySearch } from "@src/stores/search.svelte";
    import { disableRestrictedContent } from "@src/utils/features";
    import { navigate } from "@src/utils/navigation";
    import { getContext, untrack } from "svelte";
    import { _, locale } from "svelte-i18n";
    import { SvelteSet } from "svelte/reactivity";
    import type { NativeScreen } from "../../router/locations";
    import { useOverlay } from "../../shell/overlays.svelte";
    import type { ScreenProps } from "../app/screens";
    import LanguageSheet from "../start/LanguageSheet.svelte";
    import { compactCount, exploreBrowse, exploreRows, type ExploreRow } from "./explore.adapter";
    import { exploreFirstPage, exploreNextPage } from "./exploreFeed";
    import ExploreRowView from "./ExploreRowView.svelte";

    let { context }: ScreenProps<Extract<NativeScreen, { kind: "explore" }>> = $props();

    const client = getContext<OpenChat>("client");

    // what's typed, and what's searched for: the text once typing pauses
    let text = $state(untrack(() => communitySearchState.term));
    let term = $state(untrack(() => communitySearchState.term));
    $effect(() => {
        const next = text.trim();
        const timer = setTimeout(() => (term = next), 300);
        return () => clearTimeout(timer);
    });

    const languages = $derived([...$communityFiltersStore]);
    // a store build never shows adult or offensive communities
    const flags = $derived(
        exploreFlags($exploreCommunitiesFiltersStore.flags, disableRestrictedContent),
    );
    const query = $derived({ text: term, languages });

    let status = $state<"loading" | "ready" | "failed">("ready");
    let loadingMore = false;

    async function first() {
        status = "loading";
        const outcome = await exploreFirstPage(client, query, flags);
        if (outcome !== "superseded") status = outcome === "success" ? "ready" : "failed";
    }

    // on opening, and whenever the text, languages or flags change, unless the results held
    // already answer it (coming back to Explore shows them again)
    $effect(() => {
        const wanted = exploreSearchKey(query, flags);
        untrack(() => {
            if (
                exploreNeedsSearch(
                    heldCommunitySearch(),
                    wanted,
                    communitySearchState.results.length,
                )
            ) {
                void first();
            }
        });
    });

    async function more() {
        if (loadingMore || status !== "ready") return;
        const next = exploreNextPage(client, query, flags);
        if (next === undefined) return;
        loadingMore = true;
        await next;
        loadingMore = false;
    }

    function onScroll(e: Event & { currentTarget: HTMLElement }) {
        const el = e.currentTarget;
        if (el.scrollHeight - el.scrollTop - el.clientHeight < 400) void more();
    }

    const joined = $derived(
        new Set(
            [...$communitiesStore.values()]
                .filter(isCommunityMember)
                .map((c) => c.id.communityId),
        ),
    );
    const rows = $derived(exploreRows(communitySearchState.results, joined));
    const searching = $derived(term !== "");
    const browse = $derived(searching ? undefined : exploreBrowse(rows));
    const languageNames = $derived(
        languages.map((code) => supportedLanguagesByCode[code]?.name ?? code).join(", "),
    );

    function open(row: ExploreRow) {
        if (!row.joined) client.setCommunityPreviewOrigin(row.id, "/communities");
        navigate(`/community/${row.id}`);
    }

    // the language sheet: what's ticked in it, applied by Show
    let sheetOpen = $state(false);
    const draft = new SvelteSet<string>();
    useOverlay(
        untrack(() => context.overlays),
        () => sheetOpen,
        () => (sheetOpen = false),
    );

    function openLanguages() {
        draft.clear();
        languages.forEach((l) => draft.add(l));
        sheetOpen = true;
    }

    function toggleDraft(code: string) {
        if (draft.has(code)) draft.delete(code);
        else draft.add(code);
    }

    function pickLanguages(picked: string[]) {
        languageToggles($communityFiltersStore, picked).forEach((l) =>
            client.toggleCommunityFilterLanguage(l),
        );
    }
</script>

{#snippet list(items: ExploreRow[], ranked: boolean)}
    <div class="list">
        {#each items as row (row.id)}
            <ExploreRowView {row} {ranked} onOpen={open} />
        {/each}
    </div>
{/snippet}

<div class="explore">
    <NativePageHeader title={$_("native.explore.title")} onBack={context.back} />
    <div class="search">
        <div class="field">
            <Field
                placeholder={$_("native.explore.search")}
                value={text}
                onInput={(e) => (text = e.currentTarget.value)}
                onClear={() => (text = "")}
                showShortcut={false} />
        </div>
        <button
            type="button"
            class="languages"
            class:on={languages.length > 0}
            aria-haspopup="dialog"
            aria-label={languages.length > 0
                ? $_("native.explore.languagesPicked", { values: { languages: languageNames } })
                : $_("native.explore.filterByLanguage")}
            onclick={openLanguages}>
            <span class="globe"></span>
            <span class="chevron"></span>
            {#if languages.length > 0}<span class="count">{languages.length}</span>{/if}
        </button>
    </div>
    {#if languages.length > 0}
        <div class="pills">
            {#each languages as code (code)}
                {@const name = supportedLanguagesByCode[code]?.name ?? code}
                <button
                    type="button"
                    class="pill"
                    aria-label={$_("native.explore.removeLanguage", { values: { language: name } })}
                    onclick={() => client.toggleCommunityFilterLanguage(code)}>
                    {name}<span class="x"></span>
                </button>
            {/each}
            {#if languages.length > 1}
                <button type="button" class="clear" onclick={() => pickLanguages([])}>
                    {$_("native.explore.clear")}
                </button>
            {/if}
        </div>
    {/if}

    <div class="scroll" onscroll={onScroll}>
        {#if status === "failed" && rows.length === 0}
            <div class="state">
                <EmptyState
                    preset="error"
                    title={$_("unexpectedError")}
                    body={$_("native.explore.failed")}
                    actionLabel="ui.common.retry"
                    actionHandler={() => void first()} />
            </div>
        {:else if status === "loading" && rows.length === 0}
            <div class="state"><Spinner /></div>
        {:else if rows.length === 0}
            <p class="none">{$_("native.explore.none")}</p>
        {:else if browse?.kind === "shelves"}
            {#if browse.featured.length > 0}
                <section class="section">
                    <div class="label"><ListSectionLabel label={$_("native.explore.featured")} /></div>
                    <div class="featured">
                        {#each browse.featured as row (row.id)}
                            <button type="button" class="card" onclick={() => open(row)}>
                                <span
                                    class="cover"
                                    class:image={row.coverUrl !== undefined}
                                    style:background-image={row.coverUrl !== undefined
                                        ? `url("${row.coverUrl}")`
                                        : undefined}></span>
                                <span class="card-head">
                                    <span class="card-avatar">
                                        <Avatar
                                            size={52}
                                            shape="squircle"
                                            url={row.avatarUrl}
                                            color={row.color} />
                                    </span>
                                    <span class="card-name">{row.name}</span>
                                    <span class="card-meta">
                                        <span class="users"></span>{compactCount(
                                            row.members,
                                            $locale,
                                        )}
                                        {#if row.gated}<span class="lock"></span>{/if}
                                    </span>
                                </span>
                                <span class="card-about">{row.about}</span>
                            </button>
                        {/each}
                    </div>
                </section>
            {/if}
            {#each browse.shelves as shelf (shelf.key)}
                <section class="section shelf">
                    <div class="shelf-head">
                        <span class="shelf-label">
                            <ListSectionLabel label={$_(`native.explore.shelf.${shelf.key}`)} />
                        </span>
                        <button
                            type="button"
                            class="view-all"
                            onclick={() => context.push({ kind: "explore_list", shelf: shelf.key })}>
                            {$_("native.explore.viewAll")}
                        </button>
                    </div>
                    <div class="columns">
                        {#each shelf.columns as column, i (i)}
                            <div class="column">
                                {#each column as row (row.id)}
                                    <ExploreRowView {row} ranked onOpen={open} />
                                {/each}
                            </div>
                        {/each}
                    </div>
                </section>
            {/each}
        {:else}
            <section class="section">
                <div class="label">
                    <ListSectionLabel
                        label={searching || languages.length === 0
                            ? $_("native.explore.results")
                            : $_("native.explore.communitiesIn", {
                                  values: { languages: languageNames },
                              })} />
                </div>
                {@render list(rows, false)}
            </section>
        {/if}
    </div>
</div>

<LanguageSheet
    open={sheetOpen}
    onClose={() => (sheetOpen = false)}
    title={$_("native.explore.languages")}
    selected={(code) => draft.has(code)}
    onPick={toggleDraft}
    multiple>
    {#snippet footer()}
        <div class="sheet-buttons">
            <Button
                label={$_("native.explore.clear")}
                variant="secondary"
                size="lg"
                fullWidth
                disabled={draft.size === 0}
                onClick={() => draft.clear()} />
            <Button
                label={$_("native.explore.showLanguages", { values: { count: draft.size } })}
                size="lg"
                fullWidth
                onClick={() => {
                    pickLanguages([...draft]);
                    sheetOpen = false;
                }} />
        </div>
    {/snippet}
</LanguageSheet>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .explore {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .search {
        flex: none;
        display: flex;
        gap: 8px;
        padding: 6px 16px 12px;
    }

    .field {
        flex: 1;
        min-width: 0;
    }

    // the globe and a chevron; accent-ringed with a count once languages are picked
    .languages {
        position: relative;
        flex: none;
        display: flex;
        align-items: center;
        gap: 6px;
        height: 48px;
        padding: 0 12px 0 14px;
        border: 0;
        border-radius: 14px;
        background: var(--overlay-1);
        color: var(--ink-2);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &.on {
            background: var(--accent-soft);
            box-shadow: inset 0 0 0 1.5px var(--accent);
            color: var(--accent-bright);
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .globe {
        @include icon(globe, 19px);
    }

    .chevron {
        @include icon(chevron-down, 12px);
    }

    .count {
        position: absolute;
        top: -5px;
        inset-inline-end: -5px;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        box-sizing: border-box;
        border-radius: 9px;
        background: var(--accent);
        color: var(--on-accent);
        font: 700 10.5px/18px var(--font-sans);
        text-align: center;
        box-shadow: 0 0 0 2px var(--surface-0);
    }

    .pills {
        flex: none;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 0 16px 12px;
    }

    .pill {
        display: flex;
        align-items: center;
        gap: 6px;
        height: 32px;
        padding: 0 10px 0 12px;
        border: 0;
        border-radius: 16px;
        background: var(--accent-soft);
        font: 600 13px/1 var(--font-sans);
        color: var(--accent-bright);
        cursor: pointer;
    }

    .x {
        @include icon(close, 10px);
    }

    .clear {
        height: 32px;
        padding: 0 8px;
        border: 0;
        background: none;
        font: 600 13px/1 var(--font-sans);
        color: var(--ink-3);
        cursor: pointer;
    }

    .scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: 26px;
        padding: 4px 0 var(--scroll-end, 24px);
    }

    .state {
        flex: 1;
        display: grid;
        place-items: center;
    }

    .none {
        margin: 0;
        padding: 40px 16px;
        text-align: center;
        font: 400 14px/1.5 var(--font-sans);
        color: var(--ink-4);
    }

    .section {
        flex: none;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .label {
        padding: 0 20px;
    }

    .list {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 0 8px;
    }

    // Featured: 300px cards, swiped across
    .featured {
        display: flex;
        gap: 10px;
        overflow-x: auto;
        scrollbar-width: none;
        scroll-snap-type: x mandatory;
        padding: 0 16px;
        scroll-padding: 0 16px;
    }

    .card {
        flex: none;
        width: 300px;
        scroll-snap-align: start;
        display: flex;
        flex-direction: column;
        padding: 0;
        border: 0;
        border-radius: 20px;
        overflow: hidden;
        background: var(--overlay-1);
        color: var(--ink);
        text-align: start;
        cursor: pointer;
    }

    .cover {
        height: 132px;
        background: linear-gradient(
            140deg,
            var(--accent) 0%,
            color-mix(in oklch, var(--accent) 40%, var(--hero-base)) 100%
        );

        &.image {
            background-position: center;
            background-size: cover;
        }
    }

    .card-head {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
        padding: 0 14px 10px;
        margin-top: -26px;
    }

    .card-avatar {
        display: flex;
        border-radius: 17px;
        box-shadow: 0 0 0 3px var(--surface-0);
    }

    .card-name {
        align-self: stretch;
        font: 700 16px/1.2 var(--font-sans);
        @include truncate;
    }

    .card-meta {
        display: flex;
        align-items: center;
        gap: 6px;
        font: 500 12.5px/1 var(--font-sans);
        color: var(--ink-4);
    }

    .users {
        @include icon(users, 12px);
    }

    .lock {
        @include icon(lock, 11px, var(--ink-3));
    }

    .card-about {
        padding: 0 14px 16px;
        min-height: 38px;
        font: 400 13px/1.45 var(--font-sans);
        color: var(--ink-3);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .shelf {
        gap: 6px;
    }

    .shelf-head {
        display: flex;
        align-items: center;
        padding: 0 10px 0 20px;
    }

    .shelf-label {
        flex: 1;
    }

    .view-all {
        height: 44px;
        margin: -14px 0;
        padding: 0 10px;
        border: 0;
        background: none;
        font: 600 13.5px/1 var(--font-sans);
        color: var(--accent-bright);
        cursor: pointer;
    }

    // 3 rows to a column, swiped across, the next column peeking in
    .columns {
        display: flex;
        overflow-x: auto;
        scrollbar-width: none;
        scroll-snap-type: x mandatory;
        padding: 0 8px;
        scroll-padding: 0 8px;
    }

    .column {
        flex: none;
        width: calc(100% - 44px);
        scroll-snap-align: start;
        display: flex;
        flex-direction: column;

        // a shelf with one column has nothing to swipe to
        &:only-child {
            width: 100%;
        }
    }

    .sheet-buttons {
        display: grid;
        grid-template-columns: 1fr 2fr;
        gap: 8px;
    }
</style>

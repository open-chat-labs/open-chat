<!-- A shelf's View all (N8b PR 4, Design Notes §3.8 Explore): the shelf's whole ranking, its place by each, under the
     shelf's name and what it ranks by ("Most members. In Deutsch."), one page more as the list nears its end. -->
<script lang="ts">
    import {
        communitiesStore,
        communityFiltersStore,
        exploreCommunitiesFiltersStore,
        isCommunityMember,
        type OpenChat,
    } from "@client";
    import { supportedLanguagesByCode } from "@i18n/i18n";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import { exploreNeedsSearch, exploreSearchKey } from "@src/logic/explore/exploreSearch";
    import { communitySearchState, heldCommunitySearch } from "@src/stores/search.svelte";
    import { navigate } from "@src/utils/navigation";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import type { LocalScreen } from "../../router/locations";
    import type { ScreenProps } from "../app/screens";
    import { exploreRows, type ExploreRow } from "./explore.adapter";
    import { exploreFirstPage, exploreNextPage } from "./exploreFeed";
    import ExploreRowView from "./ExploreRowView.svelte";

    let { screen, context }: ScreenProps<Extract<LocalScreen, { kind: "explore_list" }>> =
        $props();

    const client = getContext<OpenChat>("client");

    const languages = $derived([...$communityFiltersStore]);
    const flags = $derived($exploreCommunitiesFiltersStore.flags);
    // the shelves rank the communities found with no search text
    const query = $derived({ text: "", languages });
    let loading = $state(false);

    $effect(() => {
        const wanted = exploreSearchKey(query, flags);
        untrack(() => {
            if (exploreNeedsSearch(heldCommunitySearch(), wanted, communitySearchState.results.length)) {
                loading = true;
                void exploreFirstPage(client, query, flags).finally(() => (loading = false));
            }
        });
    });

    async function more() {
        if (loading) return;
        const next = exploreNextPage(client, query, flags);
        if (next === undefined) return;
        loading = true;
        await next;
        loading = false;
    }

    const joined = $derived(
        new Set(
            [...$communitiesStore.values()]
                .filter(isCommunityMember)
                .map((c) => c.id.communityId),
        ),
    );
    const rows = $derived(exploreRows(communitySearchState.results, joined));
    const sub = $derived(
        [
            $_(`native.explore.shelfSub.${screen.shelf}`),
            languages.length > 0
                ? $_("native.explore.inLanguages", {
                      values: {
                          languages: languages
                              .map((code) => supportedLanguagesByCode[code]?.name ?? code)
                              .join(", "),
                      },
                  })
                : "",
        ]
            .filter((part) => part)
            .join(" "),
    );

    function open(row: ExploreRow) {
        if (!row.joined) client.setCommunityPreviewOrigin(row.id, "/communities");
        navigate(`/community/${row.id}`);
    }
</script>

<div class="screen">
    <NativePageHeader title={$_(`native.explore.shelf.${screen.shelf}`)} onBack={context.back} />
    <p class="sub">{sub}</p>
    <div
        class="scroll"
        onscroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 400) void more();
        }}>
        {#each rows as row (row.id)}
            <ExploreRowView {row} ranked onOpen={open} />
        {/each}
        {#if loading}<div class="loading"><Spinner /></div>{/if}
    </div>
</div>

<style lang="scss">
    .screen {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .sub {
        flex: none;
        margin: 0;
        padding: 0 20px 8px;
        font: 400 13px/1.45 var(--font-sans);
        color: var(--ink-3);
    }

    .scroll {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 4px 8px calc(var(--safe-bottom) + 24px);
    }

    .loading {
        display: grid;
        place-items: center;
        padding: 16px;
    }
</style>

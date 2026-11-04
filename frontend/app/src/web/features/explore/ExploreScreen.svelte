<!-- Explore (region "explore", 8a #10127): ExploreCommunities, full width, on /communities and
     /welcome. The library asks for pages (onQuery) and the client searches
     (`searchCommunities`, shared with both old Explores), filtered by the languages picked and the
     viewer's moderation flags. The query is in the URL (/communities?q=&lang=, ROUTES.md): read
     when the screen opens or the URL changes from outside, and written (replacing the entry, with
     any dialog over Explore left open) as it changes. The languages picked are also saved on this
     device (`communityFiltersStore`), which a URL without `lang` opens on. The results and their
     scroll position outlive the screen (`communitySearchState`): coming back shows them again, and
     searches only when there are none or they answer another query. Featured and Popular are cut
     from the one ranking the backend has, so a change of sort asks for nothing (GAPS.md). A
     community the viewer hasn't joined opens as a preview, whose cancel comes back here. A guest's
     Create community carries on after signing in in AppScreen, wherever they are by then. -->
<script lang="ts">
    import {
        anonUserStore,
        communitiesStore,
        communityFiltersStore,
        exploreCommunitiesFiltersStore,
        offlineStore,
        querystringStore,
        routeStore,
        type CommunityMatch,
        type OpenChat,
    } from "@client";
    import ExploreCommunities, {
        type ExploreQuery,
    } from "@openchat/ui/src/features/components/ExploreCommunities.svelte";
    import EmptyState from "@openchat/ui/src/lib/components/EmptyState.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import { supportedLanguages, supportedLanguagesByCode } from "@i18n/i18n";
    import {
        communitySearchState,
        heldCommunitySearch,
        searchCommunities,
        type CommunitySearch,
    } from "@src/stores/search.svelte";
    import { navigate, replaceQuery } from "@src/utils/navigation";
    import { communityPreviewState } from "@src/utils/preview.svelte";
    import { getContext, onDestroy, untrack } from "svelte";
    import { openCommunityCreation } from "../app/createCommunity";
    import type { MiddleRegion, ScreenProps } from "../app/screens";
    import {
        exploreCommunities,
        exploreLanguageOptions,
        joinedCommunityKeys,
    } from "./explore.adapter";
    import {
        communityOpening,
        EXPLORE_PAGE_SIZE,
        explorePage,
        exploreNeedsSearch,
        exploreQueryAnswered,
        exploreQueryFromUrl,
        exploreSearch,
        exploreSearchKey,
        exploreAfterSearch,
        exploreUrl,
        isExploreRoute,
        languageToggles,
        sameExploreQuery,
        type ExploreAsker,
        type ExploreStatus,
        type ExploreUrlQuery,
    } from "./exploreQuery";

    let { context }: ScreenProps<Extract<MiddleRegion, { kind: "explore" }>> = $props();

    const client = getContext<OpenChat>("client");

    // the URL's own query: querystringStore is built from page.js's decoded query string, where a
    // search text with an "&" in it has already been split apart (as the Router reads it)
    const urlParams = () => new URLSearchParams(window.location.search);

    const flags = $derived($exploreCommunitiesFiltersStore.flags);
    const opening = exploreQueryFromUrl(urlParams(), communityFiltersStore.value);
    const reusing = untrack(
        () =>
            !exploreNeedsSearch(
                heldCommunitySearch(),
                exploreSearchKey(opening, flags),
                communitySearchState.results.length,
            ),
    );

    let query = $state<ExploreUrlQuery>(opening);
    let status = $state<ExploreStatus>(reusing ? { kind: "ready" } : { kind: "loading" });
    let loading = $state(false);
    // the page the component last asked for couldn't be loaded: it shows so itself
    let failed = $state(false);
    // a query the URL changes to from outside (the rail's Explore …) starts the component afresh
    let generation = $state(0);
    // where the component opens scrolled to: where the last visit left the same results, else the top
    let initialScroll = $state(untrack(() => (reusing ? communitySearchState.scrollPos : 0)));
    // where it's scrolled to now: a plain field, kept in communitySearchState as the screen goes
    let scrollTop = untrack(() => initialScroll);
    // a first page the results held already answer (a change of sort): the component is told so by
    // a new list of the same communities
    let answered = $state(0);
    // the queries written to the URL that it may not show yet
    const written = new Set<string>();

    const communities = $derived.by(() => {
        void answered;
        return exploreCommunities(
            communitySearchState.results,
            (m: CommunityMatch) => client.communityAvatarUrl(m.id.communityId, m.avatar),
            supportedLanguagesByCode,
        );
    });
    const joinedKeys = $derived(joinedCommunityKeys($communitiesStore.values()));
    const languageOptions = exploreLanguageOptions(supportedLanguages);

    onDestroy(() => {
        communitySearchState.scrollPos = scrollTop;
    });

    async function search(
        page: CommunitySearch["page"],
        askedBy: ExploreAsker,
        pageSize = EXPLORE_PAGE_SIZE,
    ) {
        loading = true;
        failed = false;
        const outcome = await searchCommunities(
            client,
            exploreSearch(query, flags, page, pageSize),
        );
        if (outcome === "superseded") return;
        loading = false;
        const after = exploreAfterSearch(status, page, outcome, askedBy);
        status = after.status;
        failed = after.failed;
    }

    // the results held answer the query: no search, and any still in flight is for another one
    function answeredAlready() {
        communitySearchState.cancel();
        loading = false;
        failed = false;
    }

    // the first page again, with the component (re)opening on it at the top once it arrives
    function retry() {
        status = { kind: "loading" };
        initialScroll = 0;
        scrollTop = 0;
        void search("first", "screen");
    }

    // on opening, and when the viewer's moderation flags change, unless the results held answer
    // the query as it is. A component already showing keeps its scroll
    $effect(() => {
        const viewerFlags = flags;
        untrack(() => {
            const wanted = exploreSearchKey(query, viewerFlags);
            const held = communitySearchState.results.length;
            if (exploreNeedsSearch(heldCommunitySearch(), wanted, held)) {
                void search("first", "screen");
            }
        });
    });

    // the URL changed: a query written here (now or a moment ago) is already shown; any other
    // reopens the component on it, from the results held when they answer it (Back to a query
    // still held), else from its first page
    $effect(() => {
        void $querystringStore;
        untrack(() => {
            if (!isExploreRoute(routeStore.value)) return;
            const wanted = exploreQueryFromUrl(urlParams(), communityFiltersStore.value);
            if (sameExploreQuery(wanted, query)) {
                written.clear();
                return;
            }
            if (written.has(JSON.stringify(wanted))) return;
            query = wanted;
            generation += 1;
            if (exploreQueryAnswered(heldCommunitySearch(), exploreSearchKey(wanted, flags))) {
                answeredAlready();
                status = { kind: "ready" };
                initialScroll = scrollTop;
            } else {
                retry();
            }
        });
    });

    function createCommunity() {
        openCommunityCreation(client, context.dialogs);
    }

    function onQuery(q: ExploreQuery) {
        const page = explorePage(q);
        if (page === "first") {
            query = { text: q.text, languages: q.languages };
            saveLanguages(q.languages);
            writeUrl(query);
            if (exploreQueryAnswered(heldCommunitySearch(), exploreSearchKey(query, flags))) {
                answeredAlready();
                answered += 1;
                return;
            }
        }
        void search(page, "component", q.limit);
    }

    function saveLanguages(languages: string[]) {
        for (const code of languageToggles(communityFiltersStore.value, languages)) {
            client.toggleCommunityFilterLanguage(code);
        }
    }

    function writeUrl(shown: ExploreUrlQuery) {
        const to = exploreUrl(urlParams(), shown);
        if (to === `${window.location.pathname}${window.location.search}`) return;
        // kept only once it's written: one that never reached the URL mustn't hide the URL's
        // later change to it
        const key = JSON.stringify(shown);
        written.add(key);
        if (!replaceQuery(to)) written.delete(key);
    }

    function openCommunity(communityId: string) {
        const target = communityOpening(communityId, joinedKeys.includes(communityId), query);
        if (target.kind === "preview") {
            communityPreviewState.setOrigin(communityId, target.origin);
        }
        navigate(target.path);
    }
</script>

<div class="explore">
    {#if $offlineStore && communitySearchState.results.length === 0}
        <div class="state">
            <EmptyState preset="offline" actionHandler={retry} />
        </div>
    {:else if status.kind === "loading"}
        <div class="state"><Spinner /></div>
    {:else if status.kind === "failed"}
        <div class="state">
            <EmptyState preset={$offlineStore ? "offline" : "error"} actionHandler={retry} />
        </div>
    {:else}
        {#key generation}
            <ExploreCommunities
                {communities}
                total={communitySearchState.total}
                {loading}
                {failed}
                {joinedKeys}
                {languageOptions}
                initialQuery={query.text}
                initialLanguages={query.languages}
                {initialScroll}
                onScroll={(top) => (scrollTop = top)}
                {onQuery}
                onOpen={openCommunity}
                onPreview={openCommunity}
                onCreate={createCommunity}
                guest={$anonUserStore}
                onSignIn={() => client.updateIdentityState({ kind: "logging_in" })}
            />
        {/key}
    {/if}
</div>

<style lang="scss">
    .explore {
        height: 100%;
    }

    .state {
        display: grid;
        place-items: center;
        height: 100%;
    }
</style>

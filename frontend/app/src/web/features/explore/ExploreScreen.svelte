<!-- Explore (region "explore", 8a #10127): ExploreCommunities, full width, on /communities and
     /welcome. The library asks for pages (onQuery) and the client searches
     (`searchCommunities`, shared with both old Explores), filtered by the languages picked and the
     viewer's moderation flags. The query is in the URL (/communities?q=&lang=, ROUTES.md): read
     when the screen opens or the URL changes from outside, and written (replacing the entry) as it
     changes. The languages picked are also saved on this device (`communityFiltersStore`), which
     a URL without `lang` opens on. The results and their scroll position outlive the screen
     (`communitySearchState`): coming back shows them again, and searches only when there are none
     or they answer another query. Featured and Popular are cut from the one ranking the backend
     has, and its sorts all ask for that ranking (GAPS.md). A community the viewer hasn't joined
     opens as a preview, whose cancel comes back here. -->
<script lang="ts">
    import {
        anonUserStore,
        communitiesStore,
        communityFiltersStore,
        exploreCommunitiesFiltersStore,
        identityStateStore,
        offlineStore,
        postLoginCreateCommunity,
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
    import { navigate } from "@src/utils/navigation";
    import { communityPreviewState } from "@src/utils/preview.svelte";
    import { getContext, tick, untrack } from "svelte";
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
        exploreQueryFromUrl,
        exploreSearch,
        exploreSearchKey,
        exploreUrl,
        isExploreRoute,
        languageToggles,
        sameExploreQuery,
        type ExploreUrlQuery,
    } from "./exploreQuery";

    let { context }: ScreenProps<Extract<MiddleRegion, { kind: "explore" }>> = $props();

    const client = getContext<OpenChat>("client");

    // waiting for the first answer to the query shown; or showing it; or that answer failed
    type Status = { kind: "loading" } | { kind: "ready" } | { kind: "failed" };

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
    let status = $state<Status>(reusing ? { kind: "ready" } : { kind: "loading" });
    let loading = $state(false);
    // a query the URL changes to from outside (the rail's Explore …) starts the component afresh
    let generation = $state(0);
    let initialScroll = $state(untrack(() => (reusing ? communitySearchState.scrollPos : 0)));
    // the queries written to the URL that it may not show yet
    const written = new Set<string>();

    const communities = $derived(
        exploreCommunities(
            communitySearchState.results,
            (m: CommunityMatch) => client.communityAvatarUrl(m.id.communityId, m.avatar),
            supportedLanguagesByCode,
        ),
    );
    const joinedKeys = $derived(joinedCommunityKeys($communitiesStore.values()));
    const languageOptions = exploreLanguageOptions(supportedLanguages);

    async function search(page: CommunitySearch["page"], pageSize = EXPLORE_PAGE_SIZE) {
        loading = true;
        const outcome = await searchCommunities(
            client,
            exploreSearch(query, flags, page, pageSize),
        );
        if (outcome === "superseded") return;
        loading = false;
        if (outcome === "success") {
            status = { kind: "ready" };
        } else if (status.kind === "loading") {
            status = { kind: "failed" };
        }
    }

    function retry() {
        status = { kind: "loading" };
        void search("first");
    }

    // on opening, and when the viewer's moderation flags change, unless the results held answer
    // the query as it is
    $effect(() => {
        const viewerFlags = flags;
        untrack(() => {
            const wanted = exploreSearchKey(query, viewerFlags);
            const held = communitySearchState.results.length;
            if (exploreNeedsSearch(heldCommunitySearch(), wanted, held)) void search("first");
        });
    });

    // the URL changed: a query written here (now or a moment ago) is already shown; any other is
    // shown from the first page
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
            initialScroll = 0;
            generation += 1;
            retry();
        });
    });

    // a guest who chose to create a community carries on once signed in
    $effect(() => {
        if (postLoginCreateCommunity($identityStateStore)) {
            void resumeCreating();
        }
    });

    async function resumeCreating() {
        client.clearPostLoginState();
        await tick();
        createCommunity();
    }

    function createCommunity() {
        openCommunityCreation(client, context.dialogs);
    }

    function onQuery(q: ExploreQuery) {
        const page = explorePage(q);
        if (page === "first") {
            query = { text: q.text, languages: q.languages };
            saveLanguages(q.languages);
            writeUrl(query);
        }
        void search(page, q.limit);
    }

    function saveLanguages(languages: string[]) {
        for (const code of languageToggles(communityFiltersStore.value, languages)) {
            client.toggleCommunityFilterLanguage(code);
        }
    }

    function writeUrl(shown: ExploreUrlQuery) {
        const to = exploreUrl(urlParams(), shown);
        if (to === `${window.location.pathname}${window.location.search}`) return;
        written.add(JSON.stringify(shown));
        navigate(to, "auto");
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
            <EmptyState preset="error" actionHandler={retry} />
        </div>
    {:else}
        {#key generation}
            <ExploreCommunities
                {communities}
                total={communitySearchState.total}
                {loading}
                {joinedKeys}
                {languageOptions}
                initialQuery={query.text}
                initialLanguages={query.languages}
                {initialScroll}
                onScroll={(top) => (communitySearchState.scrollPos = top)}
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

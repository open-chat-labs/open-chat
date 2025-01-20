<script lang="ts">
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../../i18n/i18n";
    import Search from "../../Search.svelte";
    import { communitySearchState } from "../../../stores/search.svelte";
    import { getContext } from "svelte";
    import { OpenChat, type CommunityMatch } from "openchat-client";
    import SelectedMatch from "./SelectedMatch.svelte";

    const client = getContext<OpenChat>("client");
    const PAGE_SIZE = 15;

    interface Props {
        onSelect: (community: CommunityMatch | undefined) => void;
        selected?: CommunityMatch;
    }

    let { onSelect, selected }: Props = $props();

    function search(term: string) {
        if (term === "") {
            reset(true);
            return;
        }
        communitySearchState.term = term;
        communitySearchState.reset();

        client
            .exploreCommunities(
                communitySearchState.term === "" ? undefined : communitySearchState.term,
                communitySearchState.index,
                PAGE_SIZE,
                0,
                [],
            )
            .then((results) => {
                if (results.kind === "success") {
                    communitySearchState.results = results.matches;
                    communitySearchState.total = results.total;
                }
            });
    }

    function reset(clearSelected: boolean) {
        communitySearchState.results = [];
        communitySearchState.term = "";
        if (clearSelected) {
            select(undefined);
        }
    }

    function select(match: CommunityMatch | undefined) {
        selected = match;
        communitySearchState.results = [];
        onSelect(match);
    }
</script>

<div class="finder">
    {#if selected !== undefined}
        <SelectedMatch onRemove={() => reset(true)} match={selected}></SelectedMatch>
    {:else}
        <Search
            fill
            bind:searchTerm={communitySearchState.term}
            searching={false}
            on:searchEntered={(ev: CustomEvent<string>) => search(ev.detail)}
            placeholder={i18nKey("communities.search")} />
    {/if}

    {#each communitySearchState.results as community (community.id.communityId)}
        <p onclick={() => select(community)}>{community.name}</p>
    {/each}
</div>

<style lang="scss">
    .finder {
        margin-bottom: $sp3;
    }
</style>

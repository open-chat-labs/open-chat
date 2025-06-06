<script lang="ts">
    import { _ } from "svelte-i18n";
    import { i18nKey } from "../../../i18n/i18n";
    import Search from "../../Search.svelte";
    import { communitySearchState } from "../../../stores/search.svelte";
    import { getContext } from "svelte";
    import { AvatarSize, OpenChat, type CommunityMatch } from "openchat-client";
    import SelectedMatch from "./SelectedMatch.svelte";
    import Avatar from "../../Avatar.svelte";
    import Menu from "../../Menu.svelte";
    import MenuItem from "../../MenuItem.svelte";

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
            onPerformSearch={search}
            placeholder={i18nKey("communities.search")} />
    {/if}

    {#if communitySearchState.results.length > 0}
        <div class="menu">
            <Menu fit>
                {#each communitySearchState.results as community (community.id.communityId)}
                    <MenuItem onclick={() => select(community)}>
                        {#snippet icon()}
                            <Avatar
                                url={client.communityAvatarUrl(
                                    community.id.communityId,
                                    community.avatar,
                                )}
                                size={AvatarSize.Small} />
                        {/snippet}
                        {#snippet text()}
                            {community.name}
                        {/snippet}
                    </MenuItem>
                {/each}
            </Menu>
        </div>
    {/if}
</div>

<style lang="scss">
    .finder {
        margin-bottom: $sp3;
    }

    .menu {
        max-height: 250px;
        overflow: auto;
        width: fit-content;
        margin-top: $sp3;
    }
</style>

<script lang="ts">
    import Tune from "svelte-material-icons/Tune.svelte";
    import { _ } from "svelte-i18n";
    import Button from "../../../Button.svelte";
    import HoverIcon from "../../../HoverIcon.svelte";
    import page from "page";
    import CommunityCard from "./CommunityCard.svelte";
    import Search from "../../..//Search.svelte";
    import { mobileWidth } from "../../../../stores/screenDimensions";
    import { iconSize } from "../../../../stores/iconSize";
    import type { CommunityMatch, OpenChat } from "openchat-client";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import FancyLoader from "../../../icons/FancyLoader.svelte";
    import { pushRightPanelHistory } from "../../../../stores/rightPanel";
    import { communityFiltersStore } from "../../../../stores/communityFilters";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let searchTerm = "";
    let searching = false;
    let searchResults: CommunityMatch[] = [];

    $: isDiamond = client.isDiamond;

    function createCommunity() {
        if (!$isDiamond) {
            dispatch("upgrade");
        } else {
            dispatch("createCommunity");
        }
    }

    function selectCommunity(community: CommunityMatch) {
        page(`/community/${community.id.communityId}`);
    }

    function search() {
        searching = true;
        client
            .exploreCommunities(
                searchTerm === "" ? undefined : searchTerm,
                0,
                10,
                $communityFiltersStore.flags,
                Array.from($communityFiltersStore.languages)
            )
            .then((results) => {
                console.log("SearchResults: ", results);
                if (results.kind === "success") {
                    searchResults = results.matches;
                }
            })
            .finally(() => (searching = false));
    }

    function showFilters() {
        pushRightPanelHistory({ kind: "community_filters" });
    }

    onMount(() => {
        const sub = communityFiltersStore.subscribe((_) => search());
        return sub;
    });
</script>

<div class="explore">
    <div class="header">
        <div class="title-row">
            <div class="title">
                <h4>{$_("communities.explore")}</h4>
            </div>
            {#if !$mobileWidth}
                <div class="search">
                    <Search
                        fill
                        bind:searchTerm
                        searching={false}
                        on:searchEntered={search}
                        placeholder={$_("communities.search")} />
                </div>
                <div class="create">
                    <Button on:click={createCommunity} hollow>{$_("communities.create")}</Button>
                </div>
            {/if}
            <HoverIcon on:click={showFilters}>
                <Tune size={$iconSize} color={"var(--icon-txt)"} />
            </HoverIcon>
        </div>
        <div class="subtitle-row">
            {#if $mobileWidth}
                <div class="search">
                    <Search
                        searching={false}
                        fill
                        bind:searchTerm
                        placeholder={$_("communities.search")} />
                </div>
            {/if}
        </div>
    </div>

    <div class="communities" class:loading={searching} class:empty={searchResults.length === 0}>
        {#if searching}
            <div class="loading">
                <FancyLoader />
            </div>
        {:else if searchResults.length === 0}
            <div class="robot">
                <h4 class="header">No matching communities found</h4>
                <p class="sub-header">try refining your search</p>
            </div>
        {:else}
            {#each searchResults as community}
                <CommunityCard
                    name={community.name}
                    description={community.description}
                    avatar={community.avatar}
                    banner={community.banner}
                    memberCount={community.memberCount}
                    channelCount={community.channelCount}
                    gate={community.gate}
                    language={community.primaryLanguage}
                    flags={community.flags}
                    on:click={() => selectCommunity(community)} />
            {/each}
        {/if}
    </div>
</div>

<style lang="scss">
    .explore {
        display: flex;
        flex-direction: column;
        gap: $sp4;
        padding: $sp5;
        height: 100%;
        overflow: hidden;

        @include mobile() {
            padding: $sp3;
            gap: $sp3;
        }
    }

    .header {
        .title-row {
            display: flex;
            align-items: center;
            gap: $sp4;
            margin-bottom: $sp5;

            .title {
                display: flex;
                gap: $sp3;
                align-items: center;

                h4 {
                    @include font(bold, normal, fs-160, 38);
                    flex: auto;
                }
            }

            .search {
                flex: auto;
            }
        }

        .subtitle-row {
            display: flex;
            justify-content: space-between;
            gap: $sp4;

            @include mobile() {
                flex-direction: column;
            }
        }
    }

    .communities {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        grid-gap: $sp5;
        @include nice-scrollbar();

        @include size-below(xxl) {
            grid-gap: $sp4;
        }

        @include size-below(xl) {
            grid-template-columns: repeat(3, 1fr);
        }

        @include size-below(md) {
            grid-template-columns: repeat(2, 1fr);
        }

        @include size-below(sm) {
            grid-template-columns: repeat(1, 1fr);
        }

        &.loading,
        &.empty {
            height: 100%;
            grid-template-columns: repeat(1, 1fr);
        }
    }

    $size: 200px;

    .loading {
        width: $size;
        margin: auto;
    }

    .robot {
        .header {
            @include font(bold, normal, fs-160, 38);
        }
        .sub-header {
            @include font(book, normal, fs-100, 38);
            color: var(--txt-light);
        }
        margin: auto;
        text-align: center;
    }
</style>

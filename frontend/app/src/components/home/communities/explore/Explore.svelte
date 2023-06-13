<script lang="ts">
    import { _ } from "svelte-i18n";
    import Button from "../../../Button.svelte";
    import Select from "../../../Select.svelte";
    import page from "page";
    import CommunityCard from "./CommunityCard.svelte";
    import Search from "../../..//Search.svelte";
    import { pathParams } from "../../../../routes";
    import { mobileWidth } from "../../../../stores/screenDimensions";
    import Filters from "./Filters.svelte";
    import type { Community, CommunityMatch, OpenChat } from "openchat-client";
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import { toastStore } from "stores/toast";
    import FancyLoader from "../../../icons/FancyLoader.svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let searchTerm = "";
    let searching = false;
    let joining: Set<string> = new Set();
    let canCreate = true; //TODO - permissions?
    let searchResults: CommunityMatch[] = [];

    $: allCommunities = client.allCommunities;
    $: myCommunities = client.communities;
    $: isDiamond = client.isDiamond;

    $: selectedCommunityId =
        $pathParams.kind === "communities_route" ? $pathParams.communityId : undefined;

    $: communities = $allCommunities.filter((c) => $myCommunities[c.id] === undefined);

    async function joinCommunity(ev: CustomEvent<string>) {
        joining.add(ev.detail);
        joining = joining;

        client
            .joinCommunity(ev.detail)
            .then((resp) => {
                if (resp.kind === "success") {
                    toastStore.showSuccessToast("Joined community successfully");
                } else {
                    toastStore.showFailureToast("Failed to join community");
                }
            })
            .finally(() => {
                joining.delete(ev.detail);
                joining = joining;
            });
    }

    function createCommunity() {
        if (!$isDiamond) {
            dispatch("upgrade");
        } else {
            dispatch("createCommunity");
        }
    }

    function selectCommunity(community: CommunityMatch) {
        page(`/communities/${community.id}`);
    }

    function search() {
        searching = true;

        client
            .searchCommunities("Hello")
            .then((results) => {
                console.log("SearchResults: ", results);
                if (results.kind === "success") {
                    searchResults = results.communityMatches;
                }
            })
            .finally(() => {
                setTimeout(() => {
                    searching = false;
                }, 3000);
            });
    }

    onMount(search);
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
                        bind:searching
                        placeholder={$_("communities.search")} />
                </div>
                {#if canCreate}
                    <div class="create">
                        <Button on:click={createCommunity} hollow
                            >{$_("communities.create")}</Button>
                    </div>
                {/if}
            {/if}
        </div>
        <div class="subtitle-row">
            <Filters />
            {#if $mobileWidth}
                <div class="search">
                    <Search
                        searching={false}
                        fill
                        bind:searchTerm
                        placeholder={$_("communities.search")} />
                </div>
            {:else}
                <div class="sort">
                    <Select>
                        <option value={""} selected={true} disabled={true}>Sort by</option>
                        <option value={""}>{"Newest"}</option>
                        <option value={""}>{"Member count: Low to high"}</option>
                        <option value={""}>{"Member count: High to low"}</option>
                        <option value={""}>{"Alphabetical: A-Z"}</option>
                        <option value={""}>{"Alphabetical: Z-A"}</option>
                    </Select>
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
                    id={community.id}
                    name={community.name}
                    description={community.description}
                    avatar={community.avatar}
                    banner={community.banner}
                    memberCount={community.memberCount}
                    channelCount={community.channelCount}
                    on:joinCommunity={joinCommunity}
                    selected={selectedCommunityId === community.id}
                    joining={joining.has(community.id)}
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
        grid-template-columns: repeat(auto-fit, minmax(min(300px, 100%), 1fr));
        gap: $sp5;
        @include nice-scrollbar();

        &.loading,
        &.empty {
            height: 100%;
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

<script lang="ts">
    import { dummyCommunities, myCommunities } from "../../../../stores/community";
    import { _ } from "svelte-i18n";
    import Button from "../../../Button.svelte";
    import Select from "../../../Select.svelte";
    import page from "page";
    import CommunityCard from "./CommunityCard.svelte";
    import Search from "../../..//Search.svelte";
    import { pathParams } from "../../../../routes";
    import { mobileWidth } from "../../../../stores/screenDimensions";
    import Filters from "./Filters.svelte";
    import type { Community, OpenChat } from "openchat-client";
    import { createEventDispatcher, getContext } from "svelte";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    let searchTerm = "";
    let searching = false;
    let joining: Set<string> = new Set();
    let canCreate = true; //TODO - permissions?

    $: isDiamond = client.isDiamond;

    $: selectedCommunityId =
        $pathParams.kind === "communities_route" ? $pathParams.communityId : undefined;

    $: myCommunitiesLookup = client.toRecord2(
        $myCommunities,
        (c) => c.id,
        (c) => c
    );

    $: communities = $dummyCommunities.filter((c) => myCommunitiesLookup[c.id] === undefined);

    function joinCommunity(ev: CustomEvent<Community>) {
        joining.add(ev.detail.id);
        joining = joining;

        setTimeout(() => {
            myCommunities.update((communities) => {
                return [ev.detail, ...communities];
            });
            joining.delete(ev.detail.id);
            joining = joining;
        }, 2000);
    }

    function createCommunity() {
        if (!$isDiamond) {
            dispatch("upgrade");
        } else {
            dispatch("createCommunity");
        }
    }
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
                        fill
                        bind:searchTerm
                        bind:searching
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

    <div class="communities">
        {#each communities as community}
            <CommunityCard
                on:joinCommunity={joinCommunity}
                selected={selectedCommunityId === community.id}
                {community}
                joining={joining.has(community.id)}
                on:click={() => page(`/communities/${community.id}`)} />
        {/each}
    </div>
</div>

<style type="text/scss">
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
    }
</style>

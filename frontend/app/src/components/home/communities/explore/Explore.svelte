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
    import Edit from "../edit/Edit.svelte";
    import type { Community, OpenChat } from "openchat-client";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    let searchTerm = "";
    let searching = false;
    let showEditModel = false;
    let joining: Set<string> = new Set();

    $: selectedCommunityId =
        $pathParams.kind === "communities_route" ? $pathParams.communityId : undefined;
    $: myCommunitiesLookup = client.toRecord2(
        $myCommunities,
        (c) => c.id,
        (c) => c
    );

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
</script>

<Edit bind:show={showEditModel} />

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
                <div class="create">
                    <Button on:click={() => (showEditModel = true)} hollow
                        >{$_("communities.create")}</Button>
                </div>
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
        {#each $dummyCommunities as community}
            <CommunityCard
                on:joinCommunity={joinCommunity}
                selected={selectedCommunityId === community.id}
                {community}
                joining={joining.has(community.id)}
                member={myCommunitiesLookup[community.id] !== undefined}
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
